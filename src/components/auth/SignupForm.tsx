"use client";

import React, { useState } from "react";
import Link from "next/link";
import { createClientForBrowser } from "@/lib/supabase/client";
import { UserPlus, CheckCircle } from "lucide-react";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [success, setSuccess] = useState(false);

  const handleGoogleSignup = async () => {
    setGoogleLoading(true);
    setErrorMsg("");

    try {
      const supabase = createClientForBrowser();
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent("/dashboard")}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        throw new Error(error.message || "Google 회원가입 연결 중 오류가 발생했습니다.");
      }
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "Google 회원가입 실패");
      setGoogleLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setErrorMsg("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const supabase = createClientForBrowser();
      const origin = typeof window !== "undefined" ? window.location.origin : "";

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${origin}/auth/callback`,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccess(true);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "회원가입 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-md mx-auto px-4 py-12">
        <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-md text-center space-y-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-slate-900">이메일 인증 안내</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            <strong>{email}</strong> 주소로 인증 링크를 발송했습니다.<br />
            이메일의 링크를 클릭하여 회원가입을 완료해주세요.
          </p>
          <div className="pt-4">
            <Link
              href="/login"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-2.5 rounded-xl text-xs shadow-sm transition-all"
            >
              로그인 화면으로 이동
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-12">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-md space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-black text-xl mx-auto shadow-md">
            뚝
          </div>
          <h1 className="text-2xl font-black text-slate-900">뚝딱쇼츠 회원가입</h1>
          <p className="text-xs text-slate-500">계정을 생성하고 무료 5회 생성 기회를 받으세요.</p>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3.5 rounded-xl font-medium">
            {errorMsg}
          </div>
        )}

        {/* Google OAuth Button */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading}
            className="w-full bg-white hover:bg-slate-50 disabled:bg-slate-100 text-slate-700 font-bold py-3 rounded-xl border border-slate-300 shadow-sm transition-all flex items-center justify-center gap-3 text-xs"
          >
            {googleLoading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                <span>Google 로그인 연결 중...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Google로 계속하기</span>
              </>
            )}
          </button>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-3 text-[11px] text-slate-400 font-medium absolute">또는</span>
          </div>
        </div>

        {/* Email Signup Form */}
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">이메일 주소</label>
            <input
              type="email"
              required
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">비밀번호 (최소 6자)</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">비밀번호 확인</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="••••••••"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-3 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-3.5 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 text-sm mt-2"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>무료 회원가입하기</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          이미 계정이 있으신가요?{" "}
          <Link href="/login" className="text-blue-600 font-bold hover:underline">
            로그인
          </Link>
        </div>
      </div>
    </div>
  );
}
