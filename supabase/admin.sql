-- =====================================================================
--  Rezervo.al — Moduli i super-adminit
--  Ekzekutohet PAS supabase/schema.sql. Idempotent.
--
--  Modeli i të drejtave: admini LEXON gjithçka dhe mund të PEZULLOJË një
--  biznes. Nuk mund të redaktojë apo fshijë të dhënat e klientëve të tjerëve
--  — kështu një llogari admini e komprometuar nuk shkatërron dot asgjë.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Kush është admin
-- ---------------------------------------------------------------------
create table if not exists public.platform_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.platform_admins enable row level security;
-- Asnjë policy: vetëm roli `postgres`/service_role e prek këtë tabelë.
-- Aplikacioni e lexon gjithmonë përmes is_platform_admin() më poshtë.

/**
 * E vërtetë nëse përdoruesi aktual është admin platforme.
 * SECURITY DEFINER që të mund të thirret edhe brenda RLS-së pa u bllokuar
 * nga RLS-ja e vetë tabelës platform_admins.
 */
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.platform_admins a where a.user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- ---------------------------------------------------------------------
--  2. Pezullimi i një biznesi
-- ---------------------------------------------------------------------
alter table public.businesses add column if not exists suspended_at     timestamptz;
alter table public.businesses add column if not exists suspended_reason text;

-- ---------------------------------------------------------------------
--  3. RLS: admini lexon gjithçka (vetëm SELECT)
-- ---------------------------------------------------------------------
drop policy if exists "admin reads all businesses" on public.businesses;
drop policy if exists "admin reads all services"   on public.services;
drop policy if exists "admin reads all bookings"   on public.bookings;

create policy "admin reads all businesses" on public.businesses
  for select to authenticated using (public.is_platform_admin());

create policy "admin reads all services" on public.services
  for select to authenticated using (public.is_platform_admin());

create policy "admin reads all bookings" on public.bookings
  for select to authenticated using (public.is_platform_admin());

-- ---------------------------------------------------------------------
--  4. Faqja publike nuk hapet për biznese të pezulluara
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
  where b.slug = lower(trim(p_slug))
    and b.suspended_at is null;
$$;

-- Një biznes i pezulluar nuk pranon as rezervime të reja.
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
  select * into v_business from public.businesses where slug = lower(trim(p_slug));
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ky biznes nuk u gjet.');
  end if;

  if v_business.suspended_at is not null then
    return jsonb_build_object('ok', false,
      'error', 'Ky biznes nuk pranon rezervime për momentin.');
  end if;

  select * into v_service
  from public.services
  where id = p_service_id and business_id = v_business.id and is_active;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Ky shërbim nuk është më i disponueshëm.');
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'error', 'Ju lutem shkruani emrin tuaj të plotë.');
  end if;

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

  if p_start_time < now() + interval '5 minutes' then
    return jsonb_build_object('ok', false, 'error', 'Kjo orë ka kaluar tashmë. Zgjidhni një orë tjetër.');
  end if;
  if p_start_time > now() + interval '60 days' then
    return jsonb_build_object('ok', false, 'error', 'Nuk mund të rezervoni kaq larg në kohë.');
  end if;

  if extract(epoch from p_start_time)::bigint % 1800 <> 0 then
    return jsonb_build_object('ok', false, 'error', 'Ora e zgjedhur nuk është e vlefshme.');
  end if;

  v_end       := p_start_time + make_interval(mins => v_service.duration_minutes);
  v_local     := p_start_time at time zone 'Europe/Tirane';
  v_local_end := v_end        at time zone 'Europe/Tirane';
  v_dow       := lower(to_char(v_local, 'FMday'));
  v_hours     := v_business.working_hours -> v_dow;

  if v_hours is null or jsonb_typeof(v_hours) <> 'object' then
    return jsonb_build_object('ok', false, 'error', 'Biznesi është i mbyllur këtë ditë.');
  end if;

  if v_local::time < (v_hours ->> 'start')::time
     or v_local_end::date <> v_local::date
     or v_local_end::time > (v_hours ->> 'end')::time then
    return jsonb_build_object('ok', false, 'error', 'Kjo orë është jashtë orarit të punës.');
  end if;

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

