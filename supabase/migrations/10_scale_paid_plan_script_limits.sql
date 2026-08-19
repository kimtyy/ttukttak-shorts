-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) 10_scale_paid_plan_script_limits.sql
-- 유료 플랜 월간 대본 생성 한도 상향 (Free 30회 인상에 맞춘 차등 유지)
-- ============================================================================

-- 대본 생성 원가가 미미하므로 상향하되, Free(30)와의 차별성이 남도록 플랜 간
-- 배수 구조는 유지한다. 렌더링/발행 한도(monthly_render_limit,
-- monthly_publish_limit)는 실제 원가 부담이 커서 그대로 둔다.
--
-- 참고: 이 수치는 임시 조치다. 장기적으로는 유료화 기준을 "생성 횟수"가 아니라
-- "채널 운영 지속성"(AI 추천받기 재설계) 쪽으로 옮겨갈 계획이므로, 이 마이그레이션은
-- 그 재설계 전까지의 과도기적 값으로 취급한다.
update public.plans set monthly_script_limit = 100 where code = 'light';
update public.plans set monthly_script_limit = 300 where code = 'creator';
update public.plans set monthly_script_limit = 1000 where code = 'business';
