"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Video, LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import { createClientForBrowser } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export function NavigationHeader() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClientForBrowser();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    const supabase = createClientForBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm">
            뚝
          </div>
          <span className="font-extrabold text-lg text-slate-900 tracking-tight">뚝딱쇼츠</span>
          <span className="hidden sm:inline-block bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full">
            MVP 1단계
          </span>
        </Link>

        {/* Center Nav Links - Responsive (Icon + Text on md+, Icon only on small screens) */}
        <nav className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-bold text-slate-600 whitespace-nowrap">
          <Link href="/dashboard" className="hover:text-blue-600 flex items-center gap-1 sm:gap-1.5 transition-colors p-1">
            <LayoutDashboard className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">대시보드</span>
          </Link>
          <Link href="/create" className="hover:text-blue-600 flex items-center gap-1 sm:gap-1.5 transition-colors p-1">
            <Video className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">직접 만들기</span>
          </Link>
          <Link href="/recommendations" className="hover:text-indigo-600 flex items-center gap-1 sm:gap-1.5 transition-colors p-1">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <span className="hidden sm:inline">AI 추천</span>
          </Link>
        </nav>

        {/* Right User Auth Controls */}
        <div className="flex items-center gap-2 sm:gap-4 text-xs font-semibold flex-shrink-0">
          {user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-slate-700 font-bold bg-slate-100 px-2 sm:px-2.5 py-1 rounded-lg flex items-center gap-1 truncate max-w-[100px] sm:max-w-[180px]">
                <UserIcon className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="truncate">{user.email?.split("@")[0]}</span>
              </span>
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-600 p-1 flex items-center gap-1 transition-colors"
                title="로그아웃"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-slate-700 hover:text-blue-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-blue-500 transition-all whitespace-nowrap"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2.5 py-1.5 rounded-lg shadow-sm transition-all whitespace-nowrap"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