-- ---------------------------------------------------------------------
--  5. Analitika (vetëm për adminët)
--     Çdo funksion e kontrollon vetë lejen — mos u mbështet te UI-ja.
-- ---------------------------------------------------------------------

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_result jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Nuk keni leje.' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'users_total',           (select count(*) from auth.users),
    'businesses_total',      (select count(*) from public.businesses),
    'businesses_suspended',  (select count(*) from public.businesses where suspended_at is not null),
    'businesses_new_30d',    (select count(*) from public.businesses where created_at > now() - interval '30 days'),
    'services_total',        (select count(*) from public.services where is_active),
    'bookings_total',        (select count(*) from public.bookings),
    'bookings_30d',          (select count(*) from public.bookings where created_at > now() - interval '30 days'),
    'bookings_upcoming',     (select count(*) from public.bookings where status = 'confirmed' and start_time > now()),
    'status_confirmed',      (select count(*) from public.bookings where status = 'confirmed'),
    'status_completed',      (select count(*) from public.bookings where status = 'completed'),
    'status_cancelled',      (select count(*) from public.bookings where status = 'cancelled'),
    'status_no_show',        (select count(*) from public.bookings where status = 'no_show'),
    'gmv_total',             (select coalesce(sum(s.price), 0) from public.bookings b
                                join public.services s on s.id = b.service_id
                                where b.status = 'completed'),
    'gmv_30d',               (select coalesce(sum(s.price), 0) from public.bookings b
                                join public.services s on s.id = b.service_id
                                where b.status = 'completed' and b.start_time > now() - interval '30 days'),
    -- biznese që kanë marrë të paktën një rezervim 30 ditët e fundit
    'businesses_active_30d', (select count(distinct business_id) from public.bookings
                                where created_at > now() - interval '30 days')
  ) into v_result;

  return v_result;
end;
$$;

/** Rezervime për ditë, sipas datës së Tiranës. Ditët bosh kthehen me 0. */
create or replace function public.admin_daily_bookings(p_days int default 30)
returns table (day date, bookings bigint, completed bigint, no_shows bigint)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 180);
begin
  if not public.is_platform_admin() then
    raise exception 'Nuk keni leje.' using errcode = '42501';
  end if;

  return query
  with span as (
    select generate_series(
      ((now() at time zone 'Europe/Tirane')::date - (v_days - 1)),
      ((now() at time zone 'Europe/Tirane')::date),
      interval '1 day'
    )::date as day
  )
  select
    span.day,
    count(b.id)                                            as bookings,
    count(b.id) filter (where b.status = 'completed')      as completed,
    count(b.id) filter (where b.status = 'no_show')        as no_shows
  from span
  left join public.bookings b
    on ((b.start_time at time zone 'Europe/Tirane')::date) = span.day
  group by span.day
  order by span.day;
end;
$$;

/** Një rresht për çdo biznes, me numrat kryesorë. */
create or replace function public.admin_businesses()
returns table (
  business_id    uuid,
  owner_id       uuid,
  name           text,
  slug           text,
  owner_email    text,
  phone          text,
  created_at     timestamptz,
  suspended_at   timestamptz,
  services_count bigint,
  bookings_total bigint,
  bookings_30d   bigint,
  no_shows       bigint,
  gmv            bigint,
  last_booking   timestamptz
)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Nuk keni leje.' using errcode = '42501';
  end if;

  return query
  select
    b.id, b.owner_id, b.name, b.slug, b.owner_email, b.phone,
    b.created_at, b.suspended_at,
    (select count(*) from public.services s where s.business_id = b.id and s.is_active),
    (select count(*) from public.bookings k where k.business_id = b.id),
    (select count(*) from public.bookings k where k.business_id = b.id
       and k.created_at > now() - interval '30 days'),
    (select count(*) from public.bookings k where k.business_id = b.id and k.status = 'no_show'),
    (select coalesce(sum(s.price), 0)::bigint from public.bookings k
       join public.services s on s.id = k.service_id
       where k.business_id = b.id and k.status = 'completed'),
    (select max(k.start_time) from public.bookings k where k.business_id = b.id)
  from public.businesses b
  order by b.created_at desc;
end;
$$;

/** Detajet e një llogarie të vetme, për panelin e adminit. */
create or replace function public.admin_account(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_user     record;
  v_business public.businesses;
  v_result   jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Nuk keni leje.' using errcode = '42501';
  end if;

  select id, email, created_at, last_sign_in_at, email_confirmed_at
    into v_user
  from auth.users where id = p_user_id;

  if not found then
    return null;
  end if;

  select * into v_business from public.businesses where owner_id = p_user_id;

  select jsonb_build_object(
    'user', jsonb_build_object(
      'id',                v_user.id,
      'email',             v_user.email,
      'created_at',        v_user.created_at,
      'last_sign_in_at',   v_user.last_sign_in_at,
      'email_confirmed',   v_user.email_confirmed_at is not null,
      'is_admin',          exists (select 1 from public.platform_admins a where a.user_id = p_user_id)
    ),
    'business', case when v_business.id is null then null else jsonb_build_object(
      'id',               v_business.id,
      'name',             v_business.name,
      'slug',             v_business.slug,
      'phone',            v_business.phone,
      'created_at',       v_business.created_at,
      'suspended_at',     v_business.suspended_at,
      'suspended_reason', v_business.suspended_reason,
      'working_hours',    v_business.working_hours
    ) end,
    'stats', case when v_business.id is null then null else jsonb_build_object(
      'services',   (select count(*) from public.services s where s.business_id = v_business.id),
      'bookings',   (select count(*) from public.bookings k where k.business_id = v_business.id),
      'completed',  (select count(*) from public.bookings k where k.business_id = v_business.id and k.status = 'completed'),
      'no_shows',   (select count(*) from public.bookings k where k.business_id = v_business.id and k.status = 'no_show'),
      'cancelled',  (select count(*) from public.bookings k where k.business_id = v_business.id and k.status = 'cancelled'),
      'upcoming',   (select count(*) from public.bookings k where k.business_id = v_business.id
                       and k.status = 'confirmed' and k.start_time > now()),
      'gmv',        (select coalesce(sum(s.price), 0) from public.bookings k
                       join public.services s on s.id = k.service_id
                       where k.business_id = v_business.id and k.status = 'completed')
    ) end,
    -- Pa numra telefoni: adminit i mjafton emri për të kuptuar aktivitetin.
    'recent_bookings', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', k.id, 'customer_name', k.customer_name, 'start_time', k.start_time,
               'status', k.status, 'service_name', s.name
             ) order by k.start_time desc)
      from (select * from public.bookings k2 where k2.business_id = v_business.id
            order by k2.start_time desc limit 10) k
      join public.services s on s.id = k.service_id
    ), '[]'::jsonb),
    'services', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', s.id, 'name', s.name, 'duration_minutes', s.duration_minutes,
               'price', s.price, 'is_active', s.is_active
             ) order by s.created_at)
      from public.services s where s.business_id = v_business.id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

