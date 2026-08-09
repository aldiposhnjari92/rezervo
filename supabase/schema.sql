-- =====================================================================
--  Rezervo.al — Skema e plotë e bazës së të dhënave (Supabase / Postgres)
--  Ekzekuto këtë skedar te: Supabase Dashboard -> SQL Editor -> New query
--  Është idempotent: mund ta ekzekutosh disa herë pa problem.
-- =====================================================================

-- btree_gist na duhet për constraint-in EXCLUDE (uuid = + tstzrange &&)
create extension if not exists btree_gist;

-- =====================================================================
--  1. TABELAT
-- =====================================================================

-- --------------------------- businesses ------------------------------
create table if not exists public.businesses (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references auth.users (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 2 and 80),
  slug          text not null unique
                  check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 40),
  owner_email   text not null,
  phone         text,
  -- {"monday": {"start":"09:00","end":"18:00"}, "sunday": null, ...}
  -- Një ditë me vlerë `null` (ose që mungon) do të thotë "mbyllur".
  working_hours jsonb not null default jsonb_build_object(
                  'monday',    jsonb_build_object('start','09:00','end','18:00'),
                  'tuesday',   jsonb_build_object('start','09:00','end','18:00'),
                  'wednesday', jsonb_build_object('start','09:00','end','18:00'),
                  'thursday',  jsonb_build_object('start','09:00','end','18:00'),
                  'friday',    jsonb_build_object('start','09:00','end','18:00'),
                  'saturday',  jsonb_build_object('start','09:00','end','14:00'),
                  'sunday',    'null'::jsonb
                ),
  created_at    timestamptz not null default now()
);

-- V1: një biznes për çdo pronar.
create unique index if not exists businesses_owner_id_key on public.businesses (owner_id);

-- Faqja publike është /[slug], ndaj slug-et që përplasen me rrugët e vetë
-- aplikacionit (/services, /settings, ...) nuk lejohen — përndryshe ai biznes
-- nuk do të hapej kurrë. E njëjta listë ndodhet te src/lib/slug.ts.
do $$
begin
  alter table public.businesses drop constraint if exists businesses_slug_not_reserved;
  alter table public.businesses add constraint businesses_slug_not_reserved check (
    slug not in (
      'admin','api','app','account','calendar','dashboard','help','login','logout',
      'new','pricing','privacy','rezervo','services','settings','setup','signin',
      'signup','static','support','terms'
    )
  );
end $$;

-- --------------------------- services --------------------------------
create table if not exists public.services (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  name             text not null check (char_length(trim(name)) between 2 and 80),
  duration_minutes int  not null check (duration_minutes between 5 and 480),
  price            int  not null default 0 check (price >= 0),      -- në Lek
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

create index if not exists services_business_id_idx on public.services (business_id);

-- --------------------------- bookings --------------------------------
create table if not exists public.bookings (
  id             uuid primary key default gen_random_uuid(),
  business_id    uuid not null references public.businesses (id) on delete cascade,
  service_id     uuid not null references public.services (id) on delete restrict,
  customer_name  text not null check (char_length(trim(customer_name)) between 2 and 80),
  customer_phone text not null check (customer_phone ~ '^\+3556[789]\d{7}$'),
  start_time     timestamptz not null,
  end_time       timestamptz not null,
  status         text not null default 'confirmed'
                   check (status in ('confirmed','cancelled','completed','no_show')),
  created_at     timestamptz not null default now(),

  constraint bookings_time_valid check (end_time > start_time),

  -- Mbrojtja kryesore kundër dy rezervimeve në të njëjtën orë (race condition).
  -- Zbatohet nga vetë Postgres, jo nga aplikacioni.
  constraint bookings_no_overlap exclude using gist (
    business_id with =,
    tstzrange(start_time, end_time) with &&
  ) where (status <> 'cancelled')
);

create index if not exists bookings_business_start_idx
  on public.bookings (business_id, start_time);

-- =====================================================================
--  2. ROW LEVEL SECURITY
--     Parimi: klienti publik NUK lexon dot tabelat direkt.
--     Çdo veprim publik kalon nëpër funksione SECURITY DEFINER (seksioni 3),
--     që kthejnë vetëm fushat e nevojshme dhe validojnë inputin.
-- =====================================================================

alter table public.businesses enable row level security;
alter table public.services   enable row level security;
alter table public.bookings   enable row level security;

-- ---- businesses: vetëm pronari
drop policy if exists "owner reads own business"   on public.businesses;
drop policy if exists "owner creates own business" on public.businesses;
drop policy if exists "owner updates own business" on public.businesses;
drop policy if exists "owner deletes own business" on public.businesses;

create policy "owner reads own business" on public.businesses
  for select to authenticated using (owner_id = (select auth.uid()));

create policy "owner creates own business" on public.businesses
  for insert to authenticated with check (owner_id = (select auth.uid()));

create policy "owner updates own business" on public.businesses
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "owner deletes own business" on public.businesses
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---- services: vetëm pronari i biznesit përkatës
drop policy if exists "owner reads own services"   on public.services;
drop policy if exists "owner writes own services"  on public.services;
drop policy if exists "owner updates own services" on public.services;
drop policy if exists "owner deletes own services" on public.services;

create policy "owner reads own services" on public.services
  for select to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
  );

