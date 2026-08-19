-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) 08_my_assets_feature.sql
-- "내 자료로 만들기": 사용자 업로드 사진 기반 대본 생성 + 나레이션 모드(BGM) 지원
-- ============================================================================

-- 1. BGM TRACKS TABLE
create table if not exists public.bgm_tracks (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  storage_path text not null,
  duration_seconds integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.bgm_tracks enable row level security;

drop policy if exists "Authenticated users can view active bgm tracks" on public.bgm_tracks;
create policy "Authenticated users can view active bgm tracks" on public.bgm_tracks
  for select using (auth.role() = 'authenticated' and is_active = true);

-- 2. PROJECTS: narration_mode / bgm_track_id
alter table public.projects
  add column if not exists narration_mode text not null default 'ai_voice'
    check (narration_mode in ('ai_voice', 'music_only')),
  add column if not exists bgm_track_id uuid references public.bgm_tracks(id) on delete set null;

-- 3. BUG FIX + EXTEND: save_project_scenes
-- 기존 버전은 scenes를 delete/재삽입하면서 image_url/audio_url/video_url/media_status를
-- INSERT 컬럼 목록에서 빠뜨려, 씬 편집기의 자동저장이 한 번이라도 발동하면 이미
-- 생성/업로드된 미디어 URL이 전부 사라지는 문제가 있었다. 아래에서 해당 컬럼들을
-- 채우도록 고치고, narration_mode/bgm_track_id 저장도 같은 RPC에 편승시킨다.
create or replace function public.save_project_scenes(
  p_project_id uuid,
  p_version integer,
  p_title text,
  p_hook text,
  p_thumbnail_text text,
  p_description text,
  p_hashtags text[],
  p_total_narration text,
  p_content_strategy text,
  p_scenes jsonb,
  p_narration_mode text default null,
  p_bgm_track_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_project record;
  v_scene jsonb;
  v_new_version integer;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED: User is not authenticated';
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id AND user_id = v_user_id;

  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND: Project does not exist or unauthorized';
  end if;

  if v_project.version != p_version then
    raise exception 'SAVE_CONFLICT: Project version mismatch (Current: %, Submitted: %)',
      v_project.version, p_version;
  end if;

  if p_narration_mode is not null and p_narration_mode not in ('ai_voice', 'music_only') then
    raise exception 'INVALID_NARRATION_MODE: % is not a supported narration_mode', p_narration_mode;
  end if;

  v_new_version := v_project.version + 1;

  -- 1. Update Project Header
  update public.projects
  set title = coalesce(p_title, title),
      hook = coalesce(p_hook, hook),
      thumbnail_text = coalesce(p_thumbnail_text, thumbnail_text),
      description = coalesce(p_description, description),
      hashtags = coalesce(p_hashtags, hashtags),
      total_narration = coalesce(p_total_narration, total_narration),
      content_strategy = coalesce(p_content_strategy, content_strategy),
      narration_mode = coalesce(p_narration_mode, narration_mode),
      bgm_track_id = coalesce(p_bgm_track_id, bgm_track_id),
      version = v_new_version,
      updated_at = now()
  where id = p_project_id and user_id = v_user_id;

  -- 2. Clear Existing Scenes & Re-insert
  delete from public.scenes where project_id = p_project_id;

  for v_scene in select * from jsonb_array_elements(p_scenes)
  loop
    insert into public.scenes (
      project_id,
      scene_number,
      role,
      duration,
      narration,
      caption,
      visual_description,
      image_prompt,
      required_asset,
      asset_source,
      motion,
      transition,
      image_url,
      audio_url,
      video_url,
      media_status
    )
    values (
      p_project_id,
      (v_scene->>'scene_number')::integer,
      (v_scene->>'role')::public.scene_role,
      (v_scene->>'duration')::integer,
      v_scene->>'narration',
      v_scene->>'caption',
      v_scene->>'visual_description',
      v_scene->>'image_prompt',
      coalesce(v_scene->>'required_asset', ''),
      (v_scene->>'asset_source')::public.asset_source,
      (v_scene->>'motion')::public.scene_motion,
      (v_scene->>'transition')::public.scene_transition,
      v_scene->>'image_url',
      v_scene->>'audio_url',
      v_scene->>'video_url',
      coalesce(v_scene->>'media_status', 'pending')
    );
  end loop;

  return v_new_version;
end;
$$;

revoke all on function public.save_project_scenes(uuid, integer, text, text, text, text, text[], text, text, jsonb, text, uuid) from public;
grant execute on function public.save_project_scenes(uuid, integer, text, text, text, text, text[], text, text, jsonb, text, uuid) to authenticated;

-- 4. STORAGE BUCKETS
-- 공개 버킷 + UUID 기반 경로(사실상 추측 불가능한 URL). 이 프로젝트에는 signed-url
-- 갱신 인프라가 없고, generate-media도 이미지 URL을 scenes.image_url에 영구 저장하는
-- 방식이라 렌더 워커가 재렌더 시점마다 새 URL을 발급받을 필요가 없도록 동일한 패턴을 따른다.
insert into storage.buckets (id, name, public)
values ('project-uploads', 'project-uploads', true), ('bgm-tracks', 'bgm-tracks', true)
on conflict (id) do nothing;

-- project-uploads: 인증된 사용자는 자기 user_id 폴더(첫 경로 세그먼트)에만 read/write 가능
drop policy if exists "Users can upload to own folder" on storage.objects;
create policy "Users can upload to own folder" on storage.objects
  for insert with check (
    bucket_id = 'project-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can view own uploads" on storage.objects;
create policy "Users can view own uploads" on storage.objects
  for select using (
    bucket_id = 'project-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- bgm-tracks: 인증된 사용자는 조회만 가능 (등록은 service_role의 seed 스크립트로)
drop policy if exists "Authenticated users can view bgm tracks" on storage.objects;
create policy "Authenticated users can view bgm tracks" on storage.objects
  for select using (
    bucket_id = 'bgm-tracks'
    and auth.role() = 'authenticated'
  );
