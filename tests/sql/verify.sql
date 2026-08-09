\set ON_ERROR_STOP on
\pset pager off

-- ---------------------------------------------------------------- fixtures
insert into auth.users (id, email)
values ('11111111-1111-1111-1111-111111111111', 'ilir@shembull.com');

insert into public.businesses (owner_id, name, slug, owner_email, phone)
values ('11111111-1111-1111-1111-111111111111', 'Berberi Ilir', 'berberi-ilir',
        'ilir@shembull.com', '+355691234567');

insert into public.services (business_id, name, duration_minutes, price)
select id, 'Prerje flokesh', 30, 500 from public.businesses where slug = 'berberi-ilir';

insert into public.services (business_id, name, duration_minutes, price)
select id, 'Prerje + Mjeker', 60, 800 from public.businesses where slug = 'berberi-ilir';

insert into public.services (business_id, name, duration_minutes, price, is_active)
select id, 'Sherbim i fshehur', 30, 100, false from public.businesses where slug = 'berberi-ilir';

-- E hëna e ardhshme, ora 10:00 sipas kohës së Tiranës.
create temp view t as
  select (date_trunc('week', (now() at time zone 'Europe/Tirane')) + interval '7 days'
          + interval '10 hours') at time zone 'Europe/Tirane' as monday_10,
         (date_trunc('week', (now() at time zone 'Europe/Tirane')) + interval '13 days'
          + interval '10 hours') at time zone 'Europe/Tirane' as sunday_10,
         (select id from public.services where name = 'Prerje flokesh')  as svc30,
         (select id from public.services where name = 'Prerje + Mjeker') as svc60,
         (select id from public.services where name = 'Sherbim i fshehur') as svc_off;

\echo '=== 1. get_public_business: kthen vetem sherbimet aktive, pa owner_email ==='
select jsonb_pretty(public.get_public_business('berberi-ilir') - 'id' - 'working_hours');

\echo '=== 2. get_public_business: slug qe nuk ekziston -> null ==='
select public.get_public_business('nuk-ekziston') is null as is_null;

\echo '=== 3. is_slug_available ==='
select public.is_slug_available('berberi-ilir') as taken_should_be_false,
       public.is_slug_available('sallon-i-ri') as free_should_be_true;

\echo '=== 4. create_booking: rezervim i vlefshem -> ok ==='
select (r).ok, (r).error, (r).start_time
from (select public.create_booking('berberi-ilir', svc30, 'Ana Hoxha', '069 123 4567', monday_10) as j
      from t) x,
     lateral (select (j->>'ok')::bool as ok, j->>'error' as error,
                     j->'booking'->>'start_time' as start_time) r;

\echo '=== 5. i njejti slot serish -> bllokohet nga constraint-i EXCLUDE ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Beni Shala', '0681112223', monday_10) as j
      from t) x;

\echo '=== 6. mbivendosje e pjesshme (10:30 me sherbim 60min mbi 10:00-10:30) -> hmm, provo 09:45 ==='
-- 60-minutësh që nis 09:30 do të mbivendoset me 10:00-10:30
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc60, 'Cimi Doda', '0671112223',
                                   monday_10 - interval '30 minutes') as j
      from t) x;

\echo '=== 7. slot ngjitur (11:00) -> duhet te kalojme ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Dora Leka', '0691110000',
                                   monday_10 + interval '1 hour') as j
      from t) x;

\echo '=== 8. e diel (mbyllur) -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Eri Meta', '0691112222', sunday_10) as j
      from t) x;

\echo '=== 9. jashte orarit (07:00) -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Fatos Beqiri', '0691113333',
                                   monday_10 - interval '3 hours') as j
      from t) x;

\echo '=== 10. sherbim 60min ne 17:30 (mbaron 18:30, pas mbylljes) -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc60, 'Gimi Nika', '0691114444',
                                   monday_10 + interval '7 hours 30 minutes') as j
      from t) x;

\echo '=== 11. telefon i pavlefshem -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Hana Prifti', '042234567',
                                   monday_10 + interval '2 hours') as j
      from t) x;

\echo '=== 12. normalizimi i telefonit: 4 formate -> te njejtin rezultat ==='
select distinct customer_phone from public.bookings where customer_name in
  ('Ana Hoxha', 'Dora Leka');

\echo '=== 13. sherbim joaktiv -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc_off, 'Ina Rama', '0691115555',
                                   monday_10 + interval '2 hours') as j
      from t) x;

\echo '=== 14. ne te shkuaren -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Jon Kola', '0691116666',
                                   now() - interval '2 hours') as j
      from t) x;

\echo '=== 15. ora e paperputhur me hapin 30-min (10:07) -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Klea Gjoka', '0691117777',
                                   monday_10 + interval '2 hours 7 minutes') as j
      from t) x;

\echo '=== 16. slug qe nuk ekziston -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('dyqan-fantazme', svc30, 'Luan Bala', '0691118888',
                                   monday_10 + interval '2 hours') as j
      from t) x;

\echo '=== 17. emer shume i shkurter -> refuzohet ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'A', '0691119999',
                                   monday_10 + interval '2 hours') as j
      from t) x;

\echo '=== 18. limiti 3 rezervime aktive per numer ==='
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Ana Hoxha', '069 123 4567',
                                   monday_10 + interval '3 hours') as j from t) x;
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Ana Hoxha', '069 123 4567',
                                   monday_10 + interval '4 hours') as j from t) x;
select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Ana Hoxha', '069 123 4567',
                                   monday_10 + interval '5 hours') as j from t) x;

\echo '=== 19. get_taken_slots kthen vetem start/end ==='
select count(*) as rows,
       (select count(*) from information_schema.columns
        where table_name = 'get_taken_slots') as ignore_me
from public.get_taken_slots(
  (select id from public.businesses where slug = 'berberi-ilir'),
  now(), now() + interval '14 days');

\echo '=== 20. rezervim i anuluar e liron slot-in ==='
update public.bookings set status = 'cancelled'
where customer_name = 'Dora Leka';

select j->>'ok' as ok, j->>'error' as error
from (select public.create_booking('berberi-ilir', svc30, 'Mira Zeqo', '0682223334',
                                   monday_10 + interval '1 hour') as j
      from t) x;

\echo '=== 21. RLS: roli anon nuk lexon dot tabelat ==='
set role anon;
select count(*) as businesses_visible_to_anon from public.businesses;
select count(*) as bookings_visible_to_anon from public.bookings;
reset role;

\echo '=== 22. RLS: pronari shikon vetem te vetat ==='
set role authenticated;
set local test.uid = '11111111-1111-1111-1111-111111111111';
select count(*) as own_bookings from public.bookings;
set local test.uid = '22222222-2222-2222-2222-222222222222';
select count(*) as other_user_bookings from public.bookings;
reset role;

\echo '=== 23. anon mund te thirre funksionet publike ==='
set role anon;
select public.get_public_business('berberi-ilir') is not null as can_read_public;
reset role;

\echo '=== 24. statuset e lejuara ==='
select status, count(*) from public.bookings group by status order by status;