create policy "owner writes own services" on public.services
  for insert to authenticated with check (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
  );

create policy "owner updates own services" on public.services
  for update to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
  );

create policy "owner deletes own services" on public.services
  for delete to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
  );

-- ---- bookings: vetëm pronari lexon/ndryshon.
--      Klienti publik krijon rezervim VETËM përmes rpc create_booking().
drop policy if exists "owner reads own bookings"   on public.bookings;
drop policy if exists "owner updates own bookings" on public.bookings;
drop policy if exists "owner deletes own bookings" on public.bookings;

create policy "owner reads own bookings" on public.bookings
  for select to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = bookings.business_id and b.owner_id = (select auth.uid()))
  );

create policy "owner updates own bookings" on public.bookings
  for update to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = bookings.business_id and b.owner_id = (select auth.uid()))
  ) with check (
    exists (select 1 from public.businesses b
            where b.id = bookings.business_id and b.owner_id = (select auth.uid()))
  );

create policy "owner deletes own bookings" on public.bookings
  for delete to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = bookings.business_id and b.owner_id = (select auth.uid()))
  );

-- =====================================================================
--  3. API PUBLIKE (SECURITY DEFINER)
--     Këto funksione janë e vetmja rrugë që ka faqja publike /[slug]
--     për të prekur bazën e të dhënave.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 3.1  Të dhënat publike të një biznesi + shërbimet aktive.
--      Nuk kthen owner_email / owner_id.
-- ---------------------------------------------------------------------
create or replace function public.get_public_business(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',            b.id,
    'name',          b.name,
    'slug',          b.slug,
    'phone',         b.phone,
    'working_hours', b.working_hours,
    'services',      coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'id',               s.id,
                 'name',             s.name,
                 'duration_minutes', s.duration_minutes,
                 'price',            s.price
               ) order by s.price asc, s.name asc
             )
      from public.services s
      where s.business_id = b.id and s.is_active
    ), '[]'::jsonb)
  )
  from public.businesses b
  where b.slug = lower(trim(p_slug));
$$;

-- ---------------------------------------------------------------------
-- 3.2  Orët e zëna për një biznes në një interval.
--      Kthen VETËM start/end — asnjë të dhënë personale të klientëve.
-- ---------------------------------------------------------------------
create or replace function public.get_taken_slots(
  p_business_id uuid,
  p_from        timestamptz,
  p_to          timestamptz
)
returns table (start_time timestamptz, end_time timestamptz)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select bk.start_time, bk.end_time
  from public.bookings bk
  where bk.business_id = p_business_id
    and bk.status <> 'cancelled'
    and bk.start_time < least(p_to, p_from + interval '31 days')
    and bk.end_time   > p_from
  order by bk.start_time;
$$;

