-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) Phase 2 DB Schema Migration (04_phase2_schema.sql)
-- 영상 서버 렌더링, YouTube 자동 업로드, 캐릭터 일관성 MVP, 원장 쿼터 연결
-- ============================================================================

-- 1. EXTEND ENUM TYPES
alter type public.usage_action add value if not exists 'video_render';
alter type public.usage_action add value if not exists 'youtube_publish';

-- 2. EXTEND PLANS TABLE WITH RENDER & PUBLISH LIMITS
alter table public.plans
  add column if not exists monthly_render_limit integer not null default 3,
  add column if not exists monthly_publish_limit integer not null default 5;

-- Update seed plan limits
update public.plans set monthly_render_limit = 3, monthly_publish_limit = 5 where code = 'free';
update public.plans set monthly_render_limit = 20, monthly_publish_limit = 30 where code = 'light';
update public.plans set monthly_render_limit = 80, monthly_publish_limit = 100 where code = 'creator';
update public.plans set monthly_render_limit = 300, monthly_publish_limit = 300 where code = 'business';

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

-- 8. UPDATE USAGE LEDGER RPC: reserve_usage() SUPPORTING video_render & youtube_publish
create or replace function public.reserve_usage(
  p_job_type public.usage_action,
  p_idempotency_key text,
  p_quantity integer default 1,
  p_description text default ''
)
returns table (
  job_id uuid,
  already_exists boolean,
  current_status public.job_status
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_sub record;
  v_plan record;
  v_limit integer := 0;
  v_committed_used integer := 0;
  v_pending_used integer := 0;
  v_total_used integer := 0;
  v_existing_job record;
  v_new_job_id uuid;
begin
  -- 1. Verify User Authentication
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: User is not authenticated';
  end if;

  -- 2. Validate Job Type (Updated whitelist)
  if p_job_type not in ('script_generation', 'script_regeneration', 'topic_recommendation', 'video_render', 'youtube_publish') then
    raise exception 'INVALID_JOB_TYPE: Job type % is not supported for reservation', p_job_type;
  end if;

  -- 3. Check Existing Job by Idempotency Key
  select id, status into v_existing_job
  from public.generation_jobs
  where user_id = v_user_id
    and job_type = p_job_type
    and idempotency_key = p_idempotency_key
  limit 1;

  if v_existing_job.id is not null then
    job_id := v_existing_job.id;
    already_exists := true;
    current_status := v_existing_job.status;
    return next;
    return;
  end if;

  -- 4. Lock Active Subscription for UPDATE
  select * into v_sub
  from public.subscriptions
  where user_id = v_user_id
    and status in ('active', 'trialing', 'past_due')
  order by created_at desc
  limit 1
  for update;

  if v_sub.id is null then
    raise exception 'NO_ACTIVE_SUBSCRIPTION: No active subscription found for user';
  end if;

  -- Auto-renew period if current time is past period end
  if now() > v_sub.current_period_end then
    update public.subscriptions
    set current_period_start = now(),
        current_period_end = now() + interval '1 month',
        updated_at = now()
    where id = v_sub.id;

    v_sub.current_period_start := now();
    v_sub.current_period_end := now() + interval '1 month';
  end if;

  -- 5. Fetch Plan Limits
  select * into v_plan from public.plans where id = v_sub.plan_id;
  if p_job_type in ('script_generation', 'script_regeneration') then
    v_limit := v_plan.monthly_script_limit;
  elsif p_job_type = 'topic_recommendation' then
    v_limit := v_plan.monthly_recommendation_limit;
  elsif p_job_type = 'video_render' then
    v_limit := v_plan.monthly_render_limit;
  elsif p_job_type = 'youtube_publish' then
    v_limit := v_plan.monthly_publish_limit;
  end if;

  -- 6. Sum Committed and Pending Debits in Period
  select coalesce(sum(quantity), 0) into v_committed_used
  from public.usage_ledger
  where user_id = v_user_id
    and action = p_job_type
    and direction = 'debit'
    and status = 'committed'
    and period_start >= v_sub.current_period_start
    and period_end <= v_sub.current_period_end;

  select coalesce(sum(quantity), 0) into v_pending_used
  from public.usage_ledger
  where user_id = v_user_id
    and action = p_job_type
    and direction = 'debit'
    and status = 'pending'
    and period_start >= v_sub.current_period_start
    and period_end <= v_sub.current_period_end;

  v_total_used := v_committed_used + v_pending_used;

  -- 7. Enforce Limit
  if (v_total_used + p_quantity) > v_limit then
    raise exception 'USAGE_LIMIT_EXCEEDED: Limit of % reached for % (Used: %, Requested: %)',
      v_limit, p_job_type, v_total_used, p_quantity;
  end if;

  -- 8. Create Generation Job & Pending Ledger Entry inside try/catch for unique conflict
  begin
    insert into public.generation_jobs (
      user_id,
      job_type,
      status,
      idempotency_key
    )
    values (
      v_user_id,
      p_job_type,
      'processing',
      p_idempotency_key
    )
    returning id into v_new_job_id;

    insert into public.usage_ledger (
      user_id,
      action,
      quantity,
      direction,
      status,
      job_id,
      description,
      idempotency_key,
      period_start,
      period_end
    )
    values (
      v_user_id,
      p_job_type,
      p_quantity,
      'debit',
      'pending',
      v_new_job_id,
      p_description,
      p_idempotency_key,
      v_sub.current_period_start,
      v_sub.current_period_end
    );

    job_id := v_new_job_id;
    already_exists := false;
    current_status := 'processing';
    return next;
    return;
  exception
    when unique_violation then
      select id, status into v_existing_job
      from public.generation_jobs
      where user_id = v_user_id
        and job_type = p_job_type
        and idempotency_key = p_idempotency_key
      limit 1;

      job_id := v_existing_job.id;
      already_exists := true;
      current_status := v_existing_job.status;
      return next;
      return;
  end;
end;
$$;
