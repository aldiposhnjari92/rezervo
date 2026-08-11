-- =====================================================================
--  Rezervo.al — Faturat
--  Ekzekutohet i KATËRTI: schema.sql -> admin.sql -> features.sql -> invoices.sql
--
--  Dy lloje, një tabelë:
--    'booking'      — biznesi -> klienti, për një rezervim të kryer
--    'subscription' — Rezervo.al -> biznesi, për abonimin mujor
--
--  KUJDES — KËTO NUK JANË FATURA TË FISKALIZUARA. Nuk ka NSLF/NIVF, nuk ka
--  nënshkrim elektronik dhe asgjë nuk i dërgohet sistemit të fiskalizimit të
--  tatimeve. Janë dokumente të brendshme; përgjegjësia për përputhshmërinë
--  ligjore mbetet e biznesit.
--
--  Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
--  1. Identiteti i shitësit — hyn te koka e faturës
-- ---------------------------------------------------------------------
alter table public.businesses add column if not exists nipt    text;
alter table public.businesses add column if not exists address text;

do $$ begin
  alter table public.businesses drop constraint if exists businesses_nipt_valid;
  -- NIPT-i shqiptar: shkronjë, 8 shifra, shkronjë (p.sh. L41234567M).
  alter table public.businesses add constraint businesses_nipt_valid
    check (nipt is null or nipt ~ '^[A-Za-z][0-9]{8}[A-Za-z]$');

  alter table public.businesses drop constraint if exists businesses_address_len;
  alter table public.businesses add constraint businesses_address_len
    check (address is null or char_length(address) <= 160);
end $$;

-- ---------------------------------------------------------------------
--  2. Faturat
--
--  Shitësi dhe blerësi ruhen si fotografi në momentin e lëshimit: nëse
--  biznesi ndryshon emrin ose shërbimi fshihet, fatura e vjetër duhet të
--  mbetet ashtu siç u dha.
-- ---------------------------------------------------------------------
create table if not exists public.invoices (
  id            uuid primary key default gen_random_uuid(),
  business_id   uuid not null references public.businesses (id) on delete cascade,
  kind          text not null check (kind in ('booking', 'subscription')),
  number        text not null,
  issued_on     date not null default (now() at time zone 'Europe/Tirane')::date,

  -- vetëm te 'booking'
  booking_id    uuid references public.bookings (id) on delete set null,
  -- vetëm te 'subscription'
  period_start  date,
  period_end    date,

  seller_name    text not null,
  seller_nipt    text,
  seller_address text,
  buyer_name     text not null,
  buyer_nipt     text,
  buyer_address  text,

  -- [{"description": "...", "quantity": 1, "unit_price": 650, "total": 650}]
  lines      jsonb not null default '[]'::jsonb,
  subtotal   int  not null default 0,
  vat_rate   int  not null default 0,
  vat_amount int  not null default 0,
  total      int  not null default 0,
  note       text,
  created_at timestamptz not null default now(),

  unique (business_id, number),
  -- Një rezervim jep një faturë të vetme.
  unique (booking_id),
  constraint invoices_amounts_sane check (
    subtotal >= 0 and vat_amount >= 0 and total >= 0
    and vat_rate between 0 and 100
  ),
  constraint invoices_kind_fields check (
    (kind = 'booking'      and booking_id is not null and period_start is null and period_end is null)
    or
    (kind = 'subscription' and booking_id is null and period_start is not null and period_end is not null
                           and period_end > period_start)
  )
);

create index if not exists invoices_business_issued
  on public.invoices (business_id, issued_on desc, created_at desc);

-- ---------------------------------------------------------------------
--  3. RLS — pronari lexon të vetat, admini lexon të gjitha.
--     Shkrimi bëhet VETËM përmes funksioneve më poshtë, që numërojnë vetë.
-- ---------------------------------------------------------------------
alter table public.invoices enable row level security;

drop policy if exists "owner reads own invoices"       on public.invoices;
drop policy if exists "owner reads own sales invoices" on public.invoices;
drop policy if exists "admin reads invoices"           on public.invoices;

