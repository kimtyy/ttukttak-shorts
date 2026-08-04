import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `render_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const { id: projectId } = await context.params;
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "AUTH_REQUIRED", message: "로그인이 필요합니다.", requestId },
        { status: 401 }
      );
    }

    const body = await request.json();
    const idempotencyKey = body?.idempotencyKey || `render_key_${Date.now()}_${projectId}`;

    // 1. Reserve Usage via PostgreSQL RPC (video_render job type)
    const { data: reserveRes, error: reserveError } = await supabase.rpc("reserve_usage", {
      p_job_type: "video_render",
      p_idempotency_key: idempotencyKey,
      p_quantity: 1,
      p_description: `쇼츠 동영상 MP4 렌더링 (Project: ${projectId})`,
    });

    if (reserveError) {
      console.error(`[${requestId}] [RESERVE_USAGE] Code: ${reserveError.code}, Message: ${reserveError.message}`);
      return NextResponse.json(
        {
          error: "RESERVE_USAGE_FAILED",
          errorCode: reserveError.code || "RESERVE_FAILED",
          message: reserveError.message.includes("USAGE_LIMIT_EXCEEDED")
            ? "이번 달 동영상 렌더링 가능 횟수(월 한도)를 모두 소진하셨습니다."
            : "사용량 차감 예약에 실패했습니다.",
          requestId,
        },
        { status: 400 }
      );
    }

    const job = Array.isArray(reserveRes) ? reserveRes[0] : reserveRes;
    const { job_id: jobId, already_exists: alreadyExists, current_status: currentStatus } = job;

    if (alreadyExists && (currentStatus === "completed" || currentStatus === "processing")) {
      const { data: existingRenderJob } = await supabase
        .from("render_jobs")
        .select("*")
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingRenderJob) {
        return NextResponse.json({
          jobId: existingRenderJob.id,
          status: existingRenderJob.status,
          progress: existingRenderJob.progress,
          videoUrl: existingRenderJob.video_url,
          alreadyExists: true,
          requestId,
        });
      }
    }

    // 2. Create Render Job record in render_jobs table
    const { data: newRenderJob, error: createErr } = await supabase
      .from("render_jobs")
      .insert({
        user_id: user.id,
        project_id: projectId,
        status: "queued",
        progress: 0,
        idempotency_key: idempotencyKey,
      })
      .select("*")
      .single();

    if (createErr) {
      console.error(`[${requestId}] Failed to create render job: ${createErr.message}`);
      await supabase.rpc("release_usage", { p_job_id: jobId, p_error_message: createErr.message });
      return NextResponse.json({ error: "RENDER_JOB_CREATE_FAILED", message: createErr.message, requestId }, { status: 500 });
    }

    // 3. Trigger Async Background Render Worker (Non-blocking)
    const workerUrl = new URL(`/api/jobs/render-worker`, request.url).toString();
    fetch(workerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        renderJobId: newRenderJob.id,
        usageJobId: jobId,
        projectId,
        userId: user.id,
      }),
    }).catch((err) => {
      console.warn(`[${requestId}] Async worker trigger dispatched: ${err.message}`);
    });

    // 4. Return Immediately (HTTP 202 Accepted)
    return NextResponse.json({
      success: true,
      jobId: newRenderJob.id,
      usageJobId: jobId,
      status: "queued",
      progress: 0,
      message: "동영상 렌더링 작업이 큐에 추가되었습니다.",
      requestId,
    }, { status: 202 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[${requestId}] Render request error: ${error.message}`);
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: error.message, requestId },
      { status: 500 }
    );
  }
}
