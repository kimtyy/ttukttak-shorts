import { Suspense } from "react";
import { createClientForServer } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage";
import { MyAssetsForm } from "@/components/project/MyAssetsForm";

export default async function MyAssetsPage() {
  const supabase = await createClientForServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const scriptRemaining = user ? (await getUsageSummary(supabase, user.id)).scriptRemaining : 0;

  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">로딩 중...</div>}>
      <MyAssetsForm scriptRemaining={scriptRemaining} />
    </Suspense>
  );
}
