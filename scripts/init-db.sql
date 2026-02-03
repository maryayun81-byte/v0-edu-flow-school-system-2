-- ========================================
-- 1️⃣ Create tables with auth.users foreign key
-- ========================================

-- Create notes table
create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  file_url text,
  file_path text,
  is_archived boolean default false,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add missing column to notes
alter table notes add column if not exists is_archived boolean default false;

-- Create assignments table
create table if not exists assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  due_date timestamp with time zone,
  github_repo_link text,
  is_archived boolean default false,
  is_completed boolean default false,
  completed_at timestamp with time zone,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add missing columns to assignments
alter table assignments add column if not exists is_completed boolean default false;
alter table assignments add column if not exists completed_at timestamp with time zone;

-- Create timetables table
create table if not exists timetables (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  day_of_week text not null,
  start_time time not null,
  end_time time not null,
  subject text,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- ========================================
-- 2️⃣ Create indexes for better query performance
-- ========================================

create index if not exists idx_notes_created_by on notes(created_by);
create index if not exists idx_notes_created_at on notes(created_at desc);
create index if not exists idx_assignments_created_by on assignments(created_by);
create index if not exists idx_assignments_created_at on assignments(created_at desc);
create index if not exists idx_assignments_archived on assignments(is_archived);
create index if not exists idx_timetables_created_by on timetables(created_by);
create index if not exists idx_timetables_day on timetables(day_of_week);

-- ========================================
-- 3️⃣ Fix foreign keys (drop and recreate)
-- ========================================

alter table assignments drop constraint if exists assignments_created_by_fkey;
alter table assignments
  add constraint assignments_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete cascade;

alter table timetables drop constraint if exists timetables_created_by_fkey;
alter table timetables
  add constraint timetables_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete cascade;

alter table notes drop constraint if exists notes_created_by_fkey;
alter table notes
  add constraint notes_created_by_fkey
  foreign key (created_by)
  references auth.users(id)
  on delete cascade;

-- ========================================
-- 4️⃣ Enable Row-Level Security (RLS)
-- ========================================

alter table assignments enable row level security;
alter table timetables enable row level security;
alter table notes enable row level security;

-- ========================================
-- 5️⃣ Drop existing policies (if any) and create new ones
-- ========================================

-- Assignments Policies
drop policy if exists "Users can insert their own assignments" on assignments;
drop policy if exists "Users can update their own assignments" on assignments;
drop policy if exists "Users can delete their own assignments" on assignments;
drop policy if exists "Anyone can view all assignments" on assignments;
drop policy if exists "Users can insert assignments" on assignments;
drop policy if exists "Users can read their assignments" on assignments;
drop policy if exists "Users can update their own assignments" on assignments;
drop policy if exists "Users can delete their own assignments" on assignments;

create policy "Teachers can insert assignments"
  on assignments
  for insert
  with check (created_by = auth.uid());

create policy "Everyone can view assignments"
  on assignments
  for select
  using (true);

create policy "Teachers can update their own assignments"
  on assignments
  for update
  using (created_by = auth.uid());

create policy "Teachers can delete their own assignments"
  on assignments
  for delete
  using (created_by = auth.uid());

-- Timetables Policies
drop policy if exists "Users can insert their own timetables" on timetables;
drop policy if exists "Users can update their own timetables" on timetables;
drop policy if exists "Users can delete their own timetables" on timetables;
drop policy if exists "Anyone can view all timetables" on timetables;
drop policy if exists "Users can insert timetables" on timetables;
drop policy if exists "Users can read their timetables" on timetables;
drop policy if exists "Users can update their own timetables" on timetables;
drop policy if exists "Users can delete their own timetables" on timetables;

create policy "Teachers can insert timetables"
  on timetables
  for insert
  with check (created_by = auth.uid());

create policy "Everyone can view timetables"
  on timetables
  for select
  using (true);

create policy "Teachers can update their own timetables"
  on timetables
  for update
  using (created_by = auth.uid());

create policy "Teachers can delete their own timetables"
  on timetables
  for delete
  using (created_by = auth.uid());

-- Notes Policies
drop policy if exists "Users can insert their own notes" on notes;
drop policy if exists "Users can update their own notes" on notes;
drop policy if exists "Users can delete their own notes" on notes;
drop policy if exists "Anyone can view all notes" on notes;
drop policy if exists "Users can insert notes" on notes;
drop policy if exists "Users can read their notes" on notes;
drop policy if exists "Users can update their own notes" on notes;
drop policy if exists "Users can delete their own notes" on notes;

create policy "Teachers can insert notes"
  on notes
  for insert
  with check (created_by = auth.uid());

create policy "Everyone can view notes"
  on notes
  for select
  using (true);

create policy "Teachers can update their own notes"
  on notes
  for update
  using (created_by = auth.uid());

create policy "Teachers can delete their own notes"
  on notes
  for delete
  using (created_by = auth.uid());

create policy "Users can update their own assignments"
  on assignments
  for update
  using (created_by = auth.uid());

create policy "Users can delete their own assignments"
  on assignments
  for delete
  using (created_by = auth.uid());

-- Timetables Policies
drop policy if exists "Users can insert their own timetables" on timetables;
drop policy if exists "Users can update their own timetables" on timetables;
drop policy if exists "Users can delete their own timetables" on timetables;
drop policy if exists "Anyone can view all timetables" on timetables;

create policy "Users can insert timetables"
  on timetables
  for insert
  with check (created_by = auth.uid());

create policy "Users can read their timetables"
  on timetables
  for select
  using (created_by = auth.uid());

create policy "Users can update their own timetables"
  on timetables
  for update
  using (created_by = auth.uid());

create policy "Users can delete their own timetables"
  on timetables
  for delete
  using (created_by = auth.uid());

-- Notes Policies
drop policy if exists "Users can insert their own notes" on notes;
drop policy if exists "Users can update their own notes" on notes;
drop policy if exists "Users can delete their own notes" on notes;
drop policy if exists "Anyone can view all notes" on notes;

create policy "Users can insert notes"
  on notes
  for insert
  with check (created_by = auth.uid());

create policy "Users can read their notes"
  on notes
  for select
  using (created_by = auth.uid());

create policy "Users can update their own notes"
  on notes
  for update
  using (created_by = auth.uid());

create policy "Users can delete their own notes"
  on notes
  for delete
  using (created_by = auth.uid());
