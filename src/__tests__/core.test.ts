import { describe, it, expect } from "vitest";
import { ShortsScene } from "@/types";

export type VideoPurpose =
  | "free"
  | "business_promotion"
  | "product_menu"
  | "sale_event"
  | "app_service"
  | "information"
  | "story"
  | "review"
  | "education"
  | "local_travel"
  | "notice"
  | "recruitment"
  | "custom";

export type LaunchStatus =
  | "released"
  | "beta"
  | "pre_registration"
  | "in_development"
  | "partner_recruitment";

export function validateSceneDurations(targetDuration: number, scenes: ShortsScene[]) {
  if (![15, 30, 45, 60].includes(targetDuration)) {
    throw new Error("INVALID_PROJECT_DURATION");
  }

  let sum = 0;
  for (const scene of scenes) {
    if (!Number.isInteger(scene.duration) || scene.duration < 1) {
      throw new Error(`INVALID_SCENE_DURATION: Scene duration must be integer >= 1`);
    }
    sum += scene.duration;
  }

  if (sum !== targetDuration) {
    throw new Error(`DURATION_MISMATCH: Scenes total (${sum}s) does not match target (${targetDuration}s)`);
  }

  return true;
}

export function validateLaunchStatusCTA(status: LaunchStatus | undefined, cta: string) {
  if (!status) return true;
  const lowerCTA = cta.toLowerCase();

  if (status === "in_development" && (lowerCTA.includes("설치") || lowerCTA.includes("다운로드"))) {
    throw new Error("INVALID_CTA_FOR_DEVELOPMENT: 개발 중인 서비스에는 '설치/다운로드' CTA를 권장하지 않습니다.");
  }
  if (status === "beta" && lowerCTA.includes("정식 구매")) {
    throw new Error("INVALID_CTA_FOR_BETA: 베타 서비스에는 '베타테스터 모집' CTA를 사용해야 합니다.");
  }
  return true;
}

export function sanitizeRecommendationPayload(rec: {
  title: string;
  source: string;
  trendVerified: boolean;
}) {
  const allowedSources = ["ai_general", "user_profile", "seasonal", "evergreen"];
  const finalSource = allowedSources.includes(rec.source) ? rec.source : "ai_general";

  return {
    ...rec,
    source: finalSource,
    trendVerified: false,
  };
}

describe("1단계 Core Logic Unit Tests", () => {
  it("장면 duration 합계가 targetDuration과 정확히 일치할 때 통과한다", () => {
    const mockScenes: ShortsScene[] = [
      { id: "1", scene_number: 1, role: "hook", duration: 5, narration: "A", caption: "A", visual_description: "A", image_prompt: "A", required_asset: "", asset_source: "text_motion", motion: "static", transition: "cut" },
      { id: "2", scene_number: 2, role: "feature", duration: 15, narration: "B", caption: "B", visual_description: "B", image_prompt: "B", required_asset: "", asset_source: "text_motion", motion: "static", transition: "cut" },
      { id: "3", scene_number: 3, role: "cta", duration: 10, narration: "C", caption: "C", visual_description: "C", image_prompt: "C", required_asset: "", asset_source: "text_motion", motion: "static", transition: "cut" },
    ];

    expect(validateSceneDurations(30, mockScenes)).toBe(true);
  });

  it("장면 duration 합계가 불일치하거나 소수점인 경우 오류를 반환한다", () => {
    const invalidSumScenes: ShortsScene[] = [
      { id: "1", scene_number: 1, role: "hook", duration: 5, narration: "A", caption: "A", visual_description: "A", image_prompt: "A", required_asset: "", asset_source: "text_motion", motion: "static", transition: "cut" },
      { id: "2", scene_number: 2, role: "feature", duration: 10, narration: "B", caption: "B", visual_description: "B", image_prompt: "B", required_asset: "", asset_source: "text_motion", motion: "static", transition: "cut" },
    ];

    expect(() => validateSceneDurations(30, invalidSumScenes)).toThrow("DURATION_MISMATCH");
  });

  it("출시 상태가 개발 중(in_development)일 때 '지금 설치' CTA를 금지한다", () => {
    expect(() => validateLaunchStatusCTA("in_development", "지금 설치하세요!")).toThrow("INVALID_CTA_FOR_DEVELOPMENT");
    expect(validateLaunchStatusCTA("in_development", "사전 예약 신청하기")).toBe(true);
  });

  it("AI 추천 Payload의 trendVerified는 항상 false로 강제 보정된다", () => {
    const rawAiResponse = {
      title: "급상승 실시간 메밀국수 릴스",
      source: "verified_trend",
      trendVerified: true,
    };

    const sanitized = sanitizeRecommendationPayload(rawAiResponse);
    expect(sanitized.trendVerified).toBe(false);
    expect(sanitized.source).toBe("ai_general");
  });
});
