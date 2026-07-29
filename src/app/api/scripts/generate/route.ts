import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";
import { OpenAIScriptProvider } from "@/lib/ai/providers/openai";
import { GenerateScriptInput } from "@/types";

export async function POST(request: Request) {
  try {
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Authentication Guard
    if (!user) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "로그인이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { idempotencyKey, ...input }: { idempotencyKey: string } & GenerateScriptInput = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: "MISSING_IDEMPOTENCY_KEY", message: "중복 방지 키가 누락되었습니다." }, { status: 400 });
    }

    // 2. Reserve Usage via PostgreSQL RPC
    const { data: reserveRes, error: reserveError } = await supabase.rpc("reserve_usage", {
      p_job_type: "script_generation",
      p_idempotency_key: idempotencyKey,
      p_quantity: 1,
      p_description: `대본 생성: ${input.topic || "자유 주제"}`,
    });

    if (reserveError) {
      return NextResponse.json({ error: reserveError.message }, { status: 400 });
    }

    const job = Array.isArray(reserveRes) ? reserveRes[0] : reserveRes;
    const { job_id: jobId, already_exists: alreadyExists } = job;

    // If job already existed and completed, return existing project if available
    if (alreadyExists && job.current_status === "completed") {
      const { data: existingProj } = await supabase
        .from("projects")
        .select("*, scenes(*)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingProj) {
        return NextResponse.json({ project: existingProj, jobId, alreadyExists: true });
      }
    }

    // 3. AI Generation Process
    const provider = new OpenAIScriptProvider();
    let generatedScript;
    try {
      generatedScript = await provider.generateScript(input);
    } catch (aiError: unknown) {
      const error = aiError as Error;
      await supabase.rpc("release_usage", {
        p_job_id: jobId,
        p_error_message: error.message || "AI 대본 생성 실패",
      });
      return NextResponse.json(
        { error: "AI_GENERATION_FAILED", message: "AI 대본 생성 중 오류가 발생하여 사용량이 환급되었습니다." },
        { status: 500 }
      );
    }

    // 5. Create Project & Scenes in DB
    const { data: project, error: projError } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        title: generatedScript.title,
        topic: input.topic || "",
        purpose: input.purpose || "free",
        duration: input.duration || 30,
        hook: generatedScript.hook,
        thumbnail_text: generatedScript.thumbnail_text,
        description: generatedScript.description,
        hashtags: generatedScript.hashtags,
        total_narration: generatedScript.total_narration,
        content_strategy: generatedScript.content_strategy,
        target_audience: generatedScript.target_audience,
        call_to_action: generatedScript.call_to_action,
        launch_status: input.launch_status,
        status: "script_completed",
      })
      .select()
      .single();

    if (projError || !project) {
      await supabase.rpc("release_usage", {
        p_job_id: jobId,
        p_error_message: projError?.message || "프로젝트 저장 실패",
      });
      return NextResponse.json({ error: "PROJECT_SAVE_FAILED", message: "프로젝트 저장 실패" }, { status: 500 });
    }

    // Insert Scenes
    const sceneInserts = generatedScript.scenes.map((s, idx) => ({
      project_id: project.id,
      scene_number: idx + 1,
      role: s.role,
      duration: s.duration,
      narration: s.narration,
      caption: s.caption,
      visual_description: s.visual_description,
      image_prompt: s.image_prompt,
      required_asset: s.required_asset || "",
      asset_source: s.asset_source,
      motion: s.motion,
      transition: s.transition,
    }));

    await supabase.from("scenes").insert(sceneInserts);

    // 6. Commit Usage Reservation
    await supabase.rpc("commit_usage", { p_job_id: jobId });

    return NextResponse.json({ project, jobId, alreadyExists: false });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
