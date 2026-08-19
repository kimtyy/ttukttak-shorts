import { z } from "zod";

export const SceneRoleSchema = z.enum([
  "hook",
  "problem",
  "desire",
  "introduction",
  "feature",
  "proof",
  "development",
  "key_point",
  "turning_point",
  "offer",
  "conclusion",
  "cta",
]);

export const AssetSourceSchema = z.enum([
  "user_upload",
  "ai_image",
  "ai_video",
  "screen_recording",
  "stock",
  "text_motion",
]);

export const SceneMotionSchema = z.enum([
  "slow_zoom_in",
  "slow_zoom_out",
  "pan_left",
  "pan_right",
  "pan_up",
  "pan_down",
  "static",
  "screen_scroll",
  "text_pop",
]);

export const SceneTransitionSchema = z.enum([
  "fade",
  "cross_dissolve",
  "slide_left",
  "slide_right",
  "cut",
]);

export const VideoPurposeSchema = z.enum([
  "free",
  "business_promotion",
  "product_menu",
  "sale_event",
  "app_service",
  "information",
  "story",
  "review",
  "education",
  "local_travel",
  "notice",
  "recruitment",
  "custom",
]);

export const ShortsSceneSchema = z.object({
  id: z.string().optional(),
  scene_number: z.number().int().min(1),
  role: SceneRoleSchema,
  duration: z.number().int().min(1),
  narration: z.string(),
  caption: z.string(),
  // "내 자료로 만들기"(user_upload) 씬은 실제 사진이 이미 배정되어 있어 이미지
  // 생성용 필드가 무의미하므로, 모델이 null/누락으로 응답하는 경우가 있다.
  // 방어적으로 null을 허용하고 빈 문자열로 정규화한다.
  visual_description: z.string().nullable().optional().transform((v) => v ?? ""),
  image_prompt: z.string().nullable().optional().transform((v) => v ?? ""),
  required_asset: z.string().nullable().optional().transform((v) => v ?? ""),
  asset_source: AssetSourceSchema,
  motion: SceneMotionSchema,
  transition: SceneTransitionSchema,
  // "내 자료로 만들기": 이미지 기반 생성일 때만 채워짐 (0부터 시작하는 업로드 이미지 인덱스)
  source_image_index: z.number().int().min(0).nullable().optional(),
});

export const GeneratedShortsProjectSchema = z.object({
  title: z.string(),
  hook: z.string(),
  thumbnail_text: z.string(),
  description: z.string(),
  hashtags: z.array(z.string()),
  duration: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  purpose: VideoPurposeSchema,
  total_narration: z.string(),
  content_strategy: z.string(),
  target_audience: z.string(),
  call_to_action: z.string(),
  scenes: z.array(ShortsSceneSchema),
});

/**
 * MVP 1단계 허용 recommendation source (4개)
 *
 * DB enum(public.recommendation_source)에는 uploaded_assets, verified_trend도 존재하지만
 * 앱 레이어에서 저장을 차단한다.
 *   - uploaded_assets : 에셋 기반 추천 파이프라인 도입 이후 허용
 *   - verified_trend  : 실제 외부 트렌드 검증 API 도입 이후 허용
 *
 * AI가 위 두 값 또는 알 수 없는 값을 반환하면
 * OpenAIRecommendationProvider의 정규화(normalizeRawRecommendation) 단계에서
 * ai_general로 변환한 뒤 이 스키마에 전달된다.
 */
export const ALLOWED_RECOMMENDATION_SOURCES = [
  "ai_general",
  "user_profile",
  "seasonal",
  "evergreen",
] as const;

export type AllowedRecommendationSource = (typeof ALLOWED_RECOMMENDATION_SOURCES)[number];

export const TopicRecommendationSchema = z.object({
  id: z.string().optional(),

  // ── 핵심 필드: 누락·빈 문자열 시 검증 실패 (조용히 통과 금지) ──────────────
  title: z.string().min(1),
  summary: z.string().min(1),
  reason: z.string().min(1),
  audience: z.string().min(1),
  hook: z.string().min(1),

  // ── 보조 필드: 안전한 폴백 허용 ────────────────────────────────────────────
  // 15·30·45·60 외의 값(예: 27, "30" 등)은 30으로 보정
  suggested_duration: z.coerce.number().transform((v) => {
    const valid = [15, 30, 45, 60] as const;
    return (valid as readonly number[]).includes(v) ? (v as 15 | 30 | 45 | 60) : 30;
  }),
  difficulty: z.enum(["easy", "normal", "advanced"]).catch("normal"),
  required_assets: z.array(z.string()),
  purpose: VideoPurposeSchema,

  // provider 정규화 후 반드시 4개 중 하나여야 한다 (.catch 없음 — 정규화 미이행 시 명시적 오류)
  source: z.enum(["ai_general", "user_profile", "seasonal", "evergreen"]),

  confidence: z.number().min(0).max(1),

  // AI 응답 무관, 서버에서 항상 false 강제
  trend_verified: z.boolean().optional().transform(() => false),
});
