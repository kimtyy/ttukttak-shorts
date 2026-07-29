import React from "react";
import Link from "next/link";
import { Sparkles, Video, LayoutDashboard } from "lucide-react";

export function NavigationHeader() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm">
            뚝
          </div>
          <span className="font-extrabold text-lg text-slate-900 tracking-tight">뚝딱쇼츠</span>
          <span className="bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
            MVP 1단계
          </span>
        </Link>

        <nav className="flex items-center gap-6 text-sm font-bold text-slate-600">
          <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1.5 transition-colors">
            <LayoutDashboard className="w-4 h-4" /> 대시보드
          </Link>
          <Link href="/create" className="hover:text-blue-600 flex items-center gap-1.5 transition-colors">
            <Video className="w-4 h-4" /> 직접 만들기
          </Link>
          <Link href="/recommendations" className="hover:text-indigo-600 flex items-center gap-1.5 transition-colors">
            <Sparkles className="w-4 h-4 text-indigo-500" /> AI 추천
          </Link>
        </nav>
      </div>
    </header>
  );
}
