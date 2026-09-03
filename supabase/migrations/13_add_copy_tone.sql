-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) 13_add_copy_tone.sql
-- 대본 문체 스타일(copy_tone) 선택 옵션 추가
-- ============================================================================

alter table public.projects
  add column if not exists copy_tone text not null default 'concise'
    check (copy_tone in ('concise', 'narrative'));
