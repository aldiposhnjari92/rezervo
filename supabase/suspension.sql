-- =====================================================================
--  Rezervo.al — Biznesi i pezulluar është VETËM PËR LEXIM
--  Ekzekutohet i fundit:
--    schema.sql -> admin.sql -> features.sql -> shell.sql -> security.sql
--                                                         -> suspension.sql
--  Idempotent.
--
--  Deri tani pezullimi ndalonte vetëm anën publike: faqja e biznesit zhdukej
--  dhe `create_booking()` refuzonte. Pronari nga ana tjetër vazhdonte të
--  shtonte shërbime, të ndryshonte orarin dhe të fuste rezervime me dorë.
--
--  Rregulli tani: kur `suspended_at` nuk është null, pronari LEXON gjithçka
--  dhe nuk SHKRUAN asgjë.
--
--  Pse në bazë e jo te server action-et: çelësi `anon` është publik dhe
--  PostgREST-i pranon kërkesa direkt. Një kontroll te Next-i anashkalohet
--  thjesht duke mos kaluar nga Next-i.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Ndihmësi
-- ---------------------------------------------------------------------

/**
 * A pranon shkrime ky biznes?
 *
 * SECURITY DEFINER që përgjigjja të mos varet nga policy-t e tabelës
 * `businesses` — përdoret BRENDA atyre policy-ve dhe një varësi rrethore do të
 * ishte e vështirë të lexohej. Nuk zbulon asgjë të fshehtë: faqja publike e
 * tregon vetë gjendjen duke u shuar.
 */
create or replace function public.business_accepts_writes(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.businesses b
    where b.id = p_business_id and b.suspended_at is null
  );
$$;

revoke all on function public.business_accepts_writes(uuid) from public, anon;
grant execute on function public.business_accepts_writes(uuid) to authenticated;

-- ---------------------------------------------------------------------
--  2. Shërbimet — lexohen gjithmonë, shkruhen vetëm kur biznesi është aktiv
-- ---------------------------------------------------------------------

drop policy if exists "owner writes own services"  on public.services;
drop policy if exists "owner updates own services" on public.services;
drop policy if exists "owner deletes own services" on public.services;

create policy "owner writes own services" on public.services
  for insert to authenticated with check (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(services.business_id)
  );

create policy "owner updates own services" on public.services
  for update to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(services.business_id)
  ) with check (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(services.business_id)
  );

create policy "owner deletes own services" on public.services
  for delete to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = services.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(services.business_id)
  );

-- ---------------------------------------------------------------------
--  3. Rezervimet — as ndryshim statusi, as fshirje
-- ---------------------------------------------------------------------

drop policy if exists "owner updates own bookings" on public.bookings;
drop policy if exists "owner deletes own bookings" on public.bookings;

create policy "owner updates own bookings" on public.bookings
  for update to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = bookings.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(bookings.business_id)
  ) with check (
    exists (select 1 from public.businesses b
            where b.id = bookings.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(bookings.business_id)
  );

create policy "owner deletes own bookings" on public.bookings
  for delete to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = bookings.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(bookings.business_id)
  );

-- ---------------------------------------------------------------------
--  4. Ditët e mbyllura
--
--  Ishte një policy e vetme `for all`. Ndahet: leximi mbetet i lirë, shkrimi jo.
-- ---------------------------------------------------------------------

drop policy if exists "owner manages closures" on public.business_closures;
drop policy if exists "owner reads closures"   on public.business_closures;
drop policy if exists "owner writes closures"  on public.business_closures;
drop policy if exists "owner removes closures" on public.business_closures;

create policy "owner reads closures" on public.business_closures
  for select to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = business_closures.business_id and b.owner_id = (select auth.uid()))
  );

create policy "owner writes closures" on public.business_closures
  for insert to authenticated with check (
    exists (select 1 from public.businesses b
            where b.id = business_closures.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(business_closures.business_id)
  );

create policy "owner removes closures" on public.business_closures
  for delete to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = business_closures.business_id and b.owner_id = (select auth.uid()))
    and public.business_accepts_writes(business_closures.business_id)
  );