/** Lista e llogarive që ende nuk kanë krijuar biznes. */
create or replace function public.admin_orphan_accounts()
returns table (user_id uuid, email text, created_at timestamptz, last_sign_in_at timestamptz)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Nuk keni leje.' using errcode = '42501';
  end if;

  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at
  from auth.users u
  left join public.businesses b on b.owner_id = u.id
  where b.id is null
  order by u.created_at desc;
end;
$$;

-- ---------------------------------------------------------------------
--  6. I vetmi veprim shkrues i adminit: pezullimi
-- ---------------------------------------------------------------------
create or replace function public.admin_set_suspended(
  p_business_id uuid,
  p_suspended   boolean,
  p_reason      text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_business public.businesses;
begin
  if not public.is_platform_admin() then
    raise exception 'Nuk keni leje.' using errcode = '42501';
  end if;

  update public.businesses
     set suspended_at     = case when p_suspended then coalesce(suspended_at, now()) else null end,
         suspended_reason = case when p_suspended then nullif(trim(coalesce(p_reason, '')), '') else null end
   where id = p_business_id
   returning * into v_business;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Biznesi nuk u gjet.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'suspended_at', v_business.suspended_at,
    'suspended_reason', v_business.suspended_reason
  );
end;
$$;

-- ---------------------------------------------------------------------
--  7. Fshirja e llogarisë nga vetë pronari
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
volatile
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Nuk je i kyçur.' using errcode = '42501';
  end if;

  -- Adminët nuk fshihen dot nga UI-ja — mbrojtje nga aksidentet.
  if exists (select 1 from public.platform_admins a where a.user_id = v_uid) then
    raise exception 'Llogaritë e adminit nuk fshihen nga paneli.' using errcode = '42501';
  end if;

  -- Kaskada te businesses/services/bookings kujdeset për pjesën tjetër.
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------
--  8. Të drejtat
-- ---------------------------------------------------------------------
revoke all on function public.admin_overview()                          from public;
revoke all on function public.admin_daily_bookings(int)                 from public;
revoke all on function public.admin_businesses()                        from public;
revoke all on function public.admin_account(uuid)                       from public;
revoke all on function public.admin_orphan_accounts()                   from public;
revoke all on function public.admin_set_suspended(uuid, boolean, text)  from public;
revoke all on function public.delete_my_account()                       from public;

-- Supabase u jep grant-e parazgjedhëse edhe rolit `anon`, ndaj revoke-u nga
-- PUBLIC nuk mjafton — hiqja shprehimisht edhe anon-it.
revoke execute on function public.admin_overview()                         from anon;
revoke execute on function public.admin_daily_bookings(int)                from anon;
revoke execute on function public.admin_businesses()                       from anon;
revoke execute on function public.admin_account(uuid)                      from anon;
revoke execute on function public.admin_orphan_accounts()                  from anon;
revoke execute on function public.admin_set_suspended(uuid, boolean, text) from anon;
revoke execute on function public.delete_my_account()                      from anon;
revoke execute on function public.is_platform_admin()                      from anon;

-- Vetëm përdorues të kyçur. Vetë funksionet kontrollojnë nëse je admin.
grant execute on function public.admin_overview()                         to authenticated;
grant execute on function public.admin_daily_bookings(int)                to authenticated;
grant execute on function public.admin_businesses()                       to authenticated;
grant execute on function public.admin_account(uuid)                      to authenticated;
grant execute on function public.admin_orphan_accounts()                  to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean, text) to authenticated;
grant execute on function public.delete_my_account()                      to authenticated;

-- =====================================================================
--  9. BËHU ADMIN
--     Zëvendëso email-in dhe ekzekuto këtë rresht një herë.
-- =====================================================================
-- insert into public.platform_admins (user_id, note)
-- select id, 'themelues' from auth.users where email = 'ti@shembull.com'
-- on conflict (user_id) do nothing;
