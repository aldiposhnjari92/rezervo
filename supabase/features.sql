-- =====================================================================
--  Rezervo.al — Rregullat e rezervimit, mbylljet, walk-in-et, analitika
--  Ekzekutohet i TRETI: schema.sql -> admin.sql -> features.sql
--
--  Ky skedar përmban versionin PËRFUNDIMTAR të `get_public_business()` dhe
--  `create_booking()` — mbishkruan ato të skedarëve të mëparshëm. Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Rregullat e rezervimit (për çdo biznes)
-- ---------------------------------------------------------------------
alter table public.businesses add column if not exists buffer_minutes       int not null default 0;
alter table public.businesses add column if not exists min_notice_minutes   int not null default 30;
alter table public.businesses add column if not exists booking_window_days  int not null default 30;
-- Bazat e krijuara para se dritarja të zgjatej e mbajnë ende 7-shen si parazgjedhje.
alter table public.businesses alter column booking_window_days set default 30;
alter table public.businesses add column if not exists break_start          time;
alter table public.businesses add column if not exists break_end            time;

do $$ begin
  alter table public.businesses drop constraint if exists businesses_buffer_valid;
  alter table public.businesses add  constraint businesses_buffer_valid
    check (buffer_minutes between 0 and 120);

  alter table public.businesses drop constraint if exists businesses_notice_valid;
  alter table public.businesses add  constraint businesses_notice_valid
    check (min_notice_minutes between 0 and 10080);

  alter table public.businesses drop constraint if exists businesses_window_valid;
  alter table public.businesses add  constraint businesses_window_valid
    check (booking_window_days between 1 and 60);

  alter table public.businesses drop constraint if exists businesses_break_valid;
  alter table public.businesses add  constraint businesses_break_valid check (
    (break_start is null and break_end is null)
    or (break_start is not null and break_end is not null and break_end > break_start)
  );
end $$;

-- ---------------------------------------------------------------------
--  2. Ditët e mbyllura (festa, pushime)
-- ---------------------------------------------------------------------
create table if not exists public.business_closures (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  closed_on   date not null,
  reason      text check (reason is null or char_length(reason) <= 120),
  created_at  timestamptz not null default now(),
  unique (business_id, closed_on)
);

create index if not exists business_closures_lookup
  on public.business_closures (business_id, closed_on);

alter table public.business_closures enable row level security;

drop policy if exists "owner manages closures" on public.business_closures;
drop policy if exists "admin reads closures"   on public.business_closures;

create policy "owner manages closures" on public.business_closures
  for all to authenticated
  using (exists (select 1 from public.businesses b
                 where b.id = business_closures.business_id and b.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.businesses b
                 where b.id = business_closures.business_id and b.owner_id = (select auth.uid())));

create policy "admin reads closures" on public.business_closures
  for select to authenticated using (public.is_platform_admin());

-- ---------------------------------------------------------------------
--  3. Rezervime të shtuara nga pronari (telefon / walk-in)
--     Për një walk-in shpesh s'ka numër telefoni, ndaj bëhet opsional.
-- ---------------------------------------------------------------------
alter table public.bookings alter column customer_phone drop not null;
alter table public.bookings add column if not exists created_by text not null default 'customer';
alter table public.bookings add column if not exists note text;

do $$ begin
  alter table public.bookings drop constraint if exists bookings_created_by_valid;
  alter table public.bookings add  constraint bookings_created_by_valid
    check (created_by in ('customer', 'owner'));

  alter table public.bookings drop constraint if exists bookings_note_len;
  alter table public.bookings add  constraint bookings_note_len
    check (note is null or char_length(note) <= 300);
end $$;

