create table if not exists public.global_data (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.global_data enable row level security;
alter table public.user_data enable row level security;
alter table public.admin_users enable row level security;

drop policy if exists "global data is readable" on public.global_data;
create policy "global data is readable"
on public.global_data for select
to anon, authenticated
using (true);

drop policy if exists "admins can insert global data" on public.global_data;
create policy "admins can insert global data"
on public.global_data for insert
to authenticated
with check (exists (
  select 1 from public.admin_users
  where admin_users.user_id = auth.uid()
));

drop policy if exists "admins can update global data" on public.global_data;
create policy "admins can update global data"
on public.global_data for update
to authenticated
using (exists (
  select 1 from public.admin_users
  where admin_users.user_id = auth.uid()
))
with check (exists (
  select 1 from public.admin_users
  where admin_users.user_id = auth.uid()
));

drop policy if exists "users can read own data" on public.user_data;
create policy "users can read own data"
on public.user_data for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "users can insert own data" on public.user_data;
create policy "users can insert own data"
on public.user_data for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists "users can update own data" on public.user_data;
create policy "users can update own data"
on public.user_data for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "admins can read admin users" on public.admin_users;
create policy "admins can read admin users"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

insert into public.global_data (id, data)
values (
  'main',
  '{
    "parkHours": {"open": "09:00", "close": "21:00"},
    "userNotes": {},
    "importHistory": [],
    "parks": {
      "land": {"masterEvents": [], "plans": {}, "dailySchedules": {}},
      "sea": {"masterEvents": [], "plans": {}, "dailySchedules": {}}
    }
  }'::jsonb
)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('show-images', 'show-images', true)
on conflict (id) do nothing;

drop policy if exists "show images are readable" on storage.objects;
create policy "show images are readable"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'show-images');

drop policy if exists "admins can upload show images" on storage.objects;
create policy "admins can upload show images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'show-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);

drop policy if exists "admins can update show images" on storage.objects;
create policy "admins can update show images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'show-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
)
with check (
  bucket_id = 'show-images'
  and exists (
    select 1 from public.admin_users
    where admin_users.user_id = auth.uid()
  )
);
