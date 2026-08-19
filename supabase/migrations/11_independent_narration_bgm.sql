-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) 11_independent_narration_bgm.sql
-- 나레이션(narration_mode) / 배경음악(include_bgm)을 독립 옵션으로 분리하고,
-- 큐레이션 BGM 라이브러리(bgm_tracks) 설계를 폐기한다 - 뚝딱쇼츠는 음원을
-- 제공하지 않고 사용자가 직접 업로드한 파일만 사용한다.
-- ============================================================================

-- 1. 기존 'music_only' 데이터를 'none'으로 선(先) 이관 (제약 교체 전에 실행)
update public.projects set narration_mode = 'none' where narration_mode = 'music_only';

-- 2. narration_mode 체크 제약 교체: 'ai_voice' | 'music_only' -> 'ai_voice' | 'none'
alter table public.projects drop constraint if exists projects_narration_mode_check;
alter table public.projects
  add constraint projects_narration_mode_check check (narration_mode in ('ai_voice', 'none'));

-- 3. 배경음악 독립 컬럼 추가 (bgm_track_id 대체)
alter table public.projects
  add column if not exists include_bgm boolean not null default false,
  add column if not exists bgm_url text default null;

alter table public.projects drop column if exists bgm_track_id;

-- 4. save_project_scenes RPC 재생성: p_bgm_track_id(uuid) -> p_include_bgm(boolean) + p_bgm_url(text)
drop function if exists public.save_project_scenes(uuid, integer, text, text, text, text, text[], text, text, jsonb, text, uuid);

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
  p_include_bgm boolean default null,
  p_bgm_url text default null
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

  if p_narration_mode is not null and p_narration_mode not in ('ai_voice', 'none') then
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
      include_bgm = coalesce(p_include_bgm, include_bgm),
      bgm_url = coalesce(p_bgm_url, bgm_url),
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

revoke all on function public.save_project_scenes(uuid, integer, text, text, text, text, text[], text, text, jsonb, text, boolean, text) from public;
grant execute on function public.save_project_scenes(uuid, integer, text, text, text, text, text[], text, text, jsonb, text, boolean, text) to authenticated;

-- 5. 큐레이션 BGM 라이브러리 폐기: 테이블/버킷/정책 삭제 (빈 테이블, 데이터 손실 없음)
drop policy if exists "Authenticated users can view bgm tracks" on storage.objects;
delete from storage.buckets where id = 'bgm-tracks';
drop table if exists public.bgm_tracks;