-- ---------------------------------------------------------------------
--  4. Të dhënat publike — tani përfshijnë rregullat dhe mbylljet
-- ---------------------------------------------------------------------
create or replace function public.get_public_business(p_slug text)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug, 'phone', b.phone,
    'working_hours', b.working_hours,
    'buffer_minutes', b.buffer_minutes,
    'min_notice_minutes', b.min_notice_minutes,
    'booking_window_days', b.booking_window_days,
    'break_start', to_char(b.break_start, 'HH24:MI'),
    'break_end',   to_char(b.break_end, 'HH24:MI'),
    'closures', coalesce((
      select jsonb_agg(c.closed_on order by c.closed_on)
      from public.business_closures c
      where c.business_id = b.id
        and c.closed_on >= (now() at time zone 'Europe/Tirane')::date
        and c.closed_on <= (now() at time zone 'Europe/Tirane')::date + b.booking_window_days
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes, 'price', s.price
      ) order by s.price asc, s.name asc)
      from public.services s where s.business_id = b.id and s.is_active
    ), '[]'::jsonb)
  )
  from public.businesses b
  where b.slug = lower(trim(p_slug)) and b.suspended_at is null;
$$;

-- ---------------------------------------------------------------------
--  5. Rezervimi publik — zbaton rregullat, pushimin dhe mbylljet
-- ---------------------------------------------------------------------
create or replace function public.create_booking(
  p_slug text, p_service_id uuid, p_customer_name text,
  p_customer_phone text, p_start_time timestamptz)
returns jsonb language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare
  v_business public.businesses; v_service public.services;
  v_end timestamptz; v_local timestamp; v_local_end timestamp;
  v_dow text; v_hours jsonb;
  v_name text := trim(p_customer_name);
  v_phone text := regexp_replace(coalesce(p_customer_phone, ''), '[\s\-\(\)]', '', 'g');
  v_recent int; v_booking public.bookings;
