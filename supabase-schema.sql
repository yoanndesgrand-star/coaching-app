-- ══════════════════════════════════════
-- SCHÉMA SUPABASE — Coaching Yoann
-- À coller dans l'éditeur SQL de Supabase
-- ══════════════════════════════════════

-- 1. TABLE PROFILES (clients)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  credits integer default 0,
  offer_label text,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Activer RLS
alter table public.profiles enable row level security;

-- Policies
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Admins can view all profiles"
  on public.profiles for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can update all profiles"
  on public.profiles for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- 2. TABLE TIME_SLOTS (créneaux)
create table public.time_slots (
  id uuid default gen_random_uuid() primary key,
  start_time timestamptz not null,
  end_time timestamptz not null,
  is_available boolean default true,
  created_at timestamptz default now()
);

alter table public.time_slots enable row level security;

create policy "Anyone authenticated can view available slots"
  on public.time_slots for select
  using (auth.role() = 'authenticated');

create policy "Admins can insert slots"
  on public.time_slots for insert
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can update slots"
  on public.time_slots for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "Admins can delete slots"
  on public.time_slots for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- Allow clients to update availability when booking
create policy "Clients can update slot availability"
  on public.time_slots for update
  using (auth.role() = 'authenticated');

-- 3. TABLE BOOKINGS (réservations)
create table public.bookings (
  id uuid default gen_random_uuid() primary key,
  client_id uuid references public.profiles(id) on delete cascade,
  slot_id uuid references public.time_slots(id),
  status text default 'confirmed',
  created_at timestamptz default now()
);

alter table public.bookings enable row level security;

create policy "Users can view own bookings"
  on public.bookings for select
  using (auth.uid() = client_id);

create policy "Users can insert own bookings"
  on public.bookings for insert
  with check (auth.uid() = client_id);

create policy "Users can update own bookings"
  on public.bookings for update
  using (auth.uid() = client_id);

create policy "Admins can view all bookings"
  on public.bookings for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- 4. FONCTION : créer profil automatiquement après inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. CRÉER TON COMPTE ADMIN
-- Après avoir créé ton compte via le site, colle ton User ID ici :
-- update public.profiles set is_admin = true where email = 'ton@email.com';
