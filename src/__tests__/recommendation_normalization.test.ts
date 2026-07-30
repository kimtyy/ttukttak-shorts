/**
 * recommendation_normalization.test.ts
 *
 * MVP 1단계 추천 source/trendVerified 정규화 정책 검증
 *
 * 정책:
 * - source 허용값: ai_general | user_profile | seasonal | evergreen (4개)
 * - uploaded_assets, verified_trend → ai_general 로 정규화
 * - 알 수 없는 source → ai_general 로 정규화
 * - trendVerified=true → false 로 강제
 * - suggested_duration 허용 외 값 → 30 으로 보정
 * - 핵심 필드(title, summary, hook 등) 누락 → 검증 실패
 */

import { describe, it, expect } from "vitest";
import { TopicRecommendationSchema, ALLOWED_RECOMMENDATION_SOURCES } from "@/lib/ai/schemas";

// ────────────────────────────────────────────────────────────
// normalizeRawRecommendation 인라인 (provider 로직 동일 복사)
// ────────────────────────────────────────────────────────────
function normalizeRawRecommendation(raw: Record<string, unknown>): Record<string, unknown> {
  const rawSource = raw.source as string | undefined;
  const normalizedSource =
    rawSource && (ALLOWED_RECOMMENDATION_SOURCES as readonly string[]).includes(rawSource)
      ? rawSource
      : "ai_general";

  return {
    ...raw,
    source: normalizedSource,
    trend_verified: false,
  };
}

/** 유효한 추천 항목 기본값 */
const validRec = {
  title: "한식 카페 비하인드 쇼츠",
  summary: "주방 비하인드 영상으로 신뢰를 쌓는 콘텐츠",
  reason: "음식점 브랜드 신뢰도 향상에 효과적입니다.",
  audience: "20-40대 외식 선호 소비자",
  hook: "주방이 이렇게 깨끗할 줄 몰랐죠?",
  suggested_duration: 30,
  difficulty: "normal",
  required_assets: ["주방 사진", "셰프 사진"],
  purpose: "business_promotion",
  source: "user_profile",
  confidence: 0.88,
  trend_verified: false,
};

// ────────────────────────────────────────────────────────────
// 1. Source 정규화 테스트
// ────────────────────────────────────────────────────────────
describe("추천 source 정규화 정책", () => {
  it("verified_trend 입력 → ai_general 저장", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, source: "verified_trend" });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.source).toBe("ai_general");
  });

  it("uploaded_assets 입력 → ai_general 저장", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, source: "uploaded_assets" });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.source).toBe("ai_general");
  });

  it("알 수 없는 source('hot_trend_2025') → ai_general 저장", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, source: "hot_trend_2025" });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.source).toBe("ai_general");
  });

  it("source 누락(undefined) → ai_general 저장", () => {
    const raw = { ...validRec } as Record<string, unknown>;
    delete raw.source;
    const normalized = normalizeRawRecommendation(raw);
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.source).toBe("ai_general");
  });

  it("허용된 source(user_profile)는 그대로 유지", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, source: "user_profile" });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.source).toBe("user_profile");
  });

  it("허용된 source(seasonal)는 그대로 유지", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, source: "seasonal" });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.source).toBe("seasonal");
  });

  it("허용된 source(evergreen)는 그대로 유지", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, source: "evergreen" });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.source).toBe("evergreen");
  });

  it("ALLOWED_RECOMMENDATION_SOURCES 상수는 정확히 4개 값만 포함한다", () => {
    expect(ALLOWED_RECOMMENDATION_SOURCES).toHaveLength(4);
    expect(ALLOWED_RECOMMENDATION_SOURCES).toContain("ai_general");
    expect(ALLOWED_RECOMMENDATION_SOURCES).toContain("user_profile");
    expect(ALLOWED_RECOMMENDATION_SOURCES).toContain("seasonal");
    expect(ALLOWED_RECOMMENDATION_SOURCES).toContain("evergreen");
    expect(ALLOWED_RECOMMENDATION_SOURCES).not.toContain("uploaded_assets");
    expect(ALLOWED_RECOMMENDATION_SOURCES).not.toContain("verified_trend");
  });
});

