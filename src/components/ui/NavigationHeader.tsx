"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, Video, LayoutDashboard, LogOut, User as UserIcon, Menu, X } from "lucide-react";
import { createClientForBrowser } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  { href: "/dashboard", label: "대시보드", icon: LayoutDashboard, hoverColor: "hover:text-blue-600", iconColor: "text-slate-500" },
  { href: "/create", label: "직접 만들기", icon: Video, hoverColor: "hover:text-blue-600", iconColor: "text-slate-500" },
  { href: "/recommendations", label: "AI 추천", icon: Sparkles, hoverColor: "hover:text-indigo-600", iconColor: "text-indigo-500" },
];

export function NavigationHeader() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
    setIsMobileMenuOpen(false);
    router.push("/login");
    router.refresh();
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Brand Logo */}
        <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0 min-w-0">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-sm flex-shrink-0">
            뚝
          </div>
          <span className="font-extrabold text-lg text-slate-900 tracking-tight truncate">뚝딱쇼츠</span>
          <span className="hidden md:inline-block bg-blue-100 text-blue-700 text-[10px] font-extrabold px-2 py-0.5 rounded-full flex-shrink-0">
            MVP 1단계
          </span>
        </Link>

        {/* Center Nav Links - hidden on mobile, shown from sm breakpoint up */}
        <nav className="hidden sm:flex items-center gap-3 md:gap-6 text-xs sm:text-sm font-bold text-slate-600 whitespace-nowrap">
          {NAV_LINKS.map(({ href, label, icon: Icon, hoverColor, iconColor }) => (
            <Link key={href} href={href} className={`${hoverColor} flex items-center gap-1 md:gap-1.5 transition-colors p-1`}>
              <Icon className={`w-4 h-4 ${iconColor}`} />
              <span className="hidden md:inline">{label}</span>
            </Link>
          ))}
        </nav>

        {/* Right User Auth Controls - hidden on mobile, shown from sm breakpoint up */}
        <div className="hidden sm:flex items-center gap-2 sm:gap-4 text-xs font-semibold flex-shrink-0">
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

        {/* Hamburger Toggle - mobile only */}
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((prev) => !prev)}
          className="sm:hidden text-slate-600 p-1.5 -mr-1.5 flex-shrink-0"
          aria-label={isMobileMenuOpen ? "메뉴 닫기" : "메뉴 열기"}
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile Dropdown Menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden border-t border-slate-200 bg-white px-4 py-3 space-y-1">
          {NAV_LINKS.map(({ href, label, icon: Icon, iconColor }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center gap-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-lg px-3 py-2.5 transition-colors"
            >
              <Icon className={`w-4 h-4 ${iconColor}`} />
              {label}
            </Link>
          ))}

          <div className="border-t border-slate-100 my-2" />

          {user ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 text-sm font-bold text-slate-700">
                <UserIcon className="w-4 h-4 text-slate-500 flex-shrink-0" />
                <span className="truncate">{user.email}</span>
              </div>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg px-3 py-2.5 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                로그아웃
              </button>
            </>
          ) : (
            <div className="flex flex-col gap-2 px-3 pt-1">
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-center text-slate-700 font-bold px-3 py-2.5 rounded-lg border border-slate-200"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-center bg-blue-600 text-white font-bold px-3 py-2.5 rounded-lg"
              >
                회원가입
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
