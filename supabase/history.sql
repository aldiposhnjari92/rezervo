-- =====================================================================
--  Rezervo.al — Një rezervim i kaluar është histori, jo axhendë
--  Ekzekutohet pas suspension.sql. Idempotent.
--
--  Ora e një rezervimi ka kaluar. Çfarë mund të bëhet me të?
--
--    LEJOHET   ta shënosh se çfarë ndodhi: "Erdhi" ose "Nuk erdhi".
--              Edhe anulimi — një rresht i futur gabimisht duhet të hiqet
--              nga llogaritë.
--
--    NDALOHET  ta rikthesh në "Konfirmuar". Ai status do të thotë "pritet të
--              ndodhë", dhe një gjë që ka kaluar nuk pritet më. Përndryshe
--              paneli do të tregonte rezervime "në pritje" për javën e shkuar
--              dhe të ardhurat do të numëronin takime që s'ndodhën kurrë.
--
--    NDALOHET  t'i zhvendosësh ose zgjatësh orën. E kaluara nuk riorganizohet;
--              nëse duhet një takim tjetër, shtohet një rezervim i ri.
--
--  Në bazë e jo te aplikacioni, për të njëjtën arsye si gjithçka tjetër këtu:
--  çelësi `anon` është publik dhe PostgREST-i pranon kërkesa direkt.
-- =====================================================================

/**
 * Kodi `RZ001` e dallon këtë ndalim nga çdo gabim tjetër, që aplikacioni t'i
 * japë pronarit një shpjegim e jo një "provo sërish".
 */
create or replace function public.bookings_past_is_final()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.start_time >= now() then
    return new;   -- ende në të ardhmen: pa kufizime
  end if;

  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    raise exception 'Një rezervim që ka kaluar nuk rikthehet dot në pritje.'
      using errcode = 'RZ001';
  end if;

  if new.start_time is distinct from old.start_time
     or new.end_time is distinct from old.end_time then
    raise exception 'Ora e një rezervimi që ka kaluar nuk ndryshohet dot.'
      using errcode = 'RZ001';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_past_is_final on public.bookings;
create trigger bookings_past_is_final
  before update on public.bookings
  for each row execute function public.bookings_past_is_final();

-- Trigger-at nuk janë endpoint-e; PostgREST-i i ekspozon thjesht sepse ekzistojnë.
revoke all on function public.bookings_past_is_final() from public, anon, authenticated;
