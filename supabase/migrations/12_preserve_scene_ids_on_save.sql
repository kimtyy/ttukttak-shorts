-- ============================================================================
-- 뚝딱쇼츠 (ttukttak-shorts) 12_preserve_scene_ids_on_save.sql
-- save_project_scenes 버그 수정: 자동저장마다 씬 id가 새로 발급되던 문제
-- ============================================================================
--
-- save_project_scenes는 씬을 delete 후 재삽입하면서 id 컬럼을 지정하지 않아
-- 매번 uuid_generate_v4()로 완전히 새로운 id가 발급되고 있었다. 클라이언트
-- (SceneEditor)는 최초 페이지 로드 시점의 id를 그대로 들고 있어서, 한 번이라도
-- 자동저장이 일어난 뒤에는 클라이언트-서버 id가 서로 달라진다.
--
-- 실제로 발생한 증상: "AI 나레이션 생성" 응답의 scenes를 클라이언트가
-- `data.scenes.find(sc => sc.id === s.id)`로 매칭하는데, 이미 한 번 자동저장이
-- 지나간 뒤라 id가 전혀 안 맞아서 매칭이 항상 실패 -> 방금 생성된 audio_url이
-- 로컬 상태에 반영되지 않고, 뒤이은 자동저장이 그 오래된(무음) 상태를 그대로
-- 덮어써서 서버에 잠깐 저장됐던 나레이션 오디오까지 같이 날아갔다.
--
-- 수정: 클라이언트가 보낸 id가 유효한 uuid면 그대로 재사용하고, 새로 추가된
-- 씬처럼 uuid가 아닌 임시 id(sc_1755... 등)인 경우에만 새 uuid를 발급한다.
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
  v_scene_id uuid;
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

  -- 2. Clear Existing Scenes & Re-insert (id는 가능하면 그대로 보존)
  delete from public.scenes where project_id = p_project_id;

  for v_scene in select * from jsonb_array_elements(p_scenes)
  loop
    begin
      v_scene_id := (v_scene->>'id')::uuid;
    exception when others then
      v_scene_id := uuid_generate_v4();
    end;

    insert into public.scenes (
      id,
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
      v_scene_id,
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
