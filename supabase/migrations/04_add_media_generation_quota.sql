-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) Migration 04: Media Generation Usage Quota
-- ============================================================================
--
-- /api/projects/[id]/generate-media calls paid Google Imagen 3 and OpenAI TTS
-- APIs but had no plan quota enforcement, unlike script generation and topic
-- recommendation. This adds a dedicated monthly media quota per plan and
-- wires it into the existing reserve_usage / commit_usage / release_usage
-- ledger so media generation is capped and tracked the same way.

-- 1. New usage action for media (image + narration audio) generation
alter type public.usage_action add value if not exists 'media_generation';

-- 2. Per-plan monthly media generation limit
alter table public.plans
  add column if not exists monthly_media_limit integer not null default 10;

update public.plans set monthly_media_limit = 10 where code = 'free';
update public.plans set monthly_media_limit = 50 where code = 'light';
update public.plans set monthly_media_limit = 200 where code = 'creator';
update public.plans set monthly_media_limit = 500 where code = 'business';
