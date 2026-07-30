import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";
import { OpenAIScriptProvider } from "@/lib/ai/providers/openai";
import { GenerateScriptInput } from "@/types";

export async function POST(request: Request) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    // 1. Authentication Guard
    if (!user) {
      return NextResponse.json({ error: "AUTH_REQUIRED", message: "로그인이 필요합니다.", requestId }, { status: 401 });
    }

    const body = await request.json();
    const { idempotencyKey, ...input }: { idempotencyKey: string } & GenerateScriptInput = body;

    if (!idempotencyKey) {
      return NextResponse.json({ error: "MISSING_IDEMPOTENCY_KEY", message: "중복 방지 키가 누락되었습니다.", requestId }, { status: 400 });
    }

    // 2. Reserve Usage via PostgreSQL RPC
    const { data: reserveRes, error: reserveError } = await supabase.rpc("reserve_usage", {
      p_job_type: "script_generation",
      p_idempotency_key: idempotencyKey,
      p_quantity: 1,
      p_description: `대본 생성: ${input.topic || "자유 주제"}`,
    });

    if (reserveError) {
      console.error(`[${requestId}] [RESERVE_USAGE] Code: ${reserveError.code}, Message: ${reserveError.message}`);
      return NextResponse.json(
        {
          error: "RESERVE_USAGE_FAILED",
          errorCode: reserveError.code || "RESERVE_FAILED",
          message: reserveError.message.includes("USAGE_LIMIT_EXCEEDED")
            ? "이번 달 대본 생성 가능 횟수를 모두 소진하셨습니다."
            : "사용량 차감 예약에 실패했습니다.",
          requestId,
        },
        { status: 400 }
      );
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
        return NextResponse.json({ project: existingProj, jobId, alreadyExists: true, requestId });
      }
    }

    // 3. AI Generation Process
    const provider = new OpenAIScriptProvider();
    let generatedScript;
    try {
      generatedScript = await provider.generateScript(input, requestId);
    } catch (aiErr: unknown) {
      const error = aiErr as {
        stage?: string;
        errorCode?: string;
        openAiStatus?: number;
        openAiErrorType?: string;
        zodErrorFields?: string;
        message?: string;
      };

      const stage = error.stage || "OPENAI_REQUEST";
      const errorCode = error.errorCode || "AI_GENERATION_FAILED";

      console.error(`[${requestId}] [${stage}] ErrorCode: ${errorCode}, Status: ${error.openAiStatus || "N/A"}, Type: ${error.openAiErrorType || "N/A"}, Fields: ${error.zodErrorFields || "N/A"}`);

      // Release Usage
      const { error: relErr } = await supabase.rpc("release_usage", {
        p_job_id: jobId,
        p_error_message: error.message || "AI 대본 생성 실패",
      });

      if (relErr) {
        console.error(`[${requestId}] [RELEASE_USAGE] Code: ${relErr.code}, Message: ${relErr.message}`);
      }

      return NextResponse.json(
        {
          message: "AI 대본 생성 중 오류가 발생하여 사용량이 환불되었습니다.",
          errorCode,
          requestId,
        },
        { status: 500 }
      );
    }

    // 4. Create Project in DB
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
      console.error(`[${requestId}] [PROJECT_SAVE] Code: ${projError?.code}, Message: ${projError?.message}`);

      await supabase.rpc("release_usage", {
        p_job_id: jobId,
        p_error_message: projError?.message || "프로젝트 저장 실패",
      });

      return NextResponse.json(
        {
          message: "프로젝트 저장 중 오류가 발생하여 사용량이 환불되었습니다.",
          errorCode: "PROJECT_SAVE_FAILED",
          requestId,
        },
        { status: 500 }
      );
    }

    // 5. Create Scenes in DB
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

    const { error: scenesError } = await supabase.from("scenes").insert(sceneInserts);

    if (scenesError) {
      console.error(`[${requestId}] [SCENES_SAVE] Code: ${scenesError.code}, Message: ${scenesError.message}`);

      await supabase.rpc("release_usage", {
        p_job_id: jobId,
        p_error_message: scenesError.message || "장면 저장 실패",
      });

      return NextResponse.json(
        {
          message: "장면 저장 중 오류가 발생하여 사용량이 환불되었습니다.",
          errorCode: "SCENES_SAVE_FAILED",
          requestId,
        },
        { status: 500 }
      );
    }

    // 6. Commit Usage Reservation
    const { error: commitErr } = await supabase.rpc("commit_usage", { p_job_id: jobId });
    if (commitErr) {
      console.error(`[${requestId}] [COMMIT_USAGE] Code: ${commitErr.code}, Message: ${commitErr.message}`);
    }

    return NextResponse.json({ project, jobId, alreadyExists: false, requestId });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[${requestId}] [UNHANDLED_EXCEPTION] Message: ${error.message}`);
    return NextResponse.json(
      {
        message: "서버 내부 오류가 발생했습니다.",
        errorCode: "INTERNAL_SERVER_ERROR",
        requestId,
      },
      { status: 500 }
    );
  }
}
