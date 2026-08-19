import { ShortsScene } from "@/types";

/**
 * GPT-4o가 json_object 모드에서 "제공된 이미지를 모두 사용하라"는 지침을
 * 항상 완벽히 지키지는 않는다(사진이 많고 목표 길이가 짧을수록 일부 이미지를
 * 누락하는 경향 확인됨). 여기서 서버 측으로 누락된 이미지마다 짧은 필러 씬을
 * 추가해 업로드한 사진이 전부 최소 한 번은 영상에 등장하도록 보정한다.
 *
 * 전체 duration은 목표 길이를 넘지 않도록, 기존 씬들의 길이를 비례해서 줄여
 * 확보한다(총 길이를 늘려 사용자에게 안내하는 방식보다 구현이 단순하고,
 * SceneEditor의 duration 일치 검증과도 충돌하지 않음).
 */

const MIN_SCENE_DURATION = 1;
const DESIRED_FILLER_DURATION = 3;

export function fillUnusedUploadedImages(
  scenes: ShortsScene[],
  imagesCount: number,
  targetDuration: number,
  brandName?: string
): ShortsScene[] {
  const usedIndices = new Set(
    scenes.map((s) => s.source_image_index).filter((i): i is number => typeof i === "number")
  );
  const unusedIndices = Array.from({ length: imagesCount }, (_, i) => i).filter((i) => !usedIndices.has(i));

  if (unusedIndices.length === 0 || scenes.length === 0) {
    return scenes;
  }

  const existingCount = scenes.length;
  const minExistingTotal = existingCount * MIN_SCENE_DURATION;

  // 1. 기본 필러 길이(3초)로 시도
  let fillerDuration = DESIRED_FILLER_DURATION;
  let fillerTotal = fillerDuration * unusedIndices.length;
  let remainingForExisting = targetDuration - fillerTotal;

  // 2. 공간이 부족하면 필러 길이를 줄인다 (최소 1초)
  if (remainingForExisting < minExistingTotal) {
    fillerDuration = Math.max(
      MIN_SCENE_DURATION,
      Math.floor((targetDuration - minExistingTotal) / unusedIndices.length)
    );
    fillerTotal = fillerDuration * unusedIndices.length;
    remainingForExisting = targetDuration - fillerTotal;
  }

  // 3. 그래도 부족하면(사진이 지나치게 많고 목표 길이가 짧음) 들어갈 수 있는
  //    만큼만 필러 씬을 추가한다 (나머지 사진은 이번 영상에서는 미사용으로 남음)
  let cappedUnused = unusedIndices;
  if (remainingForExisting < minExistingTotal) {
    const maxFillers = Math.max(0, Math.floor((targetDuration - minExistingTotal) / fillerDuration));
    cappedUnused = unusedIndices.slice(0, maxFillers);
    fillerTotal = fillerDuration * cappedUnused.length;
    remainingForExisting = targetDuration - fillerTotal;
  }

  if (cappedUnused.length === 0) {
    return scenes;
  }

  const existingTotal = scenes.reduce((acc, s) => acc + s.duration, 0);
  const shrinkFactor = existingTotal > 0 ? remainingForExisting / existingTotal : 0;

  const shrunkScenes = scenes.map((s) => ({
    ...s,
    duration: Math.max(MIN_SCENE_DURATION, Math.round(s.duration * shrinkFactor)),
  }));

  const fillerCaption = brandName ? `${brandName}의 모습` : "";

  const fillerScenes: ShortsScene[] = cappedUnused.map((imgIdx) => ({
    id: `sc_filler_${imgIdx}`,
    scene_number: 0, // 호출 측에서 배열 순서 기준으로 재계산됨
    role: "development",
    duration: fillerDuration,
    narration: "",
    caption: fillerCaption,
    visual_description: "",
    image_prompt: "",
    required_asset: "",
    asset_source: "user_upload",
    motion: "static",
    transition: "cut",
    source_image_index: imgIdx,
  }));

  // 마지막 씬(대개 cta)은 그대로 마지막에 남기고, 그 앞에 필러 씬들을 끼워 넣는다
  const result =
    shrunkScenes.length > 1
      ? [...shrunkScenes.slice(0, -1), ...fillerScenes, shrunkScenes[shrunkScenes.length - 1]]
      : [...fillerScenes, ...shrunkScenes];

  // 반올림 오차는 마지막 씬에서 흡수해 총합을 목표와 정확히 맞춘다
  const totalNow = result.reduce((acc, s) => acc + s.duration, 0);
  const diff = targetDuration - totalNow;
  if (diff !== 0) {
    const lastIdx = result.length - 1;
    result[lastIdx] = {
      ...result[lastIdx],
      duration: Math.max(MIN_SCENE_DURATION, result[lastIdx].duration + diff),
    };
  }

  return result;
}
