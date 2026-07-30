import { Suspense } from "react";
import { SignupForm } from "@/components/auth/SignupForm";

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">로딩 중...</div>}>
      <SignupForm />
    </Suspense>
  );
}
