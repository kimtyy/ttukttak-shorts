-- ============================================================================
-- 06_phase2_missing_tables.sql
-- Extracted verbatim from 04_phase2_schema.sql sections 3-7 (lines 21-161).
--
-- Live-DB investigation on 2026-08-05 confirmed via information_schema (run
-- directly in the SQL Editor, which sees all schemas unlike PostgREST which
-- only exposes public/graphql_public) that render_jobs, publish_jobs,
-- platform_connections and character_profiles were NEVER created in this
-- production project -- only sections 1 (enum), 2 (plans columns) and 8
-- (reserve_usage replacement) of 04_phase2_schema.sql had actually been run
-- against it before today. This file applies exactly the missing piece:
-- table creation + indexes + RLS enable + RLS policies. It intentionally
-- excludes the enum/plans/reserve_usage sections since those are already applied
-- and this file is not meant to be a full re-run of 04_phase2_schema.sql.
--
-- Every statement below is idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- so it is safe to run even if some subset had partially landed.
-- ============================================================================

-- 3. RENDER JOBS TABLE
create table if not exists public.render_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  status public.job_status not null default 'processing',
  video_url text default null,
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  error_message text default null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz default null
);

create index if not exists idx_render_jobs_user_id on public.render_jobs(user_id);
create index if not exists idx_render_jobs_project_id on public.render_jobs(project_id);

-- 4. PLATFORM CONNECTIONS TABLE (OAuth encrypted tokens for YouTube/TikTok)
create table if not exists public.platform_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('youtube', 'tiktok', 'instagram')),
  account_name text not null default '',
  account_id text default '',
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  expires_at timestamptz default null,
  scope text default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create index if not exists idx_platform_connections_user on public.platform_connections(user_id, platform);

-- 5. PUBLISH JOBS TABLE (YouTube Shorts Auto-Publish Queue)
create table if not exists public.publish_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  platform text not null default 'youtube' check (platform in ('youtube', 'tiktok', 'instagram')),
  platform_connection_id uuid references public.platform_connections(id) on delete set null,
  status public.job_status not null default 'processing',
  title text not null default '',
  description text default '',
  tags text[] default '{}',
  privacy_status text not null default 'public' check (privacy_status in ('public', 'unlisted', 'private')),
  platform_video_id text default null,
  platform_video_url text default null,
  error_message text default null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz default null
);

create index if not exists idx_publish_jobs_user_id on public.publish_jobs(user_id);
create index if not exists idx_publish_jobs_project_id on public.publish_jobs(project_id);

-- 6. CHARACTER PROFILES TABLE (Character Consistency MVP)
create table if not exists public.character_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text default '',
  reference_image_url text default '',
  fixed_prompt_fragment text default '',
  style_tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_character_profiles_user_id on public.character_profiles(user_id);

-- 7. ENABLE ROW LEVEL SECURITY (RLS) & POLICIES
alter table public.render_jobs enable row level security;
alter table public.platform_connections enable row level security;
alter table public.publish_jobs enable row level security;
alter table public.character_profiles enable row level security;

-- render_jobs RLS
drop policy if exists "Users can view own render jobs" on public.render_jobs;
create policy "Users can view own render jobs" on public.render_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own render jobs" on public.render_jobs;
create policy "Users can insert own render jobs" on public.render_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own render jobs" on public.render_jobs;
create policy "Users can update own render jobs" on public.render_jobs
  for update using (auth.uid() = user_id);

-- platform_connections RLS (Strict user ownership)
drop policy if exists "Users can view own platform connections" on public.platform_connections;
create policy "Users can view own platform connections" on public.platform_connections
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own platform connections" on public.platform_connections;
create policy "Users can insert own platform connections" on public.platform_connections
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own platform connections" on public.platform_connections;
create policy "Users can update own platform connections" on public.platform_connections
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own platform connections" on public.platform_connections;
create policy "Users can delete own platform connections" on public.platform_connections
  for delete using (auth.uid() = user_id);

-- publish_jobs RLS
drop policy if exists "Users can view own publish jobs" on public.publish_jobs;
create policy "Users can view own publish jobs" on public.publish_jobs
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own publish jobs" on public.publish_jobs;
create policy "Users can insert own publish jobs" on public.publish_jobs
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own publish jobs" on public.publish_jobs;
create policy "Users can update own publish jobs" on public.publish_jobs
  for update using (auth.uid() = user_id);

-- character_profiles RLS
drop policy if exists "Users can view own character profiles" on public.character_profiles;
create policy "Users can view own character profiles" on public.character_profiles
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own character profiles" on public.character_profiles;
create policy "Users can insert own character profiles" on public.character_profiles
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own character profiles" on public.character_profiles;
create policy "Users can update own character profiles" on public.character_profiles
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own character profiles" on public.character_profiles;
create policy "Users can delete own character profiles" on public.character_profiles
  for delete using (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
