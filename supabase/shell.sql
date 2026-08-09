-- =====================================================================
--  Rezervo.al — Njoftimet
--  Ekzekutohet i KATËRTI: schema.sql -> admin.sql -> features.sql -> shell.sql
--  Idempotent.
-- =====================================================================

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind        text not null check (kind in
                ('booking_new','booking_cancelled','booking_no_show','booking_completed',
                 'business_suspended','business_restored')),
  title       text not null,
  body        text,
  booking_id  uuid references public.bookings (id) on delete set null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_feed
  on public.notifications (business_id, created_at desc);
create index if not exists notifications_unread
  on public.notifications (business_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists "owner reads notifications"   on public.notifications;
drop policy if exists "owner updates notifications" on public.notifications;
drop policy if exists "owner deletes notifications" on public.notifications;

create policy "owner reads notifications" on public.notifications
  for select to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = notifications.business_id and b.owner_id = (select auth.uid())));

create policy "owner updates notifications" on public.notifications
  for update to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = notifications.business_id and b.owner_id = (select auth.uid())))
  with check (
    exists (select 1 from public.businesses b
            where b.id = notifications.business_id and b.owner_id = (select auth.uid())));

create policy "owner deletes notifications" on public.notifications
  for delete to authenticated using (
    exists (select 1 from public.businesses b
            where b.id = notifications.business_id and b.owner_id = (select auth.uid())));

-- Pa policy INSERT me qëllim: njoftimet i shkruan vetëm trigger-i më poshtë,
-- i cili është SECURITY DEFINER dhe kalon mbi RLS-në.

/**
 * Njoftimet lindin nga vetë ndryshimet e rezervimeve, jo nga kodi i aplikacionit.
 * Kështu edhe një rezervim i futur direkt në bazë e prodhon njoftimin, dhe nuk ka
 * rrugë ku njoftimi "harrohet".
 */
create or replace function public.notify_on_booking()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare v_service text; v_when text;
begin
  select s.name into v_service from public.services s where s.id = new.service_id;
  v_when := to_char(new.start_time at time zone 'Europe/Tirane', 'DD/MM HH24:MI');

  if tg_op = 'INSERT' then
    -- Vetëm rezervimet e klientëve njoftohen; ato që i shton vetë pronari, jo —
    -- ai sapo i shkroi me dorë.
    if new.created_by = 'customer' then
      insert into public.notifications (business_id, kind, title, body, booking_id)
      values (new.business_id, 'booking_new', 'Rezervim i ri: ' || new.customer_name,
              coalesce(v_service, 'Shërbim') || ' · ' || v_when, new.id);
    end if;
    return new;
  end if;

  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    if new.status = 'cancelled' then
      insert into public.notifications (business_id, kind, title, body, booking_id)
      values (new.business_id, 'booking_cancelled', 'Anuluar: ' || new.customer_name,
              coalesce(v_service, 'Shërbim') || ' · ' || v_when, new.id);
    elsif new.status = 'no_show' then
      insert into public.notifications (business_id, kind, title, body, booking_id)
      values (new.business_id, 'booking_no_show', 'Nuk erdhi: ' || new.customer_name,
              coalesce(v_service, 'Shërbim') || ' · ' || v_when, new.id);
    end if;
  end if;

  return new;
end; $$;

drop trigger if exists bookings_notify_insert on public.bookings;
drop trigger if exists bookings_notify_update on public.bookings;

create trigger bookings_notify_insert
  after insert on public.bookings
  for each row execute function public.notify_on_booking();

create trigger bookings_notify_update
  after update on public.bookings
  for each row execute function public.notify_on_booking();

create or replace function public.mark_notifications_read()
returns int language plpgsql volatile security definer
set search_path = public, pg_temp as $$
declare v_bid uuid := public.my_business_id(); v_n int;
begin
  if v_bid is null then
    raise exception 'Nuk keni biznes.' using errcode = '42501';
  end if;
  update public.notifications set read_at = now()
   where business_id = v_bid and read_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end; $$;

revoke all on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;

-- Pa këtë rresht abonimi realtime i ziles nuk merr kurrë ngjarje.
-- RLS vazhdon të zbatohet: secili merr vetëm njoftimet e biznesit të vet.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------
--  Njoftimet për pezullimin dhe riaktivizimin
-- ---------------------------------------------------------------------

-- Për bazat ekzistuese: zgjeron listën e llojeve pa i prishur të dhënat.
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (
  kind in (
    'booking_new', 'booking_cancelled', 'booking_no_show', 'booking_completed',
    'business_suspended', 'business_restored'
  )
);

/**
 * Njoftim kur biznesi pezullohet ose riaktivizohet.
 *
 * Si te rezervimet, e shkruan trigger-i dhe jo aplikacioni: kështu njoftimi lind
 * edhe nëse `suspended_at` ndryshohet direkt në bazë.
 */
create or replace function public.notify_on_suspension()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  -- Vetëm kalimi i gjendjes ka rëndësi; çdo update tjetër i biznesit injorohet.
  if new.suspended_at is not distinct from old.suspended_at then
    return new;
  end if;

  if new.suspended_at is not null then
    insert into public.notifications (business_id, kind, title, body)
    values (new.id, 'business_suspended', 'Llogaria u pezullua',
      coalesce(nullif(trim(coalesce(new.suspended_reason, '')), ''),
               'Faqja jote publike është offline dhe nuk pranohen rezervime të reja.'));
  else
    insert into public.notifications (business_id, kind, title, body)
    values (new.id, 'business_restored', 'Llogaria u riaktivizua',
      'Faqja jote publike është sërish online dhe pranon rezervime.');
  end if;

  return new;
end; $$;

drop trigger if exists businesses_notify_suspension on public.businesses;

create trigger businesses_notify_suspension
  after update on public.businesses
  for each row execute function public.notify_on_suspension();
