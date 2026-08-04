import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

export async function POST(request: Request) {
  const requestId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const body = await request.json();
    const { renderJobId, usageJobId, projectId } = body || {};

    if (!renderJobId || !projectId) {
      return NextResponse.json({ error: "INVALID_PARAMETERS", message: "renderJobId와 projectId가 필요합니다.", requestId }, { status: 400 });
    }

    // 1. Initialize Supabase Admin Service Role Client (No RLS user session dependency)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase URL 또는 Service Role Key가 환경변수에 설정되지 않았습니다.");
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    console.log(`[${requestId}] Starting real Remotion render worker for job ${renderJobId}, project ${projectId}`);

    const updateProgress = async (progressPercent: number, status = "processing") => {
      await supabaseAdmin
        .from("render_jobs")
        .update({
          status,
          progress: Math.min(100, Math.max(0, progressPercent)),
          updated_at: new Date().toISOString(),
        })
        .eq("id", renderJobId);
    };

    // Step 1: 5% Progress - Fetch Project and Scenes via Service Role Client
    await updateProgress(5);
    const { data: project, error: projErr } = await supabaseAdmin
      .from("projects")
      .select("*, scenes(*)")
      .eq("id", projectId)
      .single();

    if (projErr || !project || !project.scenes || project.scenes.length === 0) {
      throw new Error(`프로젝트 또는 씬 데이터를 찾을 수 없습니다: ${projErr?.message || "No scenes"}`);
    }

    const scenes = project.scenes.sort((a: { scene_number: number }, b: { scene_number: number }) => a.scene_number - b.scene_number);

    // Step 2: 15% Progress - Bundle Remotion Composition
    await updateProgress(15);
    const entryPoint = path.resolve("./src/remotion/Root.tsx");
    if (!fs.existsSync(entryPoint)) {
      throw new Error(`Remotion entry point not found: ${entryPoint}`);
    }

    const bundleLocation = await bundle({
      entryPoint,
      webpackOverride: (config) => config,
    });

    // Step 3: 35% Progress - Select Composition with Dynamic Props & Duration
    await updateProgress(35);
    const fps = 30;
    const totalDurationSec = scenes.reduce((acc: number, s: { duration: number }) => acc + (s.duration || 5), 0);
    const durationInFrames = Math.max(1, totalDurationSec * fps);

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "ShortsVideo",
      inputProps: {
        title: project.title || "뚝딱쇼츠 동영상",
        scenes,
        fps,
      },
    });

    // Override composition duration with dynamic total frames
    composition.durationInFrames = durationInFrames;

    // Step 4: Real Frame-by-Frame Rendering (40% to 90%)
    await updateProgress(40);
    const outputDir = path.resolve("./public/renders");
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputLocation = path.join(outputDir, `${projectId}_${Date.now()}.mp4`);

    await renderMedia({
      composition,
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation,
      onProgress: ({ progress }) => {
        const renderProgress = 40 + Math.round(progress * 50); // Scale 0-100% render to 40-90% overall
        updateProgress(renderProgress).catch(() => {});
      },
    });

    // Step 5: 95% Progress - Upload/Register MP4 Media Result
    await updateProgress(95);

    const videoUrl = `/renders/${path.basename(outputLocation)}`;

    // Step 6: 100% Progress - Mark Render Completed
    const completedTime = new Date().toISOString();
    await supabaseAdmin
      .from("render_jobs")
      .update({
        status: "completed",
        progress: 100,
        video_url: videoUrl,
        completed_at: completedTime,
        updated_at: completedTime,
      })
      .eq("id", renderJobId);

    // Commit Usage via RPC using Service Role Client
    if (usageJobId) {
      const { error: commitErr } = await supabaseAdmin.rpc("commit_usage", {
        p_job_id: usageJobId,
        p_description: `동영상 MP4 렌더링 완성: ${project.title}`,
      });

      if (commitErr) {
        console.error(`[${requestId}] Failed to commit usage: ${commitErr.message}`);
      }
    }

    console.log(`[${requestId}] Real Remotion rendering completed for job ${renderJobId}! URL: ${videoUrl}`);

    return NextResponse.json({
      success: true,
      renderJobId,
      status: "completed",
      progress: 100,
      videoUrl,
      requestId,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[${requestId}] Real Remotion render worker failed: ${error.message}`);

    try {
      const body = await request.clone().json();
      const { renderJobId, usageJobId } = body || {};

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

      if (supabaseUrl && serviceRoleKey) {
        const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
        if (renderJobId) {
          await supabaseAdmin
            .from("render_jobs")
            .update({
              status: "failed",
              error_message: error.message,
              updated_at: new Date().toISOString(),
            })
            .eq("id", renderJobId);
        }

        if (usageJobId) {
          await supabaseAdmin.rpc("release_usage", {
            p_job_id: usageJobId,
            p_error_message: error.message || "동영상 렌더링 실패",
          });
        }
      }
    } catch {
      // Ignore secondary error handling failure
    }

    return NextResponse.json(
      { error: "RENDER_WORKER_FAILED", message: error.message, requestId },
      { status: 500 }
    );
  }
}