begin
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ky biznes nuk u gjet.');
  end if;
  if v_business.suspended_at is not null then
    return jsonb_build_object('ok', false, 'error', 'Ky biznes nuk pranon rezervime për momentin.');
  end if;

  select * into v_service from public.services
  where id = p_service_id and business_id = v_business.id and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ky shërbim nuk është më i disponueshëm.');
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'Ju lutem shkruani emrin tuaj të plotë.');
  end if;

  if v_phone ~ '^00355' then v_phone := '+' || substring(v_phone from 3);
  elsif v_phone ~ '^355' then v_phone := '+' || v_phone;
  elsif v_phone ~ '^0[67]' then v_phone := '+355' || substring(v_phone from 2);
  elsif v_phone ~ '^6[789]' then v_phone := '+355' || v_phone;
  end if;
  if v_phone !~ '^\+3556[789]\d{7}$' then
    return jsonb_build_object('ok', false,
      'error', 'Numri i telefonit nuk është i saktë. Shembull: 069 123 4567');
  end if;

  -- Njoftimi minimal dhe dritarja e rezervimit vijnë nga rregullat e biznesit.
  if p_start_time < now() + make_interval(mins => v_business.min_notice_minutes) then
    return jsonb_build_object('ok', false,
      'error', 'Kjo orë është shumë afër. Zgjidhni një orë më vonë.');
  end if;
  if p_start_time > now() + make_interval(days => v_business.booking_window_days + 1) then
    return jsonb_build_object('ok', false, 'error', 'Nuk mund të rezervoni kaq larg në kohë.');
  end if;
  if extract(epoch from p_start_time)::bigint % 1800 <> 0 then
    return jsonb_build_object('ok', false, 'error', 'Ora e zgjedhur nuk është e vlefshme.');
  end if;

  v_end := p_start_time + make_interval(mins => v_service.duration_minutes);
  v_local := p_start_time at time zone 'Europe/Tirane';
  v_local_end := v_end at time zone 'Europe/Tirane';
  v_dow := lower(to_char(v_local, 'FMday'));
  v_hours := v_business.working_hours -> v_dow;

  if v_hours is null or jsonb_typeof(v_hours) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'Biznesi është i mbyllur këtë ditë.');
  end if;
  if v_local::time < (v_hours ->> 'start')::time
     or v_local_end::date <> v_local::date
     or v_local_end::time > (v_hours ->> 'end')::time then
    return jsonb_build_object('ok', false, 'error', 'Kjo orë është jashtë orarit të punës.');
  end if;

  if exists (select 1 from public.business_closures c
             where c.business_id = v_business.id and c.closed_on = v_local::date) then
    return jsonb_build_object('ok', false, 'error', 'Biznesi është i mbyllur këtë datë.');
  end if;

  if v_business.break_start is not null
     and v_local::time < v_business.break_end
     and v_local_end::time > v_business.break_start then
    return jsonb_build_object('ok', false, 'error', 'Kjo orë bie mbi pushimin e ditës.');
  end if;

  -- Buffer-i zbatohet duke zgjeruar rezervimet ekzistuese në të dyja anët.
  if exists (
    select 1 from public.bookings k
    where k.business_id = v_business.id and k.status <> 'cancelled'
      and tstzrange(k.start_time - make_interval(mins => v_business.buffer_minutes),
                    k.end_time   + make_interval(mins => v_business.buffer_minutes))
          && tstzrange(p_start_time, v_end)
  ) then
    return jsonb_build_object('ok', false,
      'error', 'Kjo orë sapo u zu nga dikush tjetër. Ju lutem zgjidhni një orë tjetër.');
  end if;

  select count(*) into v_recent from public.bookings
  where business_id = v_business.id and customer_phone = v_phone
    and status = 'confirmed' and start_time > now();
  if v_recent >= 3 then
    return jsonb_build_object('ok', false,
      'error', 'Keni tashmë 3 rezervime aktive. Anuloni njërin për të bërë një tjetër.');
  end if;

  begin
    insert into public.bookings (business_id, service_id, customer_name, customer_phone,
                                 start_time, end_time, status, created_by)
    values (v_business.id, v_service.id, v_name, v_phone, p_start_time, v_end, 'confirmed', 'customer')
    returning * into v_booking;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false,
      'error', 'Kjo orë sapo u zu nga dikush tjetër. Ju lutem zgjidhni një orë tjetër.');
  end;

  return jsonb_build_object('ok', true, 'booking', jsonb_build_object(
    'id', v_booking.id, 'customer_name', v_booking.customer_name,
    'start_time', v_booking.start_time, 'end_time', v_booking.end_time,
    'service_name', v_service.name, 'price', v_service.price,
    'business_name', v_business.name));
end; $$;

-- ---------------------------------------------------------------------
--  6. Funksionet e pronarit
-- ---------------------------------------------------------------------
create or replace function public.my_business_id()
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select b.id from public.businesses b where b.owner_id = (select auth.uid());
$$;

/**
 * Rezervim i shtuar nga vetë pronari (telefon ose walk-in).
 * Pronari kalon mbi orarin, pushimin dhe njoftimin minimal — ai e di më mirë.
 * E vetmja gjë e paprekshme është mbivendosja me një rezervim tjetër.
 */
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
      return jsonb_build_object('ok', false,
        'error', 'Numri nuk është i saktë. Lëre bosh nëse s''e ke.');
    end if;
  end if;

  if p_start_time < now() - interval '24 hours' then
    return jsonb_build_object('ok', false, 'error', 'Ora është shumë larg në të shkuarën.');
  end if;
  if p_start_time > now() + interval '365 days' then
    return jsonb_build_object('ok', false, 'error', 'Ora është shumë larg në të ardhmen.');
  end if;

  v_end := p_start_time + make_interval(mins => v_service.duration_minutes);

  begin
    insert into public.bookings (business_id, service_id, customer_name, customer_phone,
                                 start_time, end_time, status, created_by, note)
    values (v_bid, v_service.id, v_name, v_phone, p_start_time, v_end,
            'confirmed', 'owner', nullif(trim(coalesce(p_note, '')), ''))
    returning * into v_booking;
  exception when exclusion_violation then
    return jsonb_build_object('ok', false,
      'error', 'Kjo orë përplaset me një rezervim ekzistues.');
  end;

  return jsonb_build_object('ok', true, 'booking', jsonb_build_object(
    'id', v_booking.id, 'start_time', v_booking.start_time, 'end_time', v_booking.end_time));
