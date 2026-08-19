import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    // Fetch Active Subscription & Plan
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*, plan:plans(*)")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due"])
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (!sub || !sub.plan) {
      return NextResponse.json({
        planName: "Free Standard",
        scriptLimit: 30,
        scriptUsed: 0,
        scriptRemaining: 30,
        recommendationLimit: 10,
        recommendationUsed: 0,
        recommendationRemaining: 10,
        renderLimit: 3,
        renderUsed: 0,
        renderRemaining: 3,
      });
    }

    const plan = sub.plan;

    // Calculate Script Debits (Committed + Pending) in Period
    const { data: scriptLedger } = await supabase
      .from("usage_ledger")
      .select("quantity")
      .eq("user_id", user.id)
      .in("action", ["script_generation", "script_regeneration"])
      .eq("direction", "debit")
      .in("status", ["committed", "pending"])
      .gte("period_start", sub.current_period_start)
      .lte("period_end", sub.current_period_end);

    const scriptUsed = (scriptLedger || []).reduce((acc, curr) => acc + curr.quantity, 0);

    // Calculate Recommendation Debits in Period
    const { data: recLedger } = await supabase
      .from("usage_ledger")
      .select("quantity")
      .eq("user_id", user.id)
      .eq("action", "topic_recommendation")
      .eq("direction", "debit")
      .in("status", ["committed", "pending"])
      .gte("period_start", sub.current_period_start)
      .lte("period_end", sub.current_period_end);

    const recUsed = (recLedger || []).reduce((acc, curr) => acc + curr.quantity, 0);

    // Calculate Render Debits (Committed + Pending) in Period
    const { data: renderLedger } = await supabase
      .from("usage_ledger")
      .select("quantity")
      .eq("user_id", user.id)
      .eq("action", "video_render")
      .eq("direction", "debit")
      .in("status", ["committed", "pending"])
      .gte("period_start", sub.current_period_start)
      .lte("period_end", sub.current_period_end);

    const renderUsed = (renderLedger || []).reduce((acc, curr) => acc + curr.quantity, 0);

    return NextResponse.json({
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
      renderLimit: plan.monthly_render_limit,
      renderUsed,
      renderRemaining: Math.max(0, plan.monthly_render_limit - renderUsed),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
