-- =====================================================================
--  Një rezervim i kaluar nuk rikthehet dhe nuk zhvendoset.
--  Drejtohet pas prelude + schema + admin + features + shell + security +
--  suspension + history.
-- =====================================================================
\set ON_ERROR_STOP off
\pset pager off

create or replace function pg_temp.check(p_label text, p_cond boolean, p_detail text default '')
returns void language plpgsql as $$
begin
  if p_cond then raise notice '  ok   %', p_label;
  else raise warning '  FAIL % %', p_label, p_detail; end if;
end;
$$;

delete from public.bookings;
delete from public.services;
delete from public.businesses;
delete from auth.users;

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'pronar@test.al');

insert into public.businesses (id, name, slug, owner_id, owner_email, working_hours)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Berberi', 'berberi',
        '11111111-1111-1111-1111-111111111111', 'pronar@test.al',
        '{"monday":{"start":"09:00","end":"18:00"},"tuesday":{"start":"09:00","end":"18:00"},"wednesday":{"start":"09:00","end":"18:00"},"thursday":{"start":"09:00","end":"18:00"},"friday":{"start":"09:00","end":"18:00"},"saturday":null,"sunday":null}'::jsonb);

insert into public.services (id, business_id, name, duration_minutes, price)
values ('cccccccc-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001',
        'Prerje', 30, 500);

-- Dy rezervime: një i djeshëm, një i nesërm.
insert into public.bookings (id, business_id, service_id, customer_name, customer_phone,
                             start_time, end_time, status)
values
  ('dddddddd-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', 'Ana Hoxha', '+355691112233',
   now() - interval '1 day', now() - interval '1 day' + interval '30 min', 'confirmed'),
  ('dddddddd-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001',
   'cccccccc-0000-0000-0000-000000000001', 'Beni Shala', '+355681112233',
   now() + interval '1 day', now() + interval '1 day' + interval '30 min', 'confirmed');

select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

do $$ begin raise notice ''; raise notice '=== 1. E kaluara: shënimi i asaj që ndodhi lejohet ==='; end $$;

do $$
declare n int;
begin
  update public.bookings set status = 'completed'
   where id = 'dddddddd-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.check('shënohet si "Erdhi"', n = 1, '(prekur ' || n || ')');

  update public.bookings set status = 'no_show'
   where id = 'dddddddd-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.check('shënohet si "Nuk erdhi"', n = 1, '(prekur ' || n || ')');

  update public.bookings set status = 'cancelled'
   where id = 'dddddddd-0000-0000-0000-00000000000a';
  get diagnostics n = row_count;
  perform pg_temp.check('anulohet (rresht i futur gabimisht)', n = 1, '(prekur ' || n || ')');
end $$;

do $$ begin raise notice ''; raise notice '=== 2. Por nuk rikthehet dhe nuk zhvendoset ==='; end $$;

do $$
begin
  begin
    update public.bookings set status = 'confirmed'
     where id = 'dddddddd-0000-0000-0000-00000000000a';
    perform pg_temp.check('nuk rikthehet dot në "Konfirmuar"', false, '(kaloi pa u bllokuar)');
  exception when sqlstate 'RZ001' then
    perform pg_temp.check('nuk rikthehet dot në "Konfirmuar"', true);
  end;

  begin
    update public.bookings set start_time = now() + interval '2 days'
     where id = 'dddddddd-0000-0000-0000-00000000000a';
    perform pg_temp.check('nuk zhvendoset dot ora e nisjes', false, '(kaloi pa u bllokuar)');
  exception when sqlstate 'RZ001' then
    perform pg_temp.check('nuk zhvendoset dot ora e nisjes', true);
  end;

  begin
    update public.bookings set end_time = now() + interval '3 days'
     where id = 'dddddddd-0000-0000-0000-00000000000a';
    perform pg_temp.check('nuk zgjatet dot', false, '(kaloi pa u bllokuar)');
  exception when sqlstate 'RZ001' then
    perform pg_temp.check('nuk zgjatet dot', true);
  end;
end $$;

select pg_temp.check('statusi mbeti i anuluar',
  (select status from public.bookings where id = 'dddddddd-0000-0000-0000-00000000000a') = 'cancelled');

do $$ begin raise notice ''; raise notice '=== 3. E ardhmja mbetet plotësisht e lirë ==='; end $$;

do $$
declare n int;
begin
  update public.bookings set status = 'cancelled'
   where id = 'dddddddd-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  perform pg_temp.check('anulohet', n = 1, '(prekur ' || n || ')');

  update public.bookings set status = 'confirmed'
   where id = 'dddddddd-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  perform pg_temp.check('rikthehet në "Konfirmuar"', n = 1, '(prekur ' || n || ')');

  update public.bookings
     set start_time = now() + interval '3 days',
         end_time   = now() + interval '3 days' + interval '30 min'
   where id = 'dddddddd-0000-0000-0000-00000000000b';
  get diagnostics n = row_count;
  perform pg_temp.check('zhvendoset në një orë tjetër', n = 1, '(prekur ' || n || ')');
end $$;

do $$ begin raise notice ''; raise notice '=== 4. Kufiri është ora e nisjes, jo dita ==='; end $$;

reset role;
update public.bookings
   set start_time = now() - interval '5 minutes',
       end_time   = now() + interval '25 minutes',
       status     = 'cancelled'
 where id = 'dddddddd-0000-0000-0000-00000000000b';

select set_config('test.uid', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

do $$
begin
  begin
    update public.bookings set status = 'confirmed'
     where id = 'dddddddd-0000-0000-0000-00000000000b';
    perform pg_temp.check('një takim që sapo nisi nuk rikthehet', false, '(kaloi pa u bllokuar)');
  exception when sqlstate 'RZ001' then
    perform pg_temp.check('një takim që sapo nisi nuk rikthehet', true);
  end;
end $$;

reset role;
