-- Hybrid portal schema for Supabase Auth + Storage.
-- Recommended source docs:
-- - https://supabase.com/docs/guides/auth/managing-user-data
-- - https://supabase.com/docs/guides/database/postgres/row-level-security
-- - https://supabase.com/docs/guides/storage/security/access-control

create extension if not exists pgcrypto;

create or replace function public.set_current_timestamp_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  full_name text,
  company_name text,
  role text not null default 'client',
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  document_type text not null default 'general',
  status text not null default 'active' check (status in ('draft', 'active', 'archived', 'deleted')),
  storage_bucket text not null default 'client-documents',
  storage_path text not null,
  mime_type text,
  size_bytes bigint,
  strapi_entry_type text,
  strapi_entry_id text,
  strapi_document_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint documents_size_bytes_nonnegative check (size_bytes is null or size_bytes >= 0),
  constraint documents_client_path_unique unique (client_id, storage_path)
);

create table if not exists public.requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  related_document_id uuid references public.documents(id) on delete set null,
  request_type text not null,
  title text not null,
  status text not null default 'submitted' check (status in ('draft', 'submitted', 'in_review', 'completed', 'cancelled')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_documents_updated_at on public.documents;
create trigger set_documents_updated_at
before update on public.documents
for each row execute procedure public.set_current_timestamp_updated_at();

drop trigger if exists set_requests_updated_at on public.requests;
create trigger set_requests_updated_at
before update on public.requests
for each row execute procedure public.set_current_timestamp_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, company_name)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'company_name', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    company_name = coalesce(excluded.company_name, public.profiles.company_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.requests enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = id)
with check ((select auth.uid()) is not null and (select auth.uid()) = id);

drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own"
on public.documents
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = client_id);

drop policy if exists "requests_select_own" on public.requests;
create policy "requests_select_own"
on public.requests
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = client_id);

drop policy if exists "requests_insert_own" on public.requests;
create policy "requests_insert_own"
on public.requests
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = client_id);

drop policy if exists "requests_update_own" on public.requests;
create policy "requests_update_own"
on public.requests
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = client_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = client_id);

-- Create the bucket once. It should stay private.
insert into storage.buckets (id, name, public)
values ('client-documents', 'client-documents', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

-- Required storage path convention:
--   <client_uuid>/<document_uuid>/<filename>
-- Example:
--   11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222/invoice.pdf

drop policy if exists "client_documents_select_own_folder" on storage.objects;
create policy "client_documents_select_own_folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

-- Staff uploads should use the service role from a trusted backend or dashboard.
-- No client-side insert/update/delete policies are created for portal documents by default.
