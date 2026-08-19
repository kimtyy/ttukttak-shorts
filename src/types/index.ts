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

export type VisualStyle =
  | "cinematic"
  | "documentary"
  | "animation_3d"
  | "webtoon"
  | "watercolor"
  | "warm_photo";

export type VoiceStyle =
  | "calm_middle_aged_male"
  | "warm_middle_aged_female"
  | "bright_female"
  | "trustworthy_male"
  | "documentary_narrator";

export type Mood =
  | "emotional"
  | "calm"
  | "cheerful"
  | "tense"
  | "hopeful"
  | "serious";

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
  | "video_render"
  | "youtube_publish"
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
  monthly_render_limit?: number;
  monthly_publish_limit?: number;
  project_limit: number;
  is_active: boolean;
  created_at: string;
}

export interface RenderJob {
  id: string;
  user_id: string;
  project_id: string;
  status: JobStatus;
  video_url?: string | null;
  progress: number;
  error_message?: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface PlatformConnection {
  id: string;
  user_id: string;
  platform: "youtube" | "tiktok" | "instagram";
  account_name: string;
  account_id?: string;
  scope?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PublishJob {
  id: string;
  user_id: string;
  project_id: string;
  platform: "youtube" | "tiktok" | "instagram";
  platform_connection_id?: string | null;
  status: JobStatus;
  title: string;
  description?: string;
  tags?: string[];
  privacy_status: "public" | "unlisted" | "private";
  platform_video_id?: string | null;
  platform_video_url?: string | null;
  error_message?: string | null;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
}

export interface CharacterProfile {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  reference_image_url?: string;
  fixed_prompt_fragment?: string;
  style_tags?: string[];
  created_at: string;
  updated_at: string;
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
  image_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  media_status?: "pending" | "generating" | "completed" | "failed";
  // AI vision 생성 시에만 채워짐: 이 씬이 사용한 업로드 이미지의 0부터 시작하는 인덱스
  source_image_index?: number | null;
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
  job_id?: string;
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
  topic?: string;
  purpose: VideoPurpose;
  duration: 15 | 30 | 45 | 60;
  visual_style?: VisualStyle;
  voice_style?: VoiceStyle;
  mood?: Mood;
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
  // "내 자료로 만들기": 업로드된 사진 공개 URL 목록. 있으면 vision 기반 생성으로 분기된다.
  images?: string[];
}

export interface RecommendationInput {
  profile: Profile;
}
