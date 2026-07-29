"use client";

import { Suspense } from "react";
import { CreateScriptForm } from "@/components/project/CreateScriptForm";

export default function CreatePage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">로딩 중...</div>}>
      <CreateScriptForm scriptRemaining={5} />
    </Suspense>
  );
}
