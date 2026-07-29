-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) MVP 1단계 Complete DB Migration Schema
-- ============================================================================

-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";

-- 2. ENUM TYPES
create type public.subscription_status as enum (
  'active',
  'trialing',
  'past_due',
  'canceled',
  'expired'
);

create type public.video_purpose as enum (
  'free',
  'business_promotion',
  'product_menu',
  'sale_event',
  'app_service',
  'information',
  'story',
  'review',
  'education',
  'local_travel',
  'notice',
  'recruitment',
  'custom'
);

create type public.launch_status as enum (
  'released',
  'beta',
  'pre_registration',
  'in_development',
  'partner_recruitment'
);

create type public.scene_role as enum (
  'hook',
  'problem',
  'desire',
  'introduction',
  'feature',
  'proof',
  'development',
  'key_point',
  'turning_point',
  'offer',
  'conclusion',
  'cta'
);

create type public.asset_source as enum (
  'user_upload',
  'ai_image',
  'ai_video',
  'screen_recording',
  'stock',
  'text_motion'
);

create type public.scene_motion as enum (
  'slow_zoom_in',
  'slow_zoom_out',
  'pan_left',
  'pan_right',
  'pan_up',
  'pan_down',
  'static',
  'screen_scroll',
  'text_pop'
);

create type public.scene_transition as enum (
  'fade',
  'cross_dissolve',
  'slide_left',
  'slide_right',
  'cut'
);

create type public.recommendation_source as enum (
  'ai_general',
  'user_profile',
  'seasonal',
  'evergreen',
  'uploaded_assets',
  'verified_trend'
);

create type public.project_status as enum (
  'draft',
  'generating',
  'script_completed',
  'failed',
  'archived'
);

create type public.job_status as enum (
  'queued',
  'processing',
  'completed',
  'failed',
  'refunded'
);

create type public.usage_action as enum (
  'script_generation',
  'topic_recommendation',
  'script_regeneration',
  'admin_grant',
  'monthly_reset',
  'refund'
);

create type public.ledger_status as enum (
  'pending',
  'committed',
  'reversed'
);

-- 3. TABLES

-- PROFILES
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  business_type text default '',
  interests text[] default '{}',
  target_audience text default '',
  platforms text[] default '{}',
  preferred_mood text default '',
  experience_level text default 'beginner',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- PLANS
create table public.plans (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  name text not null,
  monthly_script_limit integer not null default 5,
  monthly_recommendation_limit integer not null default 10,
  project_limit integer not null default 10,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- SUBSCRIPTIONS
create table public.subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan_id uuid not null references public.plans(id) on delete restrict,
  status public.subscription_status not null default 'active',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '1 month'),
  trial_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Unique index to guarantee at most 1 active/trialing/past_due subscription per user
create unique index subscriptions_one_current_per_user
on public.subscriptions(user_id)
where status in ('active', 'trialing', 'past_due');

-- PROJECTS
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default '제목 없음',
  topic text not null default '',
  purpose public.video_purpose not null default 'free',
  custom_purpose text default '',
  duration integer not null check (duration in (15, 30, 45, 60)) default 30,
  visual_style text default '',
  voice_style text default '',
  mood text default '',
  brand_name text default '',
  key_message text default '',
  target_audience text default '',
  selling_points text default '',
  required_facts text default '',
  prohibited_expressions text default '',
  call_to_action text default '',
  launch_status public.launch_status,
  hook text default '',
  thumbnail_text text default '',
  description text default '',
  hashtags text[] default '{}',
  total_narration text default '',
  content_strategy text default '',
  status public.project_status not null default 'draft',
  error_message text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- SCENES
create table public.scenes (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  scene_number integer not null check (scene_number >= 1),
  role public.scene_role not null default 'introduction',
  duration integer not null check (duration >= 1),
  narration text not null default '',
  caption text not null default '',
  visual_description text not null default '',
  image_prompt text not null default '',
  required_asset text default '',
  asset_source public.asset_source not null default 'text_motion',
  motion public.scene_motion not null default 'static',
  transition public.scene_transition not null default 'cut',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, scene_number)
);

-- TOPIC RECOMMENDATIONS
create table public.topic_recommendations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  summary text not null default '',
  reason text not null default '',
  audience text not null default '',
  hook text not null default '',
  suggested_duration integer not null check (suggested_duration in (15, 30, 45, 60)) default 30,
  difficulty text not null default 'normal',
  required_assets text[] default '{}',
  purpose public.video_purpose not null default 'free',
  source public.recommendation_source not null default 'ai_general',
  confidence numeric(3,2) not null default 0.90,
  trend_verified boolean not null default false,
  selected_at timestamptz,
  created_at timestamptz not null default now()
);