-- Pronari sheh vetëm shitjet e veta. Faturat e abonimit janë marrëdhënia e
-- platformës me biznesin — regjistri i tyre i takon adminit, jo pronarit.
create policy "owner reads own sales invoices" on public.invoices
  for select to authenticated
  using (
    kind = 'booking'
    and exists (select 1 from public.businesses b
                where b.id = invoices.business_id and b.owner_id = (select auth.uid()))
  );

create policy "admin reads invoices" on public.invoices
  for select to authenticated using (public.is_platform_admin());

-- ---------------------------------------------------------------------
--  4. Numërimi
--
--  Seri e veçantë për çdo biznes, lloj dhe vit: "F-2026-0001" për shitjet,
--  "A-2026-0001" për abonimin. Numri merret brenda një `lock` këshillues mbi
--  biznesin, që dy lëshime njëkohësisht të mos marrin të njëjtin numër —
--  `max(number) + 1` pa lock jep dublikatë sapo dy tabe klikojnë bashkë.
-- ---------------------------------------------------------------------
create or replace function public.next_invoice_number(
  p_business_id uuid,
  p_kind        text,
  p_year        int
) returns text language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_prefix text := case when p_kind = 'subscription' then 'A' else 'F' end;
  v_stub   text := v_prefix || '-' || p_year::text || '-';
  v_last   int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_business_id::text || p_kind, 0));

  select coalesce(max((regexp_replace(number, '^.*-', ''))::int), 0)
    into v_last
  from public.invoices
  where business_id = p_business_id
    and kind = p_kind
    and number like v_stub || '%';

  return v_stub || lpad((v_last + 1)::text, 4, '0');
end $$;