-- ---------------------------------------------------------------------
-- 3.3  Kontroll nëse një slug është i lirë (për wizard-in e setup-it).
-- ---------------------------------------------------------------------
create or replace function public.is_slug_available(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select not exists (
    select 1 from public.businesses b where b.slug = lower(trim(p_slug))
  );
$$;

-- ---------------------------------------------------------------------
-- 3.4  Krijimi i rezervimit — e gjithë validimi ndodh këtu, në server.
--      Kthen: {ok: true, booking: {...}} ose {ok: false, error: "..."}.
--      Gabimet janë tekste shqip, gati për t'u shfaqur në UI.
-- ---------------------------------------------------------------------
create or replace function public.create_booking(
  p_slug           text,
  p_service_id     uuid,
  p_customer_name  text,
  p_customer_phone text,
  p_start_time     timestamptz
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business   public.businesses;
  v_service    public.services;
  v_end        timestamptz;
  v_local      timestamp;
  v_local_end  timestamp;
  v_dow        text;
  v_hours      jsonb;
  v_name       text := trim(p_customer_name);
  v_phone      text := regexp_replace(coalesce(p_customer_phone, ''), '[\s\-\(\)]', '', 'g');
  v_recent     int;
  v_booking    public.bookings;
begin
  -- --- Biznesi
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ky biznes nuk u gjet.');
  end if;

  -- --- Shërbimi (duhet t'i përkasë të njëjtit biznes dhe të jetë aktiv)
  select * into v_service
  from public.services
  where id = p_service_id and business_id = v_business.id and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ky shërbim nuk është më i disponueshëm.');
  end if;

  -- --- Emri
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'Ju lutem shkruani emrin tuaj të plotë.');
  end if;

  -- --- Telefoni (normalizim: 069..., 0069..., 3556..., +3556... -> +3556XXXXXXX)
  if v_phone ~ '^00355' then
    v_phone := '+' || substring(v_phone from 3);
  elsif v_phone ~ '^355' then
    v_phone := '+' || v_phone;
  elsif v_phone ~ '^0[67]' then
    v_phone := '+355' || substring(v_phone from 2);
  elsif v_phone ~ '^6[789]' then
    v_phone := '+355' || v_phone;
  end if;

  if v_phone !~ '^\+3556[789]\d{7}$' then
    return jsonb_build_object('ok', false,
      'error', 'Numri i telefonit nuk është i saktë. Shembull: 069 123 4567');
  end if;

  -- --- Ora e fillimit duhet të jetë në të ardhmen dhe brenda 60 ditëve
  if p_start_time < now() + interval '5 minutes' then
    return jsonb_build_object('ok', false, 'error', 'Kjo orë ka kaluar tashmë. Zgjidhni një orë tjetër.');
  end if;
  if p_start_time > now() + interval '60 days' then
    return jsonb_build_object('ok', false, 'error', 'Nuk mund të rezervoni kaq larg në kohë.');
  end if;

  -- --- Slot-et janë gjithmonë në hapa 30-minutësh nga ora e plotë
  if extract(epoch from p_start_time)::bigint % 1800 <> 0 then
    return jsonb_build_object('ok', false, 'error', 'Ora e zgjedhur nuk është e vlefshme.');
  end if;

  v_end       := p_start_time + make_interval(mins => v_service.duration_minutes);
  v_local     := p_start_time at time zone 'Europe/Tirane';
  v_local_end := v_end        at time zone 'Europe/Tirane';
  v_dow       := lower(to_char(v_local, 'FMday'));
  v_hours     := v_business.working_hours -> v_dow;

  -- --- A punon biznesi atë ditë?
  if v_hours is null or jsonb_typeof(v_hours) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'Biznesi është i mbyllur këtë ditë.');
  end if;

  -- --- A bie i gjithë shërbimi brenda orarit të punës (pa kaluar mesnatën)?
  if v_local::time < (v_hours ->> 'start')::time
     or v_local_end::date <> v_local::date
     or v_local_end::time > (v_hours ->> 'end')::time then
    return jsonb_build_object('ok', false, 'error', 'Kjo orë është jashtë orarit të punës.');
  end if;

  -- --- Mbrojtje bazike nga abuzimi: max 3 rezervime aktive për të njëjtin numër
  select count(*) into v_recent
  from public.bookings
  where business_id = v_business.id
    and customer_phone = v_phone
    and status = 'confirmed'
    and start_time > now();
  if v_recent >= 3 then
    return jsonb_build_object('ok', false,
      'error', 'Keni tashmë 3 rezervime aktive. Anuloni njërin për të bërë një tjetër.');
  end if;

  -- --- Insert. Constraint-i EXCLUDE kap çdo mbivendosje, edhe në garë.
  begin
    insert into public.bookings
      (business_id, service_id, customer_name, customer_phone, start_time, end_time, status)
    values
      (v_business.id, v_service.id, v_name, v_phone, p_start_time, v_end, 'confirmed')
    returning * into v_booking;
  exception
    when exclusion_violation then
      return jsonb_build_object('ok', false,
        'error', 'Kjo orë sapo u zu nga dikush tjetër. Ju lutem zgjidhni një orë tjetër.');
  end;

  return jsonb_build_object(
    'ok', true,
    'booking', jsonb_build_object(
      'id',            v_booking.id,
      'customer_name', v_booking.customer_name,
      'start_time',    v_booking.start_time,
      'end_time',      v_booking.end_time,
      'service_name',  v_service.name,
      'price',         v_service.price,
      'business_name', v_business.name
    )
  );
end;
$$;

-- =====================================================================
--  4. TË DREJTAT E EKZEKUTIMIT
-- =====================================================================
revoke all on function public.get_public_business(text)                    from public;
revoke all on function public.get_taken_slots(uuid, timestamptz, timestamptz) from public;
revoke all on function public.is_slug_available(text)                      from public;
revoke all on function public.create_booking(text, uuid, text, text, timestamptz) from public;

grant execute on function public.get_public_business(text)                    to anon, authenticated;
grant execute on function public.get_taken_slots(uuid, timestamptz, timestamptz) to anon, authenticated;
grant execute on function public.is_slug_available(text)                      to anon, authenticated;
grant execute on function public.create_booking(text, uuid, text, text, timestamptz) to anon, authenticated;
