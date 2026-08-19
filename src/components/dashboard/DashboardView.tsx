"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, PlusCircle, FolderOpen, Video, FileText, ShoppingBag, AppWindow, Store, Award } from "lucide-react";

export interface UsageData {
  planName?: string;
  scriptRemaining?: number;
  scriptLimit?: number;
}

export interface ProjectHeader {
  id: string;
  title: string;
  duration: number;
  created_at: string;
}

export function DashboardView({
  usage,
  recentProjects = [],
}: {
  usage?: UsageData;
  recentProjects?: ProjectHeader[];
}) {
  const scriptRemaining = usage?.scriptRemaining ?? 5;
  const scriptLimit = usage?.scriptLimit ?? 5;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-6 md:p-8 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="bg-blue-500/30 text-blue-100 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
              {usage?.planName || "Free Standard"} 요금제
            </span>
            <h1 className="text-2xl md:text-3xl font-extrabold mt-2">오늘 어떤 쇼츠를 만들어볼까요?</h1>
            <p className="text-blue-100 text-sm mt-1">
              AI가 장면 기획부터 대본 작성까지 몇 초 만에 완료해드립니다.
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-md rounded-xl p-4 border border-white/20 text-center min-w-[160px]">
            <span className="text-xs text-blue-200 block">이번 달 남은 대본 생성</span>
            <span className="text-2xl font-black text-white">{scriptRemaining} / {scriptLimit} 회</span>
          </div>
        </div>
      </div>

      {/* Main Action Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link href="/create" className="group">
          <div className="h-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-500 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                <PlusCircle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                직접 만들기
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                만들고 싶은 내용, 점포/앱/상품 정보를 자유롭게 입력하여 맞춤형 대본을 생성합니다.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-blue-600">
              만들러 가기 &rarr;
            </div>
          </div>
        </Link>

        <Link href="/recommendations" className="group">
          <div className="h-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-500 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 group-hover:scale-110 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                AI 추천받기
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                내 업종과 관심 분야, 타겟 시청자에 맞는 흥미로운 콘텐츠 아이디어 10개를 추천받습니다.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-indigo-600">
              주제 추천받기 &rarr;
            </div>
          </div>
        </Link>

        <Link href="/my-assets" className="group">
          <div className="h-full bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-500 transition-all flex flex-col justify-between">
            <div className="space-y-3">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 group-hover:scale-110 transition-transform">
                <FolderOpen className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                내 자료로 만들기
              </h2>
              <p className="text-slate-600 text-sm leading-relaxed">
                보유한 매장/제품 사진 3~10장을 올리면 AI가 사진을 분석해 순서와 대본, 콘티를 자동으로 구성합니다.
              </p>
            </div>
            <div className="mt-6 flex items-center text-sm font-semibold text-emerald-600">
              사진으로 만들러 가기 &rarr;
            </div>
          </div>
        </Link>
      </div>

      {/* Preset Categories */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-900">인기 템플릿 카테고리</h3>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: "점포 홍보", icon: Store, purpose: "business_promotion" },
            { label: "앱 소개", icon: AppWindow, purpose: "app_service" },
            { label: "상품 소개", icon: ShoppingBag, purpose: "product_menu" },
            { label: "행사·이벤트", icon: Award, purpose: "sale_event" },
            { label: "정보·지식", icon: FileText, purpose: "information" },
            { label: "감성 스토리", icon: Video, purpose: "story" },
          ].map((cat, idx) => {
            const Icon = cat.icon;
            return (
              <Link
                key={idx}
                href={`/create?purpose=${cat.purpose}`}
                className="bg-white border border-slate-200 rounded-xl p-3 text-center hover:border-blue-500 hover:shadow-sm transition-all flex flex-col items-center gap-2 group"
              >
                <Icon className="w-5 h-5 text-slate-600 group-hover:text-blue-600 transition-colors" />
                <span className="text-xs font-semibold text-slate-700 group-hover:text-blue-600">{cat.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent Projects */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900">최근 프로젝트</h3>
          <Link href="/projects" className="text-xs text-blue-600 font-semibold hover:underline">
            전체 보기
          </Link>
        </div>

        {recentProjects.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl">
            <Video className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-500 text-sm font-medium">아직 생성된 프로젝트가 없습니다.</p>
            <p className="text-slate-400 text-xs mt-1">상단의 버튼을 눌러 첫 쇼츠 대본을 만들어보세요!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentProjects.map((p) => (
              <div key={p.id} className="py-3 flex justify-between items-center hover:bg-slate-50 px-2 rounded-lg transition-colors">
                <div>
                  <h4 className="font-bold text-slate-800 text-sm">{p.title}</h4>
                  <span className="text-xs text-slate-400">{p.duration}초 · {new Date(p.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
                <Link
                  href={`/projects/${p.id}`}
                  className="bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                >
                  편집기 열기
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
