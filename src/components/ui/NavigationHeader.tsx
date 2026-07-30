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

        <div className="flex items-center gap-4 text-xs font-semibold">
          {user ? (
            <div className="flex items-center gap-3">
              <span className="text-slate-700 font-bold bg-slate-100 px-2.5 py-1 rounded-lg flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5 text-slate-500" />
                {user.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-red-600 flex items-center gap-1 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> 로그아웃
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="text-slate-700 hover:text-blue-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-500 transition-all"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3 py-1.5 rounded-lg shadow-sm transition-all"
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
