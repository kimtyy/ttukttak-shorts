-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) Migration 05: Wire media_generation into reserve_usage
-- ============================================================================
--
-- Split from 04_add_media_generation_quota.sql: PostgreSQL will not let a
-- newly added enum value be referenced within the same transaction that
-- added it, so this migration (which uses 'media_generation' as a value)
-- must run after migration 04 has committed.

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
  if p_job_type not in ('script_generation', 'script_regeneration', 'topic_recommendation', 'media_generation') then
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
  elsif p_job_type = 'media_generation' then
    v_limit := v_plan.monthly_media_limit;
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

-- Reload PostgREST Schema Cache
notify pgrst, 'reload schema';
