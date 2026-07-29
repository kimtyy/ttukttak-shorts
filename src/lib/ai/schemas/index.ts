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
  visual_description: z.string(),
  image_prompt: z.string(),
  required_asset: z.string().default(""),
  asset_source: AssetSourceSchema,
  motion: SceneMotionSchema,
  transition: SceneTransitionSchema,
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

export const TopicRecommendationSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  summary: z.string(),
  reason: z.string(),
  audience: z.string(),
  hook: z.string(),
  suggested_duration: z.union([z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
  difficulty: z.enum(["easy", "normal", "advanced"]),
  required_assets: z.array(z.string()),
  purpose: VideoPurposeSchema,
  source: z.enum(["ai_general", "user_profile", "seasonal", "evergreen"]),
  confidence: z.number().min(0).max(1),
  trend_verified: z.boolean().transform(() => false), // STRICT FORCED FALSE
});
