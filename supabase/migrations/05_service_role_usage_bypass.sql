-- ============================================================================
-- 05_service_role_usage_bypass.sql
-- Adds service_role-only overloads of commit_usage/release_usage that accept an
-- explicit p_user_id, for use by background render workers that authenticate to
-- Supabase with the service role key (and therefore have no auth.uid() / no JWT
-- "sub" claim to rely on).
--
-- The original single-arg commit_usage(uuid) / release_usage(uuid, text) functions
-- are UNCHANGED and remain the path used by regular authenticated-user sessions.
-- ============================================================================

-- A. commit_usage(p_job_id, p_user_id) -- service_role only
create or replace function public.commit_usage(
  p_job_id uuid,
  p_user_id uuid,
  p_description text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN: This commit_usage overload is restricted to service_role callers';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_ARGUMENT: p_user_id is required for the service_role overload';
  end if;

  select * into v_job from public.generation_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'JOB_NOT_FOUND: Job with id % does not exist', p_job_id;
  end if;

  if v_job.user_id != p_user_id then
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

revoke all on function public.commit_usage(uuid, uuid, text) from public;
revoke all on function public.commit_usage(uuid, uuid, text) from anon;
revoke all on function public.commit_usage(uuid, uuid, text) from authenticated;
grant execute on function public.commit_usage(uuid, uuid, text) to service_role;


-- B. release_usage(p_job_id, p_user_id, p_error_message) -- service_role only
create or replace function public.release_usage(
  p_job_id uuid,
  p_user_id uuid,
  p_error_message text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job record;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'FORBIDDEN: This release_usage overload is restricted to service_role callers';
  end if;

  if p_user_id is null then
    raise exception 'INVALID_ARGUMENT: p_user_id is required for the service_role overload';
  end if;

  select * into v_job from public.generation_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'JOB_NOT_FOUND: Job with id % does not exist', p_job_id;
  end if;

  if v_job.user_id != p_user_id then
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

revoke all on function public.release_usage(uuid, uuid, text) from public;
revoke all on function public.release_usage(uuid, uuid, text) from anon;
revoke all on function public.release_usage(uuid, uuid, text) from authenticated;
grant execute on function public.release_usage(uuid, uuid, text) to service_role;
