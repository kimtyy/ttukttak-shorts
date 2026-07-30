import { createClientForServer } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage";
import { DashboardView } from "@/components/dashboard/DashboardView";

export default async function DashboardPage() {
  const supabase = await createClientForServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <DashboardView />;
  }

  const usage = await getUsageSummary(supabase, user.id);

  const { data: recentProjects } = await supabase
    .from("projects")
    .select("id, title, duration, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <DashboardView
      usage={{
        planName: usage.planName,
        scriptRemaining: usage.scriptRemaining,
        scriptLimit: usage.scriptLimit,
      }}
      recentProjects={recentProjects || []}
    />
  );
}