-- GENERATION JOBS
create table public.generation_jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  job_type public.usage_action not null,
  status public.job_status not null default 'processing',
  idempotency_key text not null,
  provider text not null default 'openai',
  estimated_cost numeric(10,4) default 0,
  actual_cost numeric(10,4) default 0,
  error_code text,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, job_type, idempotency_key)
);

-- USAGE LEDGER
create table public.usage_ledger (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  action public.usage_action not null,
  quantity integer not null check (quantity > 0),
  direction text not null check (direction in ('credit', 'debit')),
  status public.ledger_status not null default 'pending',
  project_id uuid references public.projects(id) on delete set null,
  job_id uuid references public.generation_jobs(id) on delete cascade,
  description text not null default '',
  idempotency_key text,
  period_start timestamptz not null,
  period_end timestamptz not null,
  related_ledger_id uuid references public.usage_ledger(id) on delete set null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 4. SEED INITIAL DATA FOR PLANS
insert into public.plans (code, name, monthly_script_limit, monthly_recommendation_limit, project_limit, is_active)
values
  ('free', 'Free Standard', 5, 10, 10, true),
  ('light', 'Light Starter', 30, 100, 100, true),
  ('creator', 'Creator Pro', 100, 300, 500, true),
  ('business', 'Business Unlimited', 300, 1000, 1000, true)
on conflict (code) do update set
  monthly_script_limit = excluded.monthly_script_limit,
  monthly_recommendation_limit = excluded.monthly_recommendation_limit,
  project_limit = excluded.project_limit;

-- 5. AUTH SIGNUP TRIGGER (FREE SUBSCRIPTION INITIALIZATION)
create or replace function public.handle_new_user_signup()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_free_plan_id uuid;
begin
  -- 1. Create Profile
  insert into public.profiles (id, display_name, onboarding_completed)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', '사용자'),
    false
  )
  on conflict (id) do nothing;

  -- 2. Fetch Free Plan ID
  select id into v_free_plan_id from public.plans where code = 'free' limit 1;

  if v_free_plan_id is not null then
    -- 3. Create Free Subscription
    insert into public.subscriptions (
      user_id,
      plan_id,
      status,
      current_period_start,
      current_period_end
    )
    values (
      new.id,
      v_free_plan_id,
      'active',
      now(),
      now() + interval '1 month'
    )
    on conflict (user_id) where (status in ('active', 'trialing', 'past_due')) do nothing;
  end if;

  return new;
end;
$$;

-- Attach trigger to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user_signup();

-- 6. ROW LEVEL SECURITY (RLS) POLICIES

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.projects enable row level security;
alter table public.scenes enable row level security;
alter table public.topic_recommendations enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.usage_ledger enable row level security;

-- PROFILES RLS
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- PLANS RLS
create policy "Anyone authenticated can view active plans" on public.plans
  for select using (is_active = true);

-- SUBSCRIPTIONS RLS
create policy "Users can view own subscriptions" on public.subscriptions
  for select using (auth.uid() = user_id);

-- PROJECTS RLS
create policy "Users can view own projects" on public.projects
  for select using (auth.uid() = user_id);
create policy "Users can insert own projects" on public.projects
  for insert with check (auth.uid() = user_id);
create policy "Users can update own projects" on public.projects
  for update using (auth.uid() = user_id);
create policy "Users can delete own projects" on public.projects
  for delete using (auth.uid() = user_id);

-- SCENES RLS
create policy "Users can view own project scenes" on public.scenes
  for select using (
    exists (select 1 from public.projects where id = scenes.project_id and user_id = auth.uid())
  );
create policy "Users can insert own project scenes" on public.scenes
  for insert with check (
    exists (select 1 from public.projects where id = scenes.project_id and user_id = auth.uid())
  );
create policy "Users can update own project scenes" on public.scenes
  for update using (
    exists (select 1 from public.projects where id = scenes.project_id and user_id = auth.uid())
  );
create policy "Users can delete own project scenes" on public.scenes
  for delete using (
    exists (select 1 from public.projects where id = scenes.project_id and user_id = auth.uid())
  );

-- TOPIC RECOMMENDATIONS RLS
create policy "Users can view own recommendations" on public.topic_recommendations
  for select using (auth.uid() = user_id);
