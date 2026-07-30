-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) Migration 03: Link Generation Jobs to Their Outputs
-- ============================================================================
--
-- generation_jobs.project_id existed but was never populated, and
-- topic_recommendations had no link back to the job that created it.
-- Without these links, idempotent retries (same idempotencyKey) could not
-- reliably locate the exact output of a completed job and fell back to
-- "most recent project / recommendations for this user", which can return
-- the wrong data if the user created something else in the meantime.

-- 1. Link topic_recommendations back to the job that created them
alter table public.topic_recommendations
  add column if not exists job_id uuid references public.generation_jobs(id) on delete set null;

-- 2. RPC to link a completed job to its resulting project (script generation)
create or replace function public.link_job_project(
  p_job_id uuid,
  p_project_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_job record;
  v_project record;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: User is not authenticated';
  end if;

  select * into v_job from public.generation_jobs where id = p_job_id;
  if v_job.id is null then
    raise exception 'JOB_NOT_FOUND: Job with id % does not exist', p_job_id;
  end if;
  if v_job.user_id != v_user_id then
    raise exception 'UNAUTHORIZED: Cannot link job belonging to another user';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND: Project with id % does not exist', p_project_id;
  end if;
  if v_project.user_id != v_user_id then
    raise exception 'UNAUTHORIZED: Cannot link project belonging to another user';
  end if;

  update public.generation_jobs
  set project_id = p_project_id
  where id = p_job_id;

  return true;
end;
$$;

revoke all on function public.link_job_project(uuid, uuid) from public;
grant execute on function public.link_job_project(uuid, uuid) to authenticated;

-- 3. Reload PostgREST Schema Cache
notify pgrst, 'reload schema';