-- ---------------------------------------------------------------------
--  5. Vetë biznesi — emri, telefoni, orari dhe rregullat e rezervimit
--
--  Admini nuk preket: `admin_set_suspended()` është SECURITY DEFINER dhe nuk
--  kalon fare nga RLS-ja. Përndryshe pezullimi nuk do të hiqej dot më kurrë.
-- ---------------------------------------------------------------------

drop policy if exists "owner updates own business" on public.businesses;

create policy "owner updates own business" on public.businesses
  for update to authenticated
  using (owner_id = (select auth.uid()) and suspended_at is null)
  with check (owner_id = (select auth.uid()) and suspended_at is null);

-- ---------------------------------------------------------------------
--  6. Rezervimet me dorë (telefon / walk-in)
--
--  Kalon nga një funksion SECURITY DEFINER, ndaj RLS-ja nuk e ndal — kontrolli
--  duhet brenda vetë funksionit.
-- ---------------------------------------------------------------------

create or replace function public.owner_create_booking(
  p_service_id uuid, p_customer_name text, p_customer_phone text,
  p_start_time timestamptz, p_note text default null)
returns jsonb language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_bid uuid := public.my_business_id();
  v_service public.services; v_end timestamptz; v_booking public.bookings;
  v_name text := trim(p_customer_name);
  v_phone text := nullif(regexp_replace(coalesce(p_customer_phone, ''), '[\s\-\(\)]', '', 'g'), '');
begin
  if v_bid is null then
    raise exception 'Nuk keni biznes.' using errcode = '42501';
  end if;

  if not public.business_accepts_writes(v_bid) then
    return jsonb_build_object('ok', false,
      'error', 'Llogaria jote është e pezulluar. Mund të shohësh të dhënat, por jo t''i ndryshosh.');
  end if;

  select * into v_service from public.services where id = p_service_id and business_id = v_bid;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Shërbimi nuk u gjet.');
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'Shkruaj emrin e klientit.');
  end if;

  if v_phone is not null then
    if v_phone ~ '^00355' then v_phone := '+' || substring(v_phone from 3);
    elsif v_phone ~ '^355' then v_phone := '+' || v_phone;
    elsif v_phone ~ '^0[67]' then v_phone := '+355' || substring(v_phone from 2);
    elsif v_phone ~ '^6[789]' then v_phone := '+355' || v_phone;
    end if;
    if v_phone !~ '^\+3556[789]\d{7}$' then
      return jsonb_build_object('ok', false, 'error', 'Numri i telefonit nuk është i saktë.');
    end if;
  end if;

  v_end := p_start_time + make_interval(mins => v_service.duration_minutes);

  begin
    insert into public.bookings (business_id, service_id, customer_name, customer_phone,
                                 start_time, end_time, status, created_by, note)
    values (v_bid, v_service.id, v_name, v_phone, p_start_time, v_end, 'confirmed', 'owner',
            nullif(trim(coalesce(p_note, '')), ''))
    returning * into v_booking;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false, 'error', 'Kjo orë përplaset me një rezervim ekzistues.');
  end;

  return jsonb_build_object('ok', true, 'booking', to_jsonb(v_booking));
end;
$$;

revoke all on function public.owner_create_booking(uuid, text, text, timestamptz, text) from public, anon;
grant execute on function public.owner_create_booking(uuid, text, text, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------
--  Çfarë MBETET e lejuar me qëllim
--
--  - Leximi i gjithçkaje: paneli, kalendari, klientët, rregullimet.
--  - Fshirja e llogarisë (`delete_my_account`): pezullimi nuk e burgos njeriun
--    brenda platformës. Ajo është SECURITY DEFINER, ndaj nuk preket nga sa më sipër.
--  - Njoftimet: shënimi si të lexuara nuk është ndryshim i të dhënave të biznesit.
-- ---------------------------------------------------------------------
