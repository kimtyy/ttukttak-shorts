import { createClient } from "@supabase/supabase-js";
import { Storage } from "@google-cloud/storage";
import path from "path";
import os from "os";
import fs from "fs";
import { renderProject } from "./lib/render-project.mjs";

/**
 * Standalone render worker process. Spawned by src/app/api/jobs/render-worker/route.ts
 * as a child process so that @remotion/renderer (and its platform-specific native
 * compositor binaries) never gets statically bundled into the Next.js build.
 *
 * This is the entrypoint that Cloud Run migration will reuse directly (swap
 * "spawn local child process" for "invoke this as the container's CMD").
 *
 * Job identifiers are passed via environment variables rather than argv to avoid
 * shell-escaping issues with Korean/unicode project titles.
 */

const renderJobId = process.env.RENDER_JOB_ID;
const usageJobId = process.env.USAGE_JOB_ID || "";
const projectId = process.env.PROJECT_ID;
const userId = process.env.USER_ID;

let supabaseAdmin;

// onProgress fires many un-awaited updateProgress() calls while renderMedia()
// is in flight. If the render crashes, one of those in-flight calls can
// resolve *after* the failure handler writes status="failed", silently
// clobbering it back to "processing" (progress-only writes never touch
// error_message, so the row ends up stuck as processing with a stale
// error_message forever). This flag stops any progress write from landing
// once a terminal status has been written.
let settled = false;

function log(msg) {
  console.log(`[render-worker-standalone] ${new Date().toISOString()} ${msg}`);
}

async function updateProgress(progress, status = "processing") {
  if (settled) return;
  await supabaseAdmin
    .from("render_jobs")
    .update({
      status,
      progress: Math.min(100, Math.max(0, Math.round(progress))),
      updated_at: new Date().toISOString(),
    })
    .eq("id", renderJobId);
}

async function main() {
  if (!renderJobId || !projectId || !userId) {
    throw new Error("필수 환경변수 누락: RENDER_JOB_ID, PROJECT_ID, USER_ID가 모두 필요합니다.");
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const outputBucket = process.env.RENDER_OUTPUT_BUCKET || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.");
  }
  if (!outputBucket) {
    throw new Error("RENDER_OUTPUT_BUCKET이 설정되지 않았습니다. 렌더링 결과물을 저장할 GCS 버킷이 필요합니다.");
  }

  supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  log(`Starting render for renderJobId=${renderJobId} projectId=${projectId}`);
  await updateProgress(5);

  const { data: project, error: projErr } = await supabaseAdmin
    .from("projects")
    .select("*, scenes(*)")
    .eq("id", projectId)
    .single();

  if (projErr || !project || !project.scenes || project.scenes.length === 0) {
    throw new Error(`프로젝트 또는 씬 데이터를 찾을 수 없습니다: ${projErr?.message || "No scenes"}`);
  }

  await updateProgress(15);

  let bgmUrl = null;
  if (project.narration_mode === "music_only" && project.bgm_track_id) {
    const { data: bgmTrack } = await supabaseAdmin
      .from("bgm_tracks")
      .select("storage_path")
      .eq("id", project.bgm_track_id)
      .maybeSingle();

    if (bgmTrack?.storage_path) {
      const { data: publicUrlData } = supabaseAdmin.storage.from("bgm-tracks").getPublicUrl(bgmTrack.storage_path);
      bgmUrl = publicUrlData.publicUrl;
    } else {
      log(`WARNING: bgm_track_id=${project.bgm_track_id} 를 찾을 수 없어 배경음악 없이 렌더링합니다.`);
    }
  }

  const objectName = `${projectId}_${Date.now()}.mp4`;
  const outputLocation = path.join(os.tmpdir(), objectName);

  const result = await renderProject({
    title: project.title || "뚝딱쇼츠 동영상",
    scenes: project.scenes,
    outputLocation,
    narrationMode: project.narration_mode || "ai_voice",
    bgmUrl,
    onProgress: (p) => {
      updateProgress(40 + Math.round(p * 50)).catch(() => {});
    },
  });

  await updateProgress(90);

  log(`Uploading render to gs://${outputBucket}/${objectName}`);
  const storage = new Storage();
  await storage.bucket(outputBucket).upload(outputLocation, {
    destination: objectName,
    contentType: "video/mp4",
  });
  fs.unlinkSync(outputLocation);

  await updateProgress(95);

  const videoUrl = `https://storage.googleapis.com/${outputBucket}/${objectName}`;
  const completedTime = new Date().toISOString();

  settled = true;
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

  if (usageJobId) {
    const { error: commitErr } = await supabaseAdmin.rpc("commit_usage", {
      p_job_id: usageJobId,
      p_user_id: userId,
      p_description: `동영상 MP4 렌더링 완성: ${project.title}`,
    });
    if (commitErr) {
      log(`WARNING: commit_usage failed: ${commitErr.message}`);
    } else {
      log(`commit_usage succeeded for usageJobId=${usageJobId}`);
    }
  }

  log(`Render completed. duration=${result.totalDurationSec}s scenes=${result.sceneCount} url=${videoUrl}`);
  process.exit(0);
}

main().catch(async (err) => {
  log(`FAILED: ${err.message}`);
  settled = true;

  try {
    if (supabaseAdmin && renderJobId) {
      await supabaseAdmin
        .from("render_jobs")
        .update({
          status: "failed",
          error_message: err.message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", renderJobId);
    }

    if (supabaseAdmin && usageJobId && userId) {
      const { error: releaseErr } = await supabaseAdmin.rpc("release_usage", {
        p_job_id: usageJobId,
        p_user_id: userId,
        p_error_message: err.message || "동영상 렌더링 실패",
      });
      if (releaseErr) {
        log(`WARNING: release_usage failed: ${releaseErr.message}`);
      } else {
        log(`release_usage succeeded for usageJobId=${usageJobId}`);
      }
    }
  } catch (secondaryErr) {
    log(`Secondary error handling also failed: ${secondaryErr.message}`);
  }

  process.exit(1);
});
