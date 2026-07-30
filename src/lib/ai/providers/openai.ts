import {
  GeneratedShortsProject,
  GenerateScriptInput,
  RecommendationInput,
  TopicRecommendation,
} from "@/types";
import { ScriptProvider, RecommendationProvider } from "./provider";
import {
  GeneratedShortsProjectSchema,
  TopicRecommendationSchema,
  ALLOWED_RECOMMENDATION_SOURCES,
} from "../schemas";
import OpenAI from "openai";
import { ZodError } from "zod";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

const SYSTEM_PROMPT_SCRIPT = `
당신은 유튜브 쇼츠, 인스타그램 릴스, 틱톡용 세로형 콘텐츠를 설계하는 범용 AI 콘텐츠 기획자다.
특정 분야에 한정되지 않는다.
점포 홍보, 상품 소개, 앱 소개, 이벤트, 정보, 이야기, 교육, 후기, 여행, 공지, 모집 등 사용자의 목적을 분석해 가장 적절한 영상 구조를 선택한다.
사용자가 입력한 내용을 우선한다.
사용자가 제공하지 않은 가격, 주소, 전화번호, 영업시간, 할인율, 효능, 수치, 통계, 출시일을 임의로 만들지 않는다.
첫 3초 안에 관심을 끄는 장면이나 문장을 만든다.
"안녕하세요", "오늘은", "이번 영상에서는"으로 시작하지 않는다.
자막은 내레이션 전체를 복사하지 않고 핵심만 압축한다.
이미지 프롬프트는 영어로 작성한다.
이미지 프롬프트에는 vertical 9:16 composition과 no text를 포함한다.
모든 장면 duration의 합은 선택한 전체 영상 길이와 일치해야 한다.
결과는 지정된 JSON Schema에 맞는 JSON으로만 출력한다.
`;

const SYSTEM_PROMPT_RECOMMENDATION = `
당신은 다양한 일반 사용자, 크리에이터, 소상공인, 앱 개발자를 위한 쇼츠·릴스 콘텐츠 전략가다.
사용자 프로필과 요청 내용을 바탕으로 실제로 제작할 수 있는 주제 10개를 추천한다.
추천은 다음 범주를 고르게 포함할 수 있다: 업종 맞춤, 상품홍보, 정보형, 이야기형, 계절형, 에버그린, 앱소개 등.
실시간 데이터가 제공되지 않은 경우 현재 유행 중이거나 급상승 중이라고 단정하지 않는다.
JSON Schema 이외의 문장을 출력하지 않는다.
`;

/**
 * AI 원시 응답을 Zod 검증 전에 정규화한다.
 *
 * 정책:
 * - source: ALLOWED_RECOMMENDATION_SOURCES(4개)에 포함되지 않으면 ai_general 로 대체
 *   (uploaded_assets, verified_trend, 알 수 없는 값 모두 포함)
 * - trend_verified: AI 응답과 무관하게 항상 false 로 강제
 * - suggested_duration: 그대로 전달 (Zod coerce가 처리)
 *
 * 이 함수는 원본 객체를 변경하지 않고 새 객체를 반환한다.
 */
function normalizeRawRecommendation(raw: Record<string, unknown>): Record<string, unknown> {
  const rawSource = raw.source as string | undefined;
  const normalizedSource =
    rawSource && (ALLOWED_RECOMMENDATION_SOURCES as readonly string[]).includes(rawSource)
      ? rawSource
      : "ai_general";

  return {
    ...raw,
    source: normalizedSource,
    trend_verified: false, // 서버 강제, AI 응답 무시
  };
}

