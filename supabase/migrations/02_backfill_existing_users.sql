-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) Migration 02: Backfill Existing Auth Users
-- ============================================================================

-- 1. Create missing profiles for existing auth.users
insert into public.profiles (id, display_name, onboarding_completed, created_at, updated_at)
select
  u.id,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)),
  false,
  u.created_at,
  now()
from auth.users u
where not exists (
  select 1 from public.profiles p where p.id = u.id
);

-- 2. Create missing active Free subscriptions for existing auth.users
do $$
declare
  v_free_plan_id uuid;
  v_user record;
begin
  select id into v_free_plan_id from public.plans where code = 'free' limit 1;

  if v_free_plan_id is not null then
    for v_user in (
      select u.id, u.created_at
      from auth.users u
      where not exists (
        select 1 from public.subscriptions s
        where s.user_id = u.id
          and s.status in ('active', 'trialing', 'past_due')
      )
    ) loop
      insert into public.subscriptions (
        user_id,
        plan_id,
        status,
        current_period_start,
        current_period_end,
        canceled_at,
        created_at,
        updated_at
      ) values (
        v_user.id,
        v_free_plan_id,
        'active',
        now(),
        now() + interval '1 month',
        null,
        v_user.created_at,
        now()
      );
    end loop;
  end if;
end $$;

-- 3. Reload PostgREST Schema Cache
notify pgrst, 'reload schema';
