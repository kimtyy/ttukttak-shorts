export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired";

export type PlanCode = "free" | "light" | "creator" | "business";

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

export type SceneRole =
  | "hook"
  | "problem"
  | "desire"
  | "introduction"
  | "feature"
  | "proof"
  | "development"
  | "key_point"
  | "turning_point"
  | "offer"
  | "conclusion"
  | "cta";

export type AssetSource =
  | "user_upload"
  | "ai_image"
  | "ai_video"
  | "screen_recording"
  | "stock"
  | "text_motion";

export type SceneMotion =
  | "slow_zoom_in"
  | "slow_zoom_out"
  | "pan_left"
  | "pan_right"
  | "pan_up"
  | "pan_down"
  | "static"
  | "screen_scroll"
  | "text_pop";

export type SceneTransition =
  | "fade"
  | "cross_dissolve"
  | "slide_left"
  | "slide_right"
  | "cut";

export type RecommendationSource =
  | "ai_general"
  | "user_profile"
  | "seasonal"
  | "evergreen"
  | "uploaded_assets"
  | "verified_trend";

export type ProjectStatus =
  | "draft"
  | "generating"
  | "script_completed"
  | "failed"
  | "archived";

export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "refunded";

export type UsageAction =
  | "script_generation"
  | "topic_recommendation"
  | "script_regeneration"
  | "admin_grant"
  | "monthly_reset"
  | "refund";

export interface Profile {
  id: string;
  display_name: string;
  business_type?: string;
  interests?: string[];
  target_audience?: string;
  platforms?: string[];
  preferred_mood?: string;
  experience_level?: string;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  monthly_script_limit: number;
  monthly_recommendation_limit: number;
  project_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
  plan?: Plan;
}

export interface ShortsScene {
  id: string;
  project_id?: string;
  scene_number: number;
  role: SceneRole;
  duration: number;
  narration: string;
  caption: string;
  visual_description: string;
  image_prompt: string;
  required_asset: string;
  asset_source: AssetSource;
  motion: SceneMotion;
  transition: SceneTransition;
}

export interface GeneratedShortsProject {
  title: string;
  hook: string;
  thumbnail_text: string;
  description: string;
  hashtags: string[];
  duration: 15 | 30 | 45 | 60;
  purpose: VideoPurpose;
  total_narration: string;
  content_strategy: string;
  target_audience: string;
  call_to_action: string;
  scenes: ShortsScene[];
}

export interface TopicRecommendation {
  id: string;
  user_id?: string;
  title: string;
  summary: string;
  reason: string;
  audience: string;
  hook: string;
  suggested_duration: 15 | 30 | 45 | 60;
  difficulty: "easy" | "normal" | "advanced";
  required_assets: string[];
  purpose: VideoPurpose;
  source: RecommendationSource;
  confidence: number;
  trend_verified: boolean; // Always false in Step 1
}

export interface GenerateScriptInput {
  topic: string;
  purpose: VideoPurpose;
  duration: 15 | 30 | 45 | 60;
  visual_style?: string;
  voice_style?: string;
  mood?: string;
  brand_name?: string;
  key_message?: string;
  target_audience?: string;
  selling_points?: string;
  required_facts?: string;
  prohibited_expressions?: string;
  call_to_action?: string;
  launch_status?: LaunchStatus;
  custom_purpose?: string;
  // Specific Purpose Additions
  business_name?: string;
  business_type?: string;
  location?: string;
  app_name?: string;
  app_summary?: string;
  solving_problem?: string;
  core_features?: string;
}

export interface RecommendationInput {
  profile: Profile;
}
