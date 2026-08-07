"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { VideoPurpose, LaunchStatus, VisualStyle, VoiceStyle, Mood } from "@/types";

const VISUAL_STYLE_OPTIONS: { value: VisualStyle; label: string }[] = [
  { value: "cinematic", label: "영화적 실사 (기본값)" },
  { value: "documentary", label: "다큐멘터리" },
  { value: "animation_3d", label: "3D 애니메이션" },
  { value: "webtoon", label: "웹툰" },
  { value: "watercolor", label: "수채화" },
  { value: "warm_photo", label: "따뜻한 감성 사진" },
];

const VOICE_STYLE_OPTIONS: { value: VoiceStyle; label: string }[] = [
  { value: "calm_middle_aged_male", label: "차분한 중년 남성 (기본값)" },
  { value: "warm_middle_aged_female", label: "따뜻한 중년 여성" },
  { value: "bright_female", label: "밝은 여성" },
  { value: "trustworthy_male", label: "신뢰감 있는 남성" },
  { value: "documentary_narrator", label: "다큐멘터리 내레이터" },
];

const MOOD_OPTIONS: { value: Mood; label: string }[] = [
  { value: "emotional", label: "감동적 (기본값)" },
  { value: "calm", label: "차분함" },
  { value: "cheerful", label: "유쾌함" },
  { value: "tense", label: "긴장감" },
  { value: "hopeful", label: "희망적" },
  { value: "serious", label: "진지함" },
];
import { Sparkles, Store, AppWindow } from "lucide-react";

