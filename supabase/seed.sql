-- =====================================================================
--  Rezervo.al — të dhëna shembull (opsionale)
--
--  PARAKUSHT: regjistrohu një herë në aplikacion (/login -> Regjistrohu)
--  dhe kalo nga wizard-i i setup-it. Pastaj zëvendëso email-in më poshtë
--  dhe ekzekuto këtë skedar në SQL Editor.
--
--  Shton shërbime shembull + disa rezervime nesër, që të shohësh
--  dashboard-in dhe faqen publike me të dhëna të vërteta.
-- =====================================================================

do $$
declare
  v_business_id uuid;
  v_service_id  uuid;
  v_tomorrow    timestamptz;
  -- ↓↓↓ ZËVENDËSO KËTU ↓↓↓
  v_email       text := 'emri@shembull.com';
begin
  select b.id into v_business_id
  from public.businesses b
  join auth.users u on u.id = b.owner_id
  where u.email = v_email;

  if v_business_id is null then
    raise exception
      'Nuk u gjet biznes për "%". Regjistrohu dhe kalo nga setup-i, pastaj provo sërish.', v_email;
  end if;

  -- ------------------------------------------------------------ shërbimet
  insert into public.services (business_id, name, duration_minutes, price)
  values
    (v_business_id, 'Prerje flokësh',        30,  500),
    (v_business_id, 'Prerje + Mjekër',       60,  800),
    (v_business_id, 'Rregullim mjekre',      15,  300),
    (v_business_id, 'Larje + Stilim',        45,  700),
    (v_business_id, 'Prerje për fëmijë',     30,  400)
  on conflict do nothing;

  select id into v_service_id
  from public.services
  where business_id = v_business_id and name = 'Prerje flokësh';

  -- ------------------------------------------------- rezervime për nesër
  -- Nesër në 10:00 dhe 11:30, sipas kohës së Tiranës.
  v_tomorrow := (((now() at time zone 'Europe/Tirane')::date + 1) + time '10:00')
                  at time zone 'Europe/Tirane';

  insert into public.bookings
    (business_id, service_id, customer_name, customer_phone, start_time, end_time, status)
  values
    (v_business_id, v_service_id, 'Ana Hoxha',  '+355691234567',
     v_tomorrow, v_tomorrow + interval '30 minutes', 'confirmed'),
    (v_business_id, v_service_id, 'Beni Shala', '+355681112223',
     v_tomorrow + interval '90 minutes', v_tomorrow + interval '120 minutes', 'confirmed')
  on conflict do nothing;

  raise notice 'Të dhënat shembull u shtuan për biznesin %', v_business_id;
end $$;
