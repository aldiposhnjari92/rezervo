-- =====================================================================
--  A është vërtet "vetëm lexim" një biznes i pezulluar?
--
--  Provohet kundër RLS-së, jo kundër aplikacionit: nëse policy-t nuk e ndalin
--  shkrimin, s'ka rëndësi çfarë bën Next-i, sepse çelësi `anon` është publik
--  dhe PostgREST-i pranon kërkesa direkt.
--
--  Drejtohet pas prelude + schema + admin + features + shell + security +
--  suspension. Shih tests/README.md.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

create or replace function pg_temp.check(p_label text, p_cond boolean, p_detail text default '')
returns void language plpgsql as $$
begin
  if p_cond then
    raise notice '  ok   %', p_label;
  else
    raise warning '  FAIL % %', p_label, p_detail;
  end if;
end;
$$;

-- --------------------------------------------------------------- setup ---
delete from public.bookings;
delete from public.business_closures;
delete from public.services;
delete from public.businesses;
delete from auth.users;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'aktiv@test.al'),
  ('22222222-2222-2222-2222-222222222222', 'pezull@test.al');

insert into public.businesses (id, name, slug, owner_id, owner_email, working_hours)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Aktivi', 'aktivi',
   '11111111-1111-1111-1111-111111111111', 'aktiv@test.al',
   '{"monday":{"start":"09:00","end":"18:00"},"tuesday":{"start":"09:00","end":"18:00"},"wednesday":null,"thursday":null,"friday":null,"saturday":null,"sunday":null}'::jsonb),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Pezulli', 'pezulli',
   '22222222-2222-2222-2222-222222222222', 'pezull@test.al',
   '{"monday":{"start":"09:00","end":"18:00"},"tuesday":{"start":"09:00","end":"18:00"},"wednesday":null,"thursday":null,"friday":null,"saturday":null,"sunday":null}'::jsonb);

insert into public.services (id, business_id, name, duration_minutes, price) values
  ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Prerje', 30, 500),
  ('cccccccc-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002', 'Prerje', 30, 500);

insert into public.bookings (id, business_id, service_id, customer_name, customer_phone,
                             start_time, end_time, status)
values ('dddddddd-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000002',
        'cccccccc-0000-0000-0000-000000000002', 'Ana Hoxha', '+355691112233',
        '2026-09-07T08:00:00Z', '2026-09-07T08:30:00Z', 'confirmed');

-- Pezullimi bëhet si admin do ta bënte: direkt, pa kaluar nga policy-t.
update public.businesses
   set suspended_at = now(), suspended_reason = 'Provë'
 where id = 'bbbbbbbb-0000-0000-0000-000000000002';

do $$ begin raise notice ''; raise notice '=== 1. Pronari i pezulluar vazhdon të LEXOJË ==='; end $$;

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;

select pg_temp.check('sheh biznesin e vet',
  (select count(*) from public.businesses) = 1);
select pg_temp.check('sheh shërbimet e veta',
  (select count(*) from public.services) = 1);
select pg_temp.check('sheh rezervimet e veta',
  (select count(*) from public.bookings) = 1);

do $$ begin raise notice ''; raise notice '=== 2. Por nuk SHKRUAN asgjë ==='; end $$;