revoke all on function public.next_invoice_number(uuid, text, int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
--  5. Faturë për një rezervim — e thërret pronari
--
--  Idempotente: nëse rezervimi e ka faturën, kthehet ajo që ekziston. Kështu
--  dy klikime te i njëjti buton nuk japin dy numra për të njëjtën shitje.
-- ---------------------------------------------------------------------
create or replace function public.issue_booking_invoice(p_booking_id uuid)
returns public.invoices language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_biz     public.businesses;
  v_booking record;
  v_existing public.invoices;
  v_row     public.invoices;
  v_price   int;
begin
  select b.* into v_biz
  from public.businesses b
  join public.bookings bk on bk.business_id = b.id
  where bk.id = p_booking_id and b.owner_id = auth.uid();

  if v_biz.id is null then
    raise exception 'not_allowed' using hint = 'Rezervimi nuk i përket këtij biznesi.';
  end if;

  select * into v_existing from public.invoices where booking_id = p_booking_id;
  if v_existing.id is not null then
    return v_existing;
  end if;

  -- Çmimi rri te shërbimi, jo te rezervimi; te fatura ngrin ashtu siç është sot.
  select bk.id, bk.customer_name, bk.customer_phone, bk.status, bk.start_time,
         coalesce(s.name, 'Shërbim i fshirë') as service_name,
         coalesce(s.price, 0)                 as price
    into v_booking
  from public.bookings bk
  left join public.services s on s.id = bk.service_id
  where bk.id = p_booking_id;

  if v_booking.status = 'cancelled' then
    raise exception 'booking_cancelled' using hint = 'Një rezervim i anuluar nuk faturohet.';
  end if;

  v_price := v_booking.price;

  insert into public.invoices (
    business_id, kind, number, booking_id,
    seller_name, seller_nipt, seller_address,
    buyer_name, lines, subtotal, vat_rate, vat_amount, total
  ) values (
    v_biz.id, 'booking',
    public.next_invoice_number(v_biz.id, 'booking',
      extract(year from (now() at time zone 'Europe/Tirane'))::int),
    p_booking_id,
    v_biz.name, v_biz.nipt, v_biz.address,
    v_booking.customer_name,
    jsonb_build_array(jsonb_build_object(
      'description', v_booking.service_name,
      'quantity', 1,
      'unit_price', v_price,
      'total', v_price
    )),
    v_price, 0, 0, v_price
  )
  returning * into v_row;

  return v_row;
end $$;

grant execute on function public.issue_booking_invoice(uuid) to authenticated;
revoke execute on function public.issue_booking_invoice(uuid) from anon;

-- ---------------------------------------------------------------------
--  6. Faturë abonimi — vetëm admini i platformës
-- ---------------------------------------------------------------------
create or replace function public.issue_subscription_invoice(
  p_business_id  uuid,
  p_period_start date,
  p_amount       int default 1000
) returns public.invoices language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_biz public.businesses;
  v_row public.invoices;
  v_start date := date_trunc('month', p_period_start)::date;
  v_end   date := (date_trunc('month', p_period_start) + interval '1 month')::date;
begin
  if not public.is_platform_admin() then
    raise exception 'not_allowed';
  end if;

  if p_amount < 0 then
    raise exception 'bad_amount';
  end if;

  select * into v_biz from public.businesses where id = p_business_id;
  if v_biz.id is null then
    raise exception 'business_missing';
  end if;

  -- Një muaj, një faturë abonimi.
  select * into v_row
  from public.invoices
  where business_id = p_business_id and kind = 'subscription' and period_start = v_start;
  if v_row.id is not null then
    return v_row;
  end if;

  insert into public.invoices (
    business_id, kind, number, period_start, period_end,
    seller_name, seller_address,
    buyer_name, buyer_nipt, buyer_address,
    lines, subtotal, vat_rate, vat_amount, total
  ) values (
    p_business_id, 'subscription',
    public.next_invoice_number(p_business_id, 'subscription', extract(year from v_start)::int),
    v_start, v_end,
    'Rezervo.al', 'Tiranë, Shqipëri',
    v_biz.name, v_biz.nipt, v_biz.address,
    jsonb_build_array(jsonb_build_object(
      'description', 'Abonimi Rezervo.al',
      'quantity', 1,
      'unit_price', p_amount,
      'total', p_amount
    )),
    p_amount, 0, 0, p_amount
  )
  returning * into v_row;

  return v_row;
end $$;

grant execute on function public.issue_subscription_invoice(uuid, date, int) to authenticated;
revoke execute on function public.issue_subscription_invoice(uuid, date, int) from anon;

-- ---------------------------------------------------------------------
--  7. Kush është i abonuar — pamja e adminit
--
--  Nuk ka kolonë "abonim": fatura ËSHTË regjistri. Një biznes quhet i abonuar
--  për këtë muaj kur ka faturën e këtij muaji.
-- ---------------------------------------------------------------------
create or replace function public.admin_subscriptions()
returns table (
  business_id       uuid,
  owner_id          uuid,
  name              text,
  slug              text,
  owner_email       text,
  suspended_at      timestamptz,
  invoices_count    int,
  total_billed      int,
  last_period_start date,
  billed_this_month boolean,
  this_month_total  int
) language sql stable security definer set search_path = public, pg_temp as $$
  with month_start as (
    select date_trunc('month', (now() at time zone 'Europe/Tirane'))::date as d
  )
  select
    b.id, b.owner_id, b.name, b.slug, b.owner_email, b.suspended_at,
    coalesce(count(i.id), 0)::int  as invoices_count,
    coalesce(sum(i.total), 0)::int as total_billed,
    max(i.period_start)            as last_period_start,
    bool_or(i.period_start = (select d from month_start)) is true as billed_this_month,
    -- Shuma e vërtetë e muajit, jo 1.000 e supozuar: çmimi mund të ndryshojë.
    coalesce(sum(i.total) filter (where i.period_start = (select d from month_start)), 0)::int
                                   as this_month_total
  from public.businesses b
  left join public.invoices i
    on i.business_id = b.id and i.kind = 'subscription'
  where public.is_platform_admin()
  group by b.id, b.owner_id, b.name, b.slug, b.owner_email, b.suspended_at
  order by billed_this_month desc, b.name asc;
$$;

revoke all on function public.admin_subscriptions() from public, anon;
grant execute on function public.admin_subscriptions() to authenticated;
