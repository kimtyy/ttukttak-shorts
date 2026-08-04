-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) 03_add_scene_media_urls.sql
-- ============================================================================

-- scenes 테이블에 AI 미디어 생성 결과 URL 및 상태 필드 추가
alter table public.scenes
  add column if not exists image_url text default null,
  add column if not exists audio_url text default null,
  add column if not exists video_url text default null,
  add column if not exists media_status text default 'pending';

-- media_status 인덱스 생성
create index if not exists idx_scenes_media_status on public.scenes(media_status);
