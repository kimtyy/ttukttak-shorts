"use client";

import React, { useState } from "react";
import { TopicRecommendation } from "@/types";
import { Sparkles, ArrowRight, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";

export function RecommendationsView({
  recommendations: initialRecs = [],
  recommendationRemaining = 10,
}: {
  recommendations?: TopicRecommendation[];
  recommendationRemaining?: number;
}) {
  const router = useRouter();
  const [recs, setRecs] = useState<TopicRecommendation[]>(initialRecs);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGenerateRecommendations = async () => {
    setIsGenerating(true);
    setErrorMsg("");
    const idempotencyKey = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error);
      }

      setRecs(data.recommendations || []);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "추천 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSelectTopic = (rec: TopicRecommendation) => {
    const query = new URLSearchParams({
      topic: rec.title,
      purpose: rec.purpose,
      duration: rec.suggested_duration.toString(),
      hook: rec.hook,
    });
    router.push(`/create?${query.toString()}`);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-600" />
              AI 주제 추천
            </h1>
            <p className="text-slate-500 text-sm mt-1">
              내 업종, 관심 분야 및 시청자 특성을 반영하여 가장 성과가 좋을 아이디어 10개를 추천해 드립니다.
            </p>
          </div>

          <button
            type="button"
            onClick={handleGenerateRecommendations}
            disabled={isGenerating || recommendationRemaining <= 0}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold px-5 py-3 rounded-xl shadow-md transition-all flex items-center gap-2 text-sm"
          >
            {isGenerating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>추천 분석 중...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>새로운 주제 10개 추천받기 ({recommendationRemaining}회 남음)</span>
              </>
            )}
          </button>
        </div>

        {/* Notice Disclaimer */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-2 text-slate-600 text-xs">
          <ShieldCheck className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <span>사용자 정보와 일반적인 콘텐츠 패턴을 바탕으로 추천한 아이디어입니다.</span>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-red-50 text-red-700 p-4 rounded-xl text-sm border border-red-200 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Recommendations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {recs.map((rec, idx) => (
          <div
            key={rec.id || idx}
            className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <span className="bg-indigo-50 text-indigo-700 font-extrabold text-xs px-2.5 py-1 rounded-md">
                  추천 #{idx + 1}
                </span>
                <span className="text-xs font-semibold text-slate-500">{rec.suggested_duration}초 권장</span>
              </div>

              <h2 className="text-lg font-bold text-slate-900">{rec.title}</h2>
              <p className="text-slate-600 text-xs leading-relaxed">{rec.summary}</p>

              <div className="bg-slate-50 rounded-lg p-3 space-y-1 text-xs border border-slate-100">
                <p className="text-slate-700 font-semibold">
                  💡 추천 이유: <span className="font-normal text-slate-600">{rec.reason}</span>
                </p>
                <p className="text-slate-700 font-semibold">
                  🎯 후킹 문장: <span className="font-normal text-indigo-600">&quot;{rec.hook}&quot;</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleSelectTopic(rec)}
              className="w-full bg-slate-900 hover:bg-indigo-600 text-white font-bold py-2.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <span>이 주제로 만들기</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