end; $$;

/** Gjithçka që i duhet panelit të pronarit, në një thirrje të vetme. */
create or replace function public.owner_dashboard(p_days int default 30)
returns jsonb language plpgsql stable security definer
set search_path = public, pg_temp as $$
declare
  v_bid uuid := public.my_business_id();
  v_days int := least(greatest(coalesce(p_days, 30), 7), 180);
  v_today date := (now() at time zone 'Europe/Tirane')::date;
  v_result jsonb;
begin
  if v_bid is null then
    raise exception 'Nuk keni biznes.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    -- Numri i shërbimeve aktive vjen bashkë me pjesën tjetër, e nuk kërkon një
    -- pyetje më vete: ajo do të ishte një shkuardhje e dytë rrjeti vetëm për
    -- një numër, dhe do të duhej të priste `business_id`-në.
    'services_active',  (select count(*) from public.services
                          where business_id = v_bid and is_active),
    'bookings_total',   (select count(*) from public.bookings where business_id = v_bid),
    'bookings_period',  (select count(*) from public.bookings
                          where business_id = v_bid
                            and (start_time at time zone 'Europe/Tirane')::date > v_today - v_days),
    'upcoming',         (select count(*) from public.bookings
                          where business_id = v_bid and status = 'confirmed' and start_time > now()),
    'today',            (select count(*) from public.bookings
                          where business_id = v_bid and status <> 'cancelled'
                            and (start_time at time zone 'Europe/Tirane')::date = v_today),
    'status_confirmed', (select count(*) from public.bookings where business_id = v_bid and status = 'confirmed'),
    'status_completed', (select count(*) from public.bookings where business_id = v_bid and status = 'completed'),
    'status_cancelled', (select count(*) from public.bookings where business_id = v_bid and status = 'cancelled'),
    'status_no_show',   (select count(*) from public.bookings where business_id = v_bid and status = 'no_show'),
    'earnings_total',   (select coalesce(sum(s.price),0) from public.bookings k
                          join public.services s on s.id = k.service_id
                          where k.business_id = v_bid and k.status = 'completed'),
    'earnings_period',  (select coalesce(sum(s.price),0) from public.bookings k
                          join public.services s on s.id = k.service_id
                          where k.business_id = v_bid and k.status = 'completed'
                            and (k.start_time at time zone 'Europe/Tirane')::date > v_today - v_days),
    'earnings_prev',    (select coalesce(sum(s.price),0) from public.bookings k
                          join public.services s on s.id = k.service_id
                          where k.business_id = v_bid and k.status = 'completed'
                            and (k.start_time at time zone 'Europe/Tirane')::date <= v_today - v_days
                            and (k.start_time at time zone 'Europe/Tirane')::date > v_today - (v_days * 2)),
    'lost_no_show',     (select coalesce(sum(s.price),0) from public.bookings k
                          join public.services s on s.id = k.service_id
                          where k.business_id = v_bid and k.status = 'no_show'),
    'customers_total',  (select count(distinct coalesce(customer_phone, lower(customer_name)))
                          from public.bookings where business_id = v_bid),
    'customers_repeat', (select count(*) from (
                          select coalesce(customer_phone, lower(customer_name)) as key
                          from public.bookings where business_id = v_bid
                          group by 1 having count(*) > 1) r),
    'daily', coalesce((
      select jsonb_agg(jsonb_build_object(
        'day', d.day, 'bookings', d.bookings, 'completed', d.completed,
        'no_shows', d.no_shows, 'earnings', d.earnings) order by d.day)
      from (
        select span.day,
               count(k.id) as bookings,
               count(k.id) filter (where k.status = 'completed') as completed,
               count(k.id) filter (where k.status = 'no_show') as no_shows,
               coalesce(sum(s.price) filter (where k.status = 'completed'), 0) as earnings
        from (select generate_series(v_today - (v_days - 1), v_today, interval '1 day')::date as day) span
        left join public.bookings k
          on k.business_id = v_bid
         and (k.start_time at time zone 'Europe/Tirane')::date = span.day
        left join public.services s on s.id = k.service_id
        group by span.day
      ) d), '[]'::jsonb),
    'by_weekday', coalesce((
      select jsonb_agg(jsonb_build_object('dow', w.dow, 'bookings', w.n) order by w.dow)
      from (
        select extract(isodow from (k.start_time at time zone 'Europe/Tirane'))::int as dow,
               count(*) as n
        from public.bookings k
        where k.business_id = v_bid and k.status <> 'cancelled'
        group by 1) w), '[]'::jsonb),
    'by_hour', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h.hour, 'bookings', h.n) order by h.hour)
      from (
        select extract(hour from (k.start_time at time zone 'Europe/Tirane'))::int as hour,
               count(*) as n
        from public.bookings k
        where k.business_id = v_bid and k.status <> 'cancelled'
        group by 1) h), '[]'::jsonb),
    'top_services', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', t.name, 'bookings', t.n, 'earnings', t.earnings) order by t.n desc)
      from (
        select s.name, count(k.id) as n,
               coalesce(sum(s.price) filter (where k.status = 'completed'), 0) as earnings
        from public.services s
        left join public.bookings k on k.service_id = s.id and k.status <> 'cancelled'
        where s.business_id = v_bid
        group by s.id, s.name
        order by count(k.id) desc limit 6) t), '[]'::jsonb)
  ) into v_result;

  return v_result;