// ────────────────────────────────────────────────────────────
// 2. trendVerified 강제 false 테스트
// ────────────────────────────────────────────────────────────
describe("trendVerified 서버 강제 정책", () => {
  it("trendVerified=true 입력 → false 저장", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, trend_verified: true });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.trend_verified).toBe(false);
  });

  it("trendVerified=false 입력 → false 유지", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, trend_verified: false });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.trend_verified).toBe(false);
  });

  it("trendVerified 누락 → false 저장", () => {
    const raw = { ...validRec } as Record<string, unknown>;
    delete raw.trend_verified;
    const normalized = normalizeRawRecommendation(raw);
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.trend_verified).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────
// 3. suggested_duration 보정 테스트
// ────────────────────────────────────────────────────────────
describe("suggested_duration 보정 정책", () => {
  it("27 입력 → 30 저장", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, suggested_duration: 27 });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.suggested_duration).toBe(30);
  });

  it("0 입력 → 30 저장", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, suggested_duration: 0 });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.suggested_duration).toBe(30);
  });

  it("문자열 '30' 입력 → 30(숫자) 저장", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, suggested_duration: "30" });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.suggested_duration).toBe(30);
  });


  it("15는 그대로 유지", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, suggested_duration: 15 });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.suggested_duration).toBe(15);
  });

  it("60은 그대로 유지", () => {
    const normalized = normalizeRawRecommendation({ ...validRec, suggested_duration: 60 });
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.suggested_duration).toBe(60);
  });
});

// ────────────────────────────────────────────────────────────
// 4. 핵심 필드 누락 → 검증 실패 테스트
// ────────────────────────────────────────────────────────────
describe("핵심 필드 누락 시 검증 실패", () => {
  const coreFields = ["title", "summary", "reason", "audience", "hook"] as const;

  for (const field of coreFields) {
    it(`${field} 누락 → ZodError 발생`, () => {
      const raw = { ...validRec } as Record<string, unknown>;
      delete raw[field];
      const normalized = normalizeRawRecommendation(raw);
      expect(() => TopicRecommendationSchema.parse(normalized)).toThrow();
    });

    it(`${field} 빈 문자열 → ZodError 발생`, () => {
      const normalized = normalizeRawRecommendation({ ...validRec, [field]: "" });
      expect(() => TopicRecommendationSchema.parse(normalized)).toThrow();
    });
  }

  it("보조 필드(difficulty) 누락은 normal로 폴백하여 통과", () => {
    const raw = { ...validRec } as Record<string, unknown>;
    delete raw.difficulty;
    const normalized = normalizeRawRecommendation(raw);
    expect(() => TopicRecommendationSchema.parse(normalized)).not.toThrow();
    const parsed = TopicRecommendationSchema.parse(normalized);
    expect(parsed.difficulty).toBe("normal");
  });
});

// ────────────────────────────────────────────────────────────
// 5. Zod 스키마가 verified_trend·uploaded_assets를 직접 거부하는지 확인
// ────────────────────────────────────────────────────────────
describe("Zod 스키마 직접 경계 검사 (정규화 우회 시나리오)", () => {
  it("source='verified_trend'을 정규화 없이 직접 parse하면 ZodError", () => {
    expect(() =>
      TopicRecommendationSchema.parse({ ...validRec, source: "verified_trend" })
    ).toThrow();
  });

  it("source='uploaded_assets'을 정규화 없이 직접 parse하면 ZodError", () => {
    expect(() =>
      TopicRecommendationSchema.parse({ ...validRec, source: "uploaded_assets" })
    ).toThrow();
  });
});
