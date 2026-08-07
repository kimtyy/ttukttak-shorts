import { NextResponse } from "next/server";
import { JobsClient } from "@google-cloud/run";

/**
 * Internal trigger endpoint. Triggers an Execution of the `render-worker` Cloud
 * Run Job (see Dockerfile.render-worker / scripts/render-worker-standalone.mjs,
 * which is the container's entrypoint) via the Cloud Run Admin API, passing the
 * per-render parameters as container env var overrides instead of spawning a
 * local child process — Vercel's serverless filesystem/process model can't host
 * a Chromium-based Remotion render, which is why this now delegates to Cloud Run.
 *
 * This endpoint is NOT protected by src/middleware.ts (which only guards page
 * routes), so it requires its own shared-secret check — anyone who could reach it
 * unauthenticated would be able to trigger arbitrary-project renders (billable
 * Cloud Run executions) through the service-role worker.
 */

let jobsClient: JobsClient | null = null;

function getJobsClient(): JobsClient {
  if (jobsClient) return jobsClient;

  const keyBase64 = process.env.GCP_SERVICE_ACCOUNT_KEY_BASE64 || "";
  if (!keyBase64) {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY_BASE64가 설정되지 않았습니다.");
  }
  const credentials = JSON.parse(Buffer.from(keyBase64, "base64").toString("utf-8"));

  jobsClient = new JobsClient({ credentials, projectId: credentials.project_id });
  return jobsClient;
}

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

  const gcpProjectId = process.env.GCP_PROJECT_ID || "";
  const gcpRegion = process.env.GCP_REGION || "";
  const cloudRunJobName = process.env.CLOUD_RUN_JOB_NAME || "";

  if (!gcpProjectId || !gcpRegion || !cloudRunJobName) {
    console.error(`[${requestId}] GCP_PROJECT_ID / GCP_REGION / CLOUD_RUN_JOB_NAME이 서버에 설정되지 않았습니다.`);
    return NextResponse.json(
      { error: "WORKER_MISCONFIGURED", message: "Cloud Run Job 설정이 서버에 없습니다.", requestId },
      { status: 500 }
    );
  }

  console.log(`[${requestId}] Triggering Cloud Run Job execution for renderJobId=${renderJobId} projectId=${projectId}`);

  try {
    const client = getJobsClient();
    const [operation] = await client.runJob({
      name: `projects/${gcpProjectId}/locations/${gcpRegion}/jobs/${cloudRunJobName}`,
      overrides: {
        containerOverrides: [
          {
            env: [
              { name: "RENDER_JOB_ID", value: renderJobId },
              { name: "USAGE_JOB_ID", value: usageJobId || "" },
              { name: "PROJECT_ID", value: projectId },
              { name: "USER_ID", value: userId },
            ],
          },
        ],
      },
    });

    const executionName = operation.metadata && "name" in operation.metadata ? operation.metadata.name : undefined;

    console.log(`[${requestId}] Cloud Run Job execution started: ${executionName || operation.name}`);

    return NextResponse.json({
      success: true,
      renderJobId,
      status: "processing",
      executionName,
      requestId,
    }, { status: 202 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[${requestId}] Failed to trigger Cloud Run Job execution: ${error.message}`);
    return NextResponse.json(
      { error: "TRIGGER_FAILED", message: error.message, requestId },
      { status: 500 }
    );
  }
}