create policy "Users can insert own recommendations" on public.topic_recommendations
  for insert with check (auth.uid() = user_id);
create policy "Users can update own recommendations" on public.topic_recommendations
  for update using (auth.uid() = user_id);

-- GENERATION JOBS RLS
create policy "Users can view own generation jobs" on public.generation_jobs
  for select using (auth.uid() = user_id);

-- USAGE LEDGER RLS
create policy "Users can view own usage ledger" on public.usage_ledger
  for select using (auth.uid() = user_id);


-- 7. STORED PROCEDURES (RPCs) FOR USAGE & CONCURRENCY CONTROL

-- A. reserve_usage
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

  -- 2. Validate Job Type
  if p_job_type not in ('script_generation', 'script_regeneration', 'topic_recommendation') then
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

  exception when unique_violation then
    -- Catch race condition and return existing job
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
  end;
end;
$$;

revoke all on function public.reserve_usage(public.usage_action, text, integer, text) from public;
grant execute on function public.reserve_usage(public.usage_action, text, integer, text) to authenticated;


-- B. commit_usage
create or replace function public.commit_usage(
  p_job_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_job record;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: User is not authenticated';
  end if;

  select * into v_job from public.generation_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'JOB_NOT_FOUND: Job with id % does not exist', p_job_id;
  end if;

  if v_job.user_id != v_user_id then
    raise exception 'UNAUTHORIZED: Cannot commit job belonging to another user';
  end if;

  if v_job.status = 'completed' then
    return true;
  end if;

  update public.usage_ledger
  set status = 'committed'
  where job_id = p_job_id and status = 'pending';

  update public.generation_jobs
  set status = 'completed',
      completed_at = now()
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function public.commit_usage(uuid) from public;
grant execute on function public.commit_usage(uuid) to authenticated;


-- C. release_usage (Pending Reservation Only)
create or replace function public.release_usage(
  p_job_id uuid,
  p_error_message text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_job record;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: User is not authenticated';
  end if;

  select * into v_job from public.generation_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'JOB_NOT_FOUND: Job with id % does not exist', p_job_id;
  end if;

  if v_job.user_id != v_user_id then
    raise exception 'UNAUTHORIZED: Cannot release job belonging to another user';
  end if;

  -- Only release PENDING ledger items. Do not release committed items here!
  update public.usage_ledger
  set status = 'reversed'
  where job_id = p_job_id and status = 'pending';

  update public.generation_jobs
  set status = 'failed',
      error_message = p_error_message,
      completed_at = now()
  where id = p_job_id and status != 'completed';

  return true;
end;
$$;

revoke all on function public.release_usage(uuid, text) from public;
grant execute on function public.release_usage(uuid, text) to authenticated;


-- D. refund_usage (Committed Job Refund - Service Role Only)
create or replace function public.refund_usage(
  p_job_id uuid,
  p_reason text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
  v_committed_ledger record;
begin
  select * into v_job from public.generation_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'JOB_NOT_FOUND: Job with id % does not exist', p_job_id;
  end if;

  select * into v_committed_ledger
  from public.usage_ledger
  where job_id = p_job_id and status = 'committed'
  limit 1;

  if v_committed_ledger.id is null then
    raise exception 'NO_COMMITTED_LEDGER: Only committed jobs can be refunded';
  end if;

  -- Insert refund credit ledger entry
  insert into public.usage_ledger (
    user_id,
    action,
    quantity,
    direction,
    status,
    job_id,
    description,
    period_start,
    period_end,
    related_ledger_id
  )
  values (
    v_job.user_id,
    'refund',
    v_committed_ledger.quantity,
    'credit',
    'committed',
    p_job_id,
    p_reason,
    v_committed_ledger.period_start,
    v_committed_ledger.period_end,
    v_committed_ledger.id
  );

  update public.generation_jobs
  set status = 'refunded',
      error_message = p_reason
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function public.refund_usage(uuid, text) from public;
revoke all on function public.refund_usage(uuid, text) from authenticated;
grant execute on function public.refund_usage(uuid, text) to service_role;


-- E. save_project_scenes (Optimistic Version Control & Single Transaction Scene Save)
create or replace function public.save_project_scenes(
  p_project_id uuid,
  p_version integer,
  p_title text,
  p_hook text,
  p_thumbnail_text text,
  p_description text,
  p_hashtags text[],
  p_total_narration text,
  p_content_strategy text,
  p_scenes jsonb
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project record;
  v_scene jsonb;
  v_new_version integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: User is not authenticated';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id AND user_id = v_user_id;

  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND: Project does not exist or unauthorized';
  end if;

  if v_project.version != p_version then
    raise exception 'SAVE_CONFLICT: Project version mismatch (Current: %, Submitted: %)',
      v_project.version, p_version;
  end if;

  v_new_version := v_project.version + 1;

  -- 1. Update Project Header
  update public.projects
  set title = coalesce(p_title, title),
      hook = coalesce(p_hook, hook),
      thumbnail_text = coalesce(p_thumbnail_text, thumbnail_text),
      description = coalesce(p_description, description),
      hashtags = coalesce(p_hashtags, hashtags),
      total_narration = coalesce(p_total_narration, total_narration),
      content_strategy = coalesce(p_content_strategy, content_strategy),
      version = v_new_version,
      updated_at = now()
  where id = p_project_id and user_id = v_user_id;

  -- 2. Clear Existing Scenes & Re-insert
  delete from public.scenes where project_id = p_project_id;

  for v_scene in select * from jsonb_array_elements(p_scenes)
  loop
    insert into public.scenes (
      project_id,
      scene_number,
      role,
      duration,
      narration,
      caption,
      visual_description,
      image_prompt,
      required_asset,
      asset_source,
      motion,
      transition
    )
    values (
      p_project_id,
      (v_scene->>'scene_number')::integer,
      (v_scene->>'role')::public.scene_role,
      (v_scene->>'duration')::integer,
      v_scene->>'narration',
      v_scene->>'caption',
      v_scene->>'visual_description',
      v_scene->>'image_prompt',
      coalesce(v_scene->>'required_asset', ''),
      (v_scene->>'asset_source')::public.asset_source,
      (v_scene->>'motion')::public.scene_motion,
      (v_scene->>'transition')::public.scene_transition
    );
  end loop;

  return v_new_version;
end;
$$;

revoke all on function public.save_project_scenes(uuid, integer, text, text, text, text, text[], text, text, jsonb) from public;
grant execute on function public.save_project_scenes(uuid, integer, text, text, text, text, text[], text, text, jsonb) to authenticated;


-- F. duplicate_project (Atomic Project Duplication without deducting quota)
create or replace function public.duplicate_project(
  p_project_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_orig record;
  v_new_project_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: User is not authenticated';
  end if;

  select * into v_orig
  from public.projects
  where id = p_project_id and user_id = v_user_id;

  if v_orig.id is null then
    raise exception 'PROJECT_NOT_FOUND: Project does not exist or unauthorized';
  end if;

  -- 1. Insert New Project Copy
  insert into public.projects (
    user_id,
    title,
    topic,
    purpose,
    custom_purpose,
    duration,
    visual_style,
    voice_style,
    mood,
    brand_name,
    key_message,
    target_audience,
    selling_points,
    required_facts,
    prohibited_expressions,
    call_to_action,
    launch_status,
    hook,
    thumbnail_text,
    description,
    hashtags,
    total_narration,
    content_strategy,
    status
  )
  values (
    v_user_id,
    v_orig.title || ' (복사본)',
    v_orig.topic,
    v_orig.purpose,
    v_orig.custom_purpose,
    v_orig.duration,
    v_orig.visual_style,
    v_orig.voice_style,
    v_orig.mood,
    v_orig.brand_name,
    v_orig.key_message,
    v_orig.target_audience,
    v_orig.selling_points,
    v_orig.required_facts,
    v_orig.prohibited_expressions,
    v_orig.call_to_action,
    v_orig.launch_status,
    v_orig.hook,
    v_orig.thumbnail_text,
    v_orig.description,
    v_orig.hashtags,
    v_orig.total_narration,
    v_orig.content_strategy,
    v_orig.status
  )
  returning id into v_new_project_id;

  -- 2. Copy Scenes
  insert into public.scenes (
    project_id,
    scene_number,
    role,
    duration,
    narration,
    caption,
    visual_description,
    image_prompt,
    required_asset,
    asset_source,
    motion,
    transition
  )
  select
    v_new_project_id,
    scene_number,
    role,
    duration,
    narration,
    caption,
    visual_description,
    image_prompt,
    required_asset,
    asset_source,
    motion,
    transition
  from public.scenes
  where project_id = p_project_id;

  return v_new_project_id;
end;
$$;

revoke all on function public.duplicate_project(uuid) from public;
grant execute on function public.duplicate_project(uuid) to authenticated;
