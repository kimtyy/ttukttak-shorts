-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) 09_increase_free_script_limit.sql
-- Free 플랜 월간 대본 생성 한도를 5회 -> 30회로 상향
-- ============================================================================

-- 대본 생성(script_generation) 원가는 건당 약 2원 수준으로 미미하다.
-- 실제 원가 부담이 큰 미디어 생성(monthly_render_limit)/발행(monthly_publish_limit)
-- 한도는 변경하지 않고, 사용자가 여러 번 시도·다듬어볼 수 있도록 대본 생성 한도만 넉넉하게 연다.
update public.plans
set monthly_script_limit = 30
where code = 'free';