export class OpenAIScriptProvider implements ScriptProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "mock-key",
    });
  }

  async generateScript(input: GenerateScriptInput, requestId?: string): Promise<GeneratedShortsProject> {
    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === "production") {
        console.error(`[${requestId || "REQ"}] [OPENAI_REQUEST] Missing OPENAI_API_KEY in production`);
        throw { stage: "OPENAI_REQUEST", errorCode: "OPENAI_KEY_MISSING", message: "OPENAI_API_KEY가 설정되지 않았습니다." };
      }
      return this.getMockScript(input);
    }

    let response;
    try {
      response = await this.client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_SCRIPT },
          { role: "user", content: JSON.stringify(input) },
        ],
        response_format: { type: "json_object" },
      });
    } catch (apiErr: unknown) {
      const error = apiErr as { status?: number; type?: string; code?: string; message?: string };
      console.error(`[${requestId || "REQ"}] [OPENAI_REQUEST] HTTP ${error.status || 500} - Type: ${error.type || "unknown"}, Code: ${error.code || "none"}, Message: ${error.message}`);
      throw {
        stage: "OPENAI_REQUEST",
        errorCode: "OPENAI_REQUEST_FAILED",
        openAiStatus: error.status,
        openAiErrorType: error.type,
        message: error.message || "OpenAI API 호출 실패",
      };
    }

    let parsed;
    const content = response.choices[0]?.message?.content || "{}";
    try {
      parsed = JSON.parse(content);
    } catch (parseErr: unknown) {
      console.error(`[${requestId || "REQ"}] [OPENAI_RESPONSE_PARSE] Invalid JSON from OpenAI: ${(parseErr as Error).message}`);
      throw {
        stage: "OPENAI_RESPONSE_PARSE",
        errorCode: "OPENAI_INVALID_JSON",
        message: "AI 응답 JSON 파싱 실패",
      };
    }

    let validated;
    try {
      validated = GeneratedShortsProjectSchema.parse(parsed);
    } catch (zodErr: unknown) {
      if (zodErr instanceof ZodError) {
        const fieldPaths = zodErr.issues.map((i) => i.path.join(".")).join(", ");
        console.error(`[${requestId || "REQ"}] [AI_RESPONSE_VALIDATION] Zod validation error on fields: [${fieldPaths}]`);
        throw {
          stage: "AI_RESPONSE_VALIDATION",
          errorCode: "ZOD_VALIDATION_FAILED",
          zodErrorFields: fieldPaths,
          message: `AI 응답 검증 실패 (필드: ${fieldPaths})`,
        };
      }
      throw zodErr;
    }

    const totalDuration = validated.scenes.reduce((acc, s) => acc + s.duration, 0);
    if (totalDuration !== input.duration) {
      const diff = input.duration - totalDuration;
      validated.scenes[validated.scenes.length - 1].duration += diff;
    }

    return validated as GeneratedShortsProject;
  }

  private getMockScript(input: GenerateScriptInput): GeneratedShortsProject {
    const isApp = input.purpose === "app_service";
    const duration = input.duration || 30;

    return {
      title: isApp ? `${input.app_name || "Money Flow"} 앱 소개 쇼츠` : `${input.topic} 쇼츠`,
      hook: isApp ? "아직도 수기 가계부로 지출 관리하세요?" : "3초 만에 시선을 사로잡는 핵심!",
      thumbnail_text: isApp ? "가계부 끝판왕" : "인기 폭발 비결",
      description: `${input.topic}에 대한 쇼츠/릴스 가이드입니다. #쇼츠 #릴스`,
      hashtags: ["쇼츠", "릴스", "뚝딱쇼츠"],
      duration: duration as 15 | 30 | 45 | 60,
      purpose: input.purpose,
      total_narration: "전체 내레이션 예시 내용입니다.",
      content_strategy: "후킹 -> 문제제기 -> 해결책 -> CTA",
      target_audience: input.target_audience || "일반 시청자",
      call_to_action: input.call_to_action || (input.launch_status === "beta" ? "지금 베타테스터 신청하세요!" : "지금 확인해보세요!"),
      scenes: [
        {
          id: "sc_1",
          scene_number: 1,
          role: "hook",
          duration: 5,
          narration: "첫 3초 후킹 내레이션",
          caption: "핵심 질문 자막",
          visual_description: "강렬한 첫 장면",
          image_prompt: "vertical 9:16 composition, vibrant product highlight, no text",
          required_asset: "",
          asset_source: "text_motion",
          motion: "slow_zoom_in",
          transition: "cut",
        },
        {
          id: "sc_2",
          scene_number: 2,
          role: "feature",
          duration: Math.max(1, duration - 10),
          narration: "주요 특징 설명",
          caption: "핵심 특징 자막",
          visual_description: "기능 화면 또는 매장 전경",
          image_prompt: "vertical 9:16 composition, modern bright aesthetic, no text",
          required_asset: "",
          asset_source: "screen_recording",
          motion: "static",
          transition: "fade",
        },
        {
          id: "sc_3",
          scene_number: 3,
          role: "cta",
          duration: 5,
          narration: "행동 유도 내레이션",
          caption: "행동 유도 자막",
          visual_description: "로고 및 설치/방문 안내",
          image_prompt: "vertical 9:16 composition, call to action screen, no text",
          required_asset: "",
          asset_source: "text_motion",
          motion: "text_pop",
          transition: "cut",
        },
      ],
    };
  }
}