end; $$;

/** Klientët, të ndërtuar nga vetë rezervimet — pa tabelë të veçantë. */
create or replace function public.owner_customers()
returns table (
  customer_key text, customer_name text, customer_phone text,
  visits bigint, completed bigint, no_shows bigint, cancelled bigint,
  first_visit timestamptz, last_visit timestamptz, total_spent bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_bid uuid := public.my_business_id();
begin
  if v_bid is null then
    raise exception 'Nuk keni biznes.' using errcode = '42501';
  end if;

  return query
  select
    coalesce(k.customer_phone, lower(k.customer_name)) as customer_key,
    (array_agg(k.customer_name order by k.start_time desc))[1] as customer_name,
    max(k.customer_phone) as customer_phone,
    count(*) as visits,
    count(*) filter (where k.status = 'completed') as completed,
    count(*) filter (where k.status = 'no_show') as no_shows,
    count(*) filter (where k.status = 'cancelled') as cancelled,
    min(k.start_time) as first_visit,
    max(k.start_time) as last_visit,
    coalesce(sum(s.price) filter (where k.status = 'completed'), 0)::bigint as total_spent
  from public.bookings k
  join public.services s on s.id = k.service_id
  where k.business_id = v_bid
  group by 1
  order by max(k.start_time) desc;
end; $$;

-- ---------------------------------------------------------------------
--  7. Të drejtat
-- ---------------------------------------------------------------------
revoke all on function public.my_business_id() from public, anon;
revoke all on function public.owner_create_booking(uuid, text, text, timestamptz, text) from public, anon;
revoke all on function public.owner_dashboard(int) from public, anon;
revoke all on function public.owner_customers() from public, anon;

grant execute on function public.my_business_id() to authenticated;
grant execute on function public.owner_create_booking(uuid, text, text, timestamptz, text) to authenticated;
grant execute on function public.owner_dashboard(int) to authenticated;
grant execute on function public.owner_customers() to authenticated;
