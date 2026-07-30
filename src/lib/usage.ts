import { createClientForServer } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClientForServer>>;

export interface UsageSummary {
  planCode: string;
  planName: string;
  periodStart: string | null;
  periodEnd: string | null;
  scriptLimit: number;
  scriptUsed: number;
  scriptRemaining: number;
  recommendationLimit: number;
  recommendationUsed: number;
  recommendationRemaining: number;
}

const FREE_DEFAULTS: UsageSummary = {
  planCode: "free",
  planName: "Free Standard",
  periodStart: null,
  periodEnd: null,
  scriptLimit: 5,
  scriptUsed: 0,
  scriptRemaining: 5,
  recommendationLimit: 10,
  recommendationUsed: 0,
  recommendationRemaining: 10,
};

export async function getUsageSummary(
  supabase: SupabaseServerClient,
  userId: string
): Promise<UsageSummary> {
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("*, plan:plans(*)")
    .eq("user_id", userId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (!sub || !sub.plan) {
    return FREE_DEFAULTS;
  }

  const plan = sub.plan;

  const { data: scriptLedger } = await supabase
    .from("usage_ledger")
    .select("quantity")
    .eq("user_id", userId)
    .in("action", ["script_generation", "script_regeneration"])
    .eq("direction", "debit")
    .in("status", ["committed", "pending"])
    .gte("period_start", sub.current_period_start)
    .lte("period_end", sub.current_period_end);

  const scriptUsed = (scriptLedger || []).reduce(
    (acc: number, curr: { quantity: number }) => acc + curr.quantity,
    0
  );

  const { data: recLedger } = await supabase
    .from("usage_ledger")
    .select("quantity")
    .eq("user_id", userId)
    .eq("action", "topic_recommendation")
    .eq("direction", "debit")
    .in("status", ["committed", "pending"])
    .gte("period_start", sub.current_period_start)
    .lte("period_end", sub.current_period_end);

  const recUsed = (recLedger || []).reduce(
    (acc: number, curr: { quantity: number }) => acc + curr.quantity,
    0
  );

  return {
    planCode: plan.code,
    planName: plan.name,
    periodStart: sub.current_period_start,
    periodEnd: sub.current_period_end,
    scriptLimit: plan.monthly_script_limit,
    scriptUsed,
    scriptRemaining: Math.max(0, plan.monthly_script_limit - scriptUsed),
    recommendationLimit: plan.monthly_recommendation_limit,
    recommendationUsed: recUsed,
    recommendationRemaining: Math.max(0, plan.monthly_recommendation_limit - recUsed),
  };
}