export function CreateScriptForm({ scriptRemaining }: { scriptRemaining: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPurpose = (searchParams.get("purpose") as VideoPurpose) || "free";
  const initialTopic = searchParams.get("topic") || "";
  const allowedDurations = [15, 30, 45, 60] as const;
  const parsedDuration = Number(searchParams.get("duration"));
  const initialDuration = (allowedDurations as readonly number[]).includes(parsedDuration)
    ? (parsedDuration as 15 | 30 | 45 | 60)
    : 30;

  const [topic, setTopic] = useState(initialTopic);
  const [purpose, setPurpose] = useState<VideoPurpose>(initialPurpose);
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(initialDuration);
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("cinematic");
  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>("calm_middle_aged_male");
  const [mood, setMood] = useState<Mood>("emotional");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // App Dedicated Fields
  const [appName, setAppName] = useState("");
  const [solvingProblem, setSolvingProblem] = useState("");
  const [launchStatus, setLaunchStatus] = useState<LaunchStatus>("released");

  // Store Dedicated Fields
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [location, setLocation] = useState("");

  // Common Advanced Inputs
  const [callToAction, setCallToAction] = useState("");
  const [prohibitedExpressions, setProhibitedExpressions] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (topic.trim().length < 5) {
      setErrorMsg("만들고자 하는 내용을 최소 5자 이상 입력해 주세요.");
      return;
    }
    if (scriptRemaining <= 0) {
      setErrorMsg("이번 달 남은 대본 생성 횟수를 모두 사용하셨습니다.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg("");

    const idempotencyKey = `gen_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          topic,
          purpose,
          duration,
          visual_style: visualStyle,
          voice_style: voiceStyle,
          mood,
          launch_status: purpose === "app_service" ? launchStatus : undefined,
          app_name: appName,
          solving_problem: solvingProblem,
          business_name: businessName,
          business_type: businessType,
          location,
          call_to_action: callToAction,
          prohibited_expressions: prohibitedExpressions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "대본 생성에 실패했습니다.");
      }

      router.push(`/projects/${data.project.id}`);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-black text-slate-900">새 쇼츠/릴스 대본 만들기</h1>
          <p className="text-slate-500 text-sm mt-1">
            원하는 콘텐츠 아이디어나 홍보 내용을 적어주시면 AI가 세로형 가이드 대본을 완성합니다.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200 font-medium">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main Topic Input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-slate-800">
              무엇을 만들까요? <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              minLength={5}
              maxLength={1000}
              placeholder="예: 설맥 현리점 눈꽃맥주와 먹태를 홍보하는 30초 릴스 / 카드 문자와 계좌 지출을 정리하는 Money Flow 앱 소개"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <span className="text-xs text-slate-400 block text-right">
              {topic.length} / 1,000자 (최소 5자)
            </span>
          </div>

          {/* Purpose & Duration Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">영상 목적</label>
              <select
                value={purpose}
                onChange={(e) => setPurpose(e.target.value as VideoPurpose)}
                className="w-full rounded-xl border border-slate-300 p-3 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500"
              >
                <option value="free">자유 제작</option>
                <option value="business_promotion">점포·업체 홍보</option>
                <option value="product_menu">상품·메뉴 소개</option>
                <option value="sale_event">할인·이벤트</option>
                <option value="app_service">앱·웹서비스 소개</option>
                <option value="information">정보·지식</option>
                <option value="story">이야기·스토리</option>
                <option value="review">후기·리뷰</option>
                <option value="education">교육·강의</option>
                <option value="local_travel">지역·여행</option>
                <option value="notice">공지·안내</option>
                <option value="recruitment">모집·사전예약</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">영상 길이</label>
              <div className="grid grid-cols-4 gap-2">
                {[15, 30, 45, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDuration(d as 15 | 30 | 45 | 60)}
                    className={`py-3 rounded-xl text-sm font-bold border transition-all ${
                      duration === d
                        ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {d}초
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Visual Style, Voice Style, Mood Selection */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">화면 스타일</label>
              <select
                value={visualStyle}
                onChange={(e) => setVisualStyle(e.target.value as VisualStyle)}
                className="w-full rounded-xl border border-slate-300 p-3 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500"
              >
                {VISUAL_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">목소리 스타일</label>
              <select
                value={voiceStyle}
                onChange={(e) => setVoiceStyle(e.target.value as VoiceStyle)}
                className="w-full rounded-xl border border-slate-300 p-3 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500"
              >
                {VOICE_STYLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-800 mb-2">영상 분위기</label>
              <select
                value={mood}
                onChange={(e) => setMood(e.target.value as Mood)}
                className="w-full rounded-xl border border-slate-300 p-3 text-slate-800 text-sm font-medium focus:ring-2 focus:ring-blue-500"
              >
                {MOOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Conditional Input: App Service Dedicated */}
          {purpose === "app_service" && (
            <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                <AppWindow className="w-4 h-4 text-indigo-600" />
                <span>앱·웹서비스 전용 추가 정보</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="앱/서비스명 (예: Money Flow)"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="rounded-lg border border-slate-300 p-2.5 text-xs"
                />
                <select
                  value={launchStatus}
                  onChange={(e) => setLaunchStatus(e.target.value as LaunchStatus)}
                  className="rounded-lg border border-slate-300 p-2.5 text-xs font-semibold"
                >
                  <option value="released">정식 출시 완료</option>
                  <option value="beta">베타 테스트 진행 중</option>
                  <option value="pre_registration">사전 예약 모집 중</option>
                  <option value="in_development">개발 진행 중</option>
                  <option value="partner_recruitment">파트너 모집 중</option>
                </select>
              </div>
              <textarea
                rows={2}
                placeholder="해결하는 불편함 또는 핵심 차별점"
                value={solvingProblem}
                onChange={(e) => setSolvingProblem(e.target.value)}
                className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
              />
            </div>
          )}

          {/* Conditional Input: Store Business Dedicated */}
          {purpose === "business_promotion" && (
            <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                <Store className="w-4 h-4 text-blue-600" />
                <span>점포·매장 전용 추가 정보</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="점포명 (예: 설맥 현리점)"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="rounded-lg border border-slate-300 p-2.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="업종 (예: 눈꽃맥주 전문점)"
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="rounded-lg border border-slate-300 p-2.5 text-xs"
                />
                <input
                  type="text"
                  placeholder="위치/지역 (예: 가평 조종면)"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="rounded-lg border border-slate-300 p-2.5 text-xs"
                />
              </div>
            </div>
          )}

          {/* Advanced Collapsible Options */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
            >
              <span>{showAdvanced ? "▲ 고급 설정 접기" : "▼ 고급 설정 (행동 유도, 타겟 시청자 등)"}</span>
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">행동 유도 (CTA)</label>
                  <input
                    type="text"
                    placeholder="예: 지금 댓글로 신청하세요 / 프로필 링크 클릭"
                    value={callToAction}
                    onChange={(e) => setCallToAction(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">제외할 표현</label>
                  <input
                    type="text"
                    placeholder="예: 최저가 단정 표현 금지, 과장 광고 문구 제외"
                    value={prohibitedExpressions}
                    onChange={(e) => setProhibitedExpressions(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2.5 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || scriptRemaining <= 0}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 text-base"
          >
            {isSubmitting ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>AI가 기획안과 대본을 작성 중입니다...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>AI 대본 무료 생성하기 ({scriptRemaining}회 남음)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
