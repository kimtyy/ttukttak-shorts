import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";
import { OpenAIRecommendationProvider } from "@/lib/ai/providers/openai";

export async function POST(request: Request) {
  try {
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { idempotencyKey } = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: "MISSING_IDEMPOTENCY_KEY", message: "중복 방지 키가 누락되었습니다." }, { status: 400 });
    }

    // 1. Fetch Profile
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

    // 2. Reserve Recommendation Usage
    const { data: reserveRes, error: reserveError } = await supabase.rpc("reserve_usage", {
      p_job_type: "topic_recommendation",
      p_idempotency_key: idempotencyKey,
      p_quantity: 1,
      p_description: "AI 주제 추천 10개 생성",
    });

    if (reserveError) {
      const msg = reserveError.message.includes("USAGE_LIMIT_EXCEEDED")
        ? "이번 달 AI 추천 사용량 한도를 모두 소진하였습니다."
        : reserveError.message || "사용량 확인 중 오류가 발생했습니다.";
      return NextResponse.json({ error: reserveError.message, message: msg }, { status: 400 });
    }

    const job = Array.isArray(reserveRes) ? reserveRes[0] : reserveRes;
    const { job_id: jobId, already_exists: alreadyExists } = job;

    if (alreadyExists && job.current_status === "completed") {
      const { data: existingRecs } = await supabase
        .from("topic_recommendations")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      return NextResponse.json({ recommendations: existingRecs, jobId, alreadyExists: true });
    }

    // 3. AI Recommendations
    const provider = new OpenAIRecommendationProvider();
    let recs;
    try {
      recs = await provider.generateRecommendations({ profile: profile || { id: user.id, display_name: "사용자", onboarding_completed: false, created_at: "", updated_at: "" } });
    } catch (aiErr: unknown) {
      const error = aiErr as Error;
      await supabase.rpc("release_usage", { p_job_id: jobId, p_error_message: error.message });
      return NextResponse.json({ error: "AI_RECOMMENDATION_FAILED", message: "추천을 생성하지 못했습니다. 잠시 후 다시 시도해주세요." }, { status: 500 });
    }

    // Save Recommendations to DB with trend_verified = false forced
    const recInserts = recs.map((r) => ({
      user_id: user.id,
      title: r.title,
      summary: r.summary,
      reason: r.reason,
      audience: r.audience,
      hook: r.hook,
      suggested_duration: r.suggested_duration,
      difficulty: r.difficulty,
      required_assets: r.required_assets,
      purpose: r.purpose,
      source: r.source,
      confidence: r.confidence,
      trend_verified: false, // STRICT FORCED FALSE
    }));

    const { data: savedRecs, error: saveErr } = await supabase
      .from("topic_recommendations")
      .insert(recInserts)
      .select();

    if (saveErr) {
      await supabase.rpc("release_usage", { p_job_id: jobId, p_error_message: saveErr.message });
      return NextResponse.json({ error: "RECOMMENDATION_SAVE_FAILED" }, { status: 500 });
    }

    // Commit Usage
    await supabase.rpc("commit_usage", { p_job_id: jobId });

    return NextResponse.json({ recommendations: savedRecs, jobId, alreadyExists: false });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