-- Nën RLS një shkrim i ndaluar nuk bërtet: thjesht nuk prek asnjë rresht.
-- Prandaj numërohen rreshtat e prekur, jo përjashtimet.
do $$
declare n int;
begin
  begin
    insert into public.services (business_id, name, duration_minutes, price)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'I ri', 30, 700);
    perform pg_temp.check('nuk shton dot shërbim', false, '(kaloi pa u bllokuar)');
  exception when insufficient_privilege then
    perform pg_temp.check('nuk shton dot shërbim', true);
  end;

  update public.services set price = 999
   where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.check('nuk ndryshon dot çmimin', n = 0, '(prekur ' || n || ' rreshta)');

  update public.services set is_active = false
   where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.check('nuk çaktivizon dot shërbimin', n = 0, '(prekur ' || n || ')');

  delete from public.services where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.check('nuk fshin dot shërbimin', n = 0, '(prekur ' || n || ')');

  update public.bookings set status = 'cancelled'
   where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.check('nuk ndryshon dot statusin e rezervimit', n = 0, '(prekur ' || n || ')');

  update public.businesses set name = 'Emër i ri'
   where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.check('nuk riemërton dot biznesin', n = 0, '(prekur ' || n || ')');

  update public.businesses set buffer_minutes = 45
   where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.check('nuk ndryshon dot rregullat e rezervimit', n = 0, '(prekur ' || n || ')');

  begin
    insert into public.business_closures (business_id, closed_on, reason)
    values ('bbbbbbbb-0000-0000-0000-000000000002', '2026-12-25', 'Festë');
    perform pg_temp.check('nuk shton dot ditë të mbyllur', false, '(kaloi pa u bllokuar)');
  exception when insufficient_privilege then
    perform pg_temp.check('nuk shton dot ditë të mbyllur', true);
  end;
end $$;

do $$ begin raise notice ''; raise notice '=== 3. Rezervimi me dorë refuzohet me mesazh, jo me gabim ==='; end $$;

select pg_temp.check('owner_create_booking refuzon',
  (public.owner_create_booking('cccccccc-0000-0000-0000-000000000002', 'Beni Shala', '',
                               '2026-09-07T10:00:00Z') ->> 'ok') = 'false');
select pg_temp.check('mesazhi shpjegon pezullimin',
  (public.owner_create_booking('cccccccc-0000-0000-0000-000000000002', 'Beni Shala', '',
                               '2026-09-07T10:00:00Z') ->> 'error') like '%pezulluar%');

do $$ begin raise notice ''; raise notice '=== 4. Biznesi aktiv nuk preket fare ==='; end $$;

reset role;
select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

do $$
declare n int;
begin
  insert into public.services (business_id, name, duration_minutes, price)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'I ri', 30, 700);
  perform pg_temp.check('shton shërbim', true);

  update public.services set price = 999
   where business_id = 'aaaaaaaa-0000-0000-0000-000000000001' and name = 'Prerje';
  get diagnostics n = row_count;
  perform pg_temp.check('ndryshon çmimin', n = 1, '(prekur ' || n || ')');

  update public.businesses set name = 'Aktivi i ri'
   where id = 'aaaaaaaa-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  perform pg_temp.check('riemërton biznesin', n = 1, '(prekur ' || n || ')');

  insert into public.business_closures (business_id, closed_on, reason)
  values ('aaaaaaaa-0000-0000-0000-000000000001', '2026-12-25', 'Festë');
  perform pg_temp.check('shton ditë të mbyllur', true);
end $$;

select pg_temp.check('owner_create_booking pranon',
  (public.owner_create_booking('cccccccc-0000-0000-0000-000000000001', 'Beni Shala', '',
                               '2026-09-07T10:00:00Z') ->> 'ok') = 'true');

do $$ begin raise notice ''; raise notice '=== 5. Rikthimi e kthen shkrimin ==='; end $$;

reset role;
update public.businesses set suspended_at = null, suspended_reason = null
 where id = 'bbbbbbbb-0000-0000-0000-000000000002';

select set_config('test.uid', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;

do $$
declare n int;
begin
  update public.services set price = 777
   where business_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.check('pas rikthimit ndryshon çmimin', n = 1, '(prekur ' || n || ')');

  update public.businesses set name = 'Pezulli i kthyer'
   where id = 'bbbbbbbb-0000-0000-0000-000000000002';
  get diagnostics n = row_count;
  perform pg_temp.check('pas rikthimit riemërton biznesin', n = 1, '(prekur ' || n || ')');
end $$;

reset role;
