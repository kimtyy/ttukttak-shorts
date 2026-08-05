import { createClientForServer } from "@/lib/supabase/server";
import { getUsageSummary } from "@/lib/usage";
import { RecommendationsView } from "@/components/recommendation/RecommendationsView";

export default async function RecommendationsPage() {
  const supabase = await createClientForServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const recommendationRemaining = user
    ? (await getUsageSummary(supabase, user.id)).recommendationRemaining
    : 0;

  return <RecommendationsView recommendationRemaining={recommendationRemaining} />;
}
