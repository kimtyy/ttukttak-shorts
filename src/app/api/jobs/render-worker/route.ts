import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";

/**
 * Internal trigger endpoint. Never imports @remotion/renderer / @remotion/bundler
 * directly — those packages pull in platform-specific native compositor binaries
 * (@remotion/compositor-linux-x64-gnu, etc.) that break `next build` when bundled
 * into a route handler. Instead this route only authenticates the request and
 * spawns scripts/render-worker-standalone.mjs as a separate OS process, which is
 * also the shape Cloud Run migration will reuse directly as a container entrypoint.
 *
 * This endpoint is NOT protected by src/middleware.ts (which only guards page
 * routes), so it requires its own shared-secret check — anyone who could reach it
 * unauthenticated would be able to trigger arbitrary-project renders through the
 * service-role worker.
 *
 * No file-based logging here: Vercel's Node.js serverless functions only allow
 * writes under /tmp, everything else (including the deployment's own working
 * directory, e.g. /var/task) is read-only, so `fs.mkdirSync("./logs/...")`
 * threw ENOENT in production and crashed this handler before it ever reached
 * spawn(). The child's stdio is inherited instead, so its output lands in the
 * same place this route's own console.log calls do (Vercel's function logs) —
 * no writable directory required either way.
 */
export async function POST(request: Request) {
  const requestId = `worker_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const expectedSecret = process.env.RENDER_WORKER_SECRET || "";
  const providedSecret = request.headers.get("x-worker-secret") || "";

  if (!expectedSecret) {
    console.error(`[${requestId}] RENDER_WORKER_SECRET is not configured on the server.`);
    return NextResponse.json(
      { error: "WORKER_MISCONFIGURED", message: "워커 인증 비밀키가 서버에 설정되지 않았습니다.", requestId },
      { status: 500 }
    );
  }

  if (!providedSecret || providedSecret !== expectedSecret) {
    console.warn(`[${requestId}] Rejected render-worker call: missing or invalid x-worker-secret.`);
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "워커 인증에 실패했습니다.", requestId },
      { status: 401 }
    );
  }

  const body = await request.json();
  const { renderJobId, usageJobId, projectId, userId } = body || {};

  if (!renderJobId || !projectId || !userId) {
    return NextResponse.json(
      { error: "INVALID_PARAMETERS", message: "renderJobId, projectId, userId가 필요합니다.", requestId },
      { status: 400 }
    );
  }

  const scriptPath = path.resolve("./scripts/render-worker-standalone.mjs");

  console.log(`[${requestId}] Spawning render-worker-standalone.mjs for renderJobId=${renderJobId} projectId=${projectId}`);

  const child = spawn(process.execPath, [scriptPath], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RENDER_JOB_ID: renderJobId,
      USAGE_JOB_ID: usageJobId || "",
      PROJECT_ID: projectId,
      USER_ID: userId,
    },
    detached: true,
    stdio: ["ignore", "inherit", "inherit"],
  });

  child.on("error", (err) => {
    console.error(`[${requestId}] Failed to spawn render-worker-standalone.mjs: ${err.message}`);
  });

  child.unref();

  console.log(`[${requestId}] Spawned render-worker-standalone.mjs pid=${child.pid} for renderJobId=${renderJobId}`);

  return NextResponse.json({
    success: true,
    renderJobId,
    status: "processing",
    pid: child.pid,
    requestId,
  }, { status: 202 });
}
