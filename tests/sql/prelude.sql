-- Stub minimal i mjedisit Supabase, që schema.sql të ekzekutohet si në prodhim.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;

create schema if not exists auth;

create table auth.users (
  id    uuid primary key default gen_random_uuid(),
  email text
);

-- Në Supabase kjo lexon JWT-në; për testim e lexojmë nga një setting.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

grant usage on schema public to anon, authenticated;
