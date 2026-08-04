-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) Migration 06: Public Storage Bucket for Generated Media
-- ============================================================================
--
-- Generated scene images (Google Imagen 3) and narration audio (OpenAI TTS)
-- were being stored as base64 data: URLs directly in scenes.image_url /
-- audio_url and echoed back in full in API responses. That bloats the DB
-- rows and makes /generate-media responses multi-MB for a handful of scenes.
-- This bucket lets the server upload the raw bytes once and store a public
-- URL instead. Generated media isn't sensitive, so a public bucket (object
-- paths are namespaced by project/scene id, not guessable/listable) keeps
-- delivery simple with no signed-URL refresh logic needed.

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'media');

create policy "Authenticated users can update their own media"
on storage.objects for update
to authenticated
using (bucket_id = 'media' and owner = auth.uid());

create policy "Authenticated users can delete their own media"
on storage.objects for delete
to authenticated
using (bucket_id = 'media' and owner = auth.uid());

create policy "Public can read media"
on storage.objects for select
to public
using (bucket_id = 'media');
