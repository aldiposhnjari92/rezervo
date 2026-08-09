-- =====================================================================
--  Rezervo.al — Forcimi i sigurisë
--  Ekzekutohet i FUNDIT:
--    schema.sql -> admin.sql -> features.sql -> shell.sql -> security.sql
--  Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Privilegji më i vogël i mundshëm
--
--  Supabase u jep `anon` dhe `authenticated` grant-e të plota mbi çdo tabelë të
--  schema-s `public`. Kjo do të thoshte se RLS-ja ishte e VETMJA mbrojtje: një
--  policy e shkruar gabim nesër do të hapte gjithçka.
--
--  Tani duhen DY shtresa për të kaluar: grant-i DHE policy-a.
-- ---------------------------------------------------------------------

-- `anon` nuk prek asnjë tabelë. E gjithë faqja publike kalon nga funksione
-- SECURITY DEFINER, ndaj nuk i duhet asnjë e drejtë e drejtpërdrejtë.
revoke all on public.businesses        from anon;
revoke all on public.services          from anon;
revoke all on public.bookings          from anon;
revoke all on public.business_closures from anon;
revoke all on public.notifications     from anon;
revoke all on public.platform_admins   from anon;

-- `authenticated` mban vetëm atë që aplikacioni përdor vërtet.
revoke delete on public.businesses                  from authenticated;
revoke insert, delete on public.bookings            from authenticated;
revoke update on public.business_closures           from authenticated;
revoke insert, update, delete on public.notifications from authenticated;
revoke all on public.platform_admins                from authenticated;

-- Funksionet e trigger-ave nuk janë endpoint-e; PostgREST i ekspozon thjesht
-- sepse ekzistojnë. Trigger-at vazhdojnë të punojnë — ekzekutohen si pronari i
-- funksionit, jo si roli që bëri ndryshimin.
revoke all on function public.notify_on_booking()    from public, anon, authenticated;
revoke all on function public.notify_on_suspension() from public, anon, authenticated;

-- ---------------------------------------------------------------------
--  2. Kufizim shpejtësie
--
--  Mbahet në bazë e jo në memorie: serveri është pa gjendje dhe çdo kërkesë
--  mund të shkojë te një instancë tjetër, ndaj një numërues në RAM nuk numëron.
-- ---------------------------------------------------------------------
create table if not exists public.rate_limits (
  bucket       text primary key,
  hits         int not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;
-- Asnjë policy dhe asnjë grant: preket vetëm nga funksioni më poshtë.

create index if not exists rate_limits_window on public.rate_limits (window_start);

/**
 * Kthen `true` nëse veprimi lejohet, `false` nëse kufiri u kalua.
 *
 * `on conflict do update` e bën numërimin atomik: dy kërkesa njëkohësisht nuk e
 * kalojnë dot kufirin duke lexuar të njëjtën vlerë të vjetër.
 *
 * NUK i jepet grant askujt. Thirret vetëm nga funksione të tjera SECURITY
 * DEFINER — përndryshe kushdo do të mund të shterrte kovën e dikujt tjetër.
 */
create or replace function public.check_rate_limit(
  p_bucket text, p_max int, p_window interval)
returns boolean language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare v_hits int;
begin
  if p_bucket is null or length(p_bucket) = 0 or length(p_bucket) > 200 then
    return false;
  end if;

  insert into public.rate_limits (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case when public.rate_limits.window_start < now() - p_window
                    then 1 else public.rate_limits.hits + 1 end,
        window_start = case when public.rate_limits.window_start < now() - p_window
                    then now() else public.rate_limits.window_start end
  returning hits into v_hits;

  return v_hits <= p_max;
end; $$;

revoke all on function public.check_rate_limit(text, int, interval) from public, anon, authenticated;

/** Pastrim i rreshtave të vjetër. */
create or replace function public.prune_rate_limits()
returns void language sql volatile security definer
set search_path = public, pg_temp as $$
  delete from public.rate_limits where window_start < now() - interval '1 day';
$$;
revoke all on function public.prune_rate_limits() from public, anon, authenticated;

-- =====================================================================
--  SHËNIM: kufijtë zbatohen BRENDA `create_booking()` (shih features.sql).
--
--  Kjo është e qëllimshme. Çelësi `anon` është publik — gjendet në çdo bundle
--  shfletuesi — ndaj kushdo mund t'i flasë PostgREST-it direkt. Një kufizim i
--  vendosur te shtresa e Next-it anashkalohet thjesht duke mos kaluar nga ajo.
--  Brenda funksionit nuk anashkalohet dot.
-- =====================================================================