export class OpenAIRecommendationProvider implements RecommendationProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || "mock-key",
    });
  }

  async generateRecommendations(input: RecommendationInput, requestId?: string): Promise<TopicRecommendation[]> {
    const reqId = requestId || "REQ";

    if (!process.env.OPENAI_API_KEY) {
      if (process.env.NODE_ENV === "production") {
        console.error(`[${reqId}] [OPENAI_REQUEST] Missing OPENAI_API_KEY in production`);
        throw { stage: "OPENAI_REQUEST", errorCode: "OPENAI_KEY_MISSING", message: "OPENAI_API_KEY가 설정되지 않아 주제를 추천할 수 없습니다." };
      }
      return this.getMockRecommendations();
    }

    let response;
    try {
      response = await this.client.chat.completions.create({
        model: DEFAULT_MODEL,
        messages: [
          { role: "system", content: SYSTEM_PROMPT_RECOMMENDATION },
          { role: "user", content: JSON.stringify(input.profile) },
        ],
        response_format: { type: "json_object" },
      });
    } catch (apiErr: unknown) {
      const error = apiErr as { status?: number; type?: string; code?: string; message?: string };
      const safeCode = error.code || error.type || "unknown";

      let errorCode = "OPENAI_REQUEST_FAILED";
      if (safeCode === "invalid_api_key") errorCode = "OPENAI_INVALID_API_KEY";
      else if (safeCode === "insufficient_quota") errorCode = "OPENAI_QUOTA_EXCEEDED";
      else if (safeCode === "rate_limit_exceeded") errorCode = "OPENAI_RATE_LIMIT";
      else if (safeCode === "model_not_found") errorCode = "OPENAI_MODEL_NOT_FOUND";
      else if (error.type === "invalid_request_error") errorCode = "OPENAI_INVALID_REQUEST";

      console.error(`[${reqId}] [OPENAI_REQUEST] endpoint=recommendations HTTP ${error.status || 500} type=${safeCode} errorCode=${errorCode}`);
      throw { stage: "OPENAI_REQUEST", errorCode, openAiStatus: error.status, openAiErrorType: safeCode, message: error.message || "OpenAI API 호출 실패" };
    }

    const content = response.choices[0]?.message?.content || "{}";
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr: unknown) {
      console.error(`[${reqId}] [OPENAI_RESPONSE_PARSE] recommendations: Invalid JSON from OpenAI: ${(parseErr as Error).message}`);
      throw { stage: "OPENAI_RESPONSE_PARSE", errorCode: "OPENAI_INVALID_JSON", message: "AI 응답 JSON 파싱 실패" };
    }

    const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations : [];

    if (recs.length === 0) {
      console.error(`[${reqId}] [AI_RESPONSE_VALIDATION] recommendations array is empty or missing`);
      throw { stage: "AI_RESPONSE_VALIDATION", errorCode: "EMPTY_RECOMMENDATIONS", message: "AI가 추천 목록을 반환하지 않았습니다." };
    }

    const validated: TopicRecommendation[] = [];
    for (let i = 0; i < recs.length; i++) {
      // ── 정규화: Zod parse 이전에 source·trend_verified 강제 보정 ──────────
      const normalized = normalizeRawRecommendation(recs[i] as Record<string, unknown>);
      try {
        const rec = TopicRecommendationSchema.parse(normalized);
        validated.push(rec as TopicRecommendation);
      } catch (zodErr: unknown) {
        if (zodErr instanceof ZodError) {
          const fieldPaths = zodErr.issues.map((issue) => issue.path.join(".")).join(", ");
          console.error(`[${reqId}] [AI_RESPONSE_VALIDATION] rec[${i}] Zod error on fields: [${fieldPaths}]`);
        }
        // 핵심 필드 누락 항목은 건너뜀 (전체 배치는 계속 진행)
      }
    }

    if (validated.length === 0) {
      console.error(`[${reqId}] [AI_RESPONSE_VALIDATION] All ${recs.length} recommendations failed Zod validation`);
      throw { stage: "AI_RESPONSE_VALIDATION", errorCode: "ALL_RECS_VALIDATION_FAILED", message: "AI 추천 항목 검증에 모두 실패했습니다." };
    }

    return validated;
  }

  private getMockRecommendations(): TopicRecommendation[] {
    return Array.from({ length: 10 }).map((_, i) => ({
      id: `rec_${i + 1}`,
      title: `AI 맞춤 추천 주제 ${i + 1}`,
      summary: `사용자 프로필 기반으로 추천된 쇼츠 아이디어 ${i + 1}입니다.`,
      reason: "타겟 시청자가 높은 관심을 보이는 카테고리입니다.",
      audience: "20-40대 직장인 및 자영업자",
      hook: "이 영상을 안 보면 손해입니다!",
      suggested_duration: 30,
      difficulty: "normal",
      required_assets: ["매장 전경 사진", "메뉴 사진"],
      purpose: "business_promotion",
      source: "user_profile",
      confidence: 0.92,
      trend_verified: false,
    }));
  }
}
