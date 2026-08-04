import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";
import { GoogleImagenProvider } from "@/lib/ai/providers/imagen";
import { TextToSpeechProvider } from "@/lib/ai/providers/tts";
import { uploadDataUrlToMediaBucket } from "@/lib/storage";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  let jobId: string | undefined;
  const supabase = await createClientForServer();

  try {
    const { id: projectId } = await context.params;
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "AUTH_REQUIRED", message: "로그인이 필요합니다.", requestId },
        { status: 401 }
      );
    }

    // 1. Fetch project and scenes
    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("*, scenes(*)")
      .eq("id", projectId)
      .eq("user_id", user.id)
      .single();

    if (projErr || !project) {
      return NextResponse.json(
        { error: "PROJECT_NOT_FOUND", message: "프로젝트를 찾을 수 없습니다.", requestId },
        { status: 404 }
      );
    }

    const scenes = project.scenes || [];
    if (scenes.length === 0) {
      return NextResponse.json(
        { error: "NO_SCENES", message: "생성할 씬이 존재하지 않습니다.", requestId },
        { status: 400 }
      );
    }

    // Optional body filter to generate for a single scene ID
    let sceneIdToProcess: string | undefined;
    let idempotencyKey: string | undefined;
    try {
      const body = await request.json();
      sceneIdToProcess = body?.sceneId;
      idempotencyKey = body?.idempotencyKey;
    } catch {
      // Body empty or invalid JSON is fine, process all
    }

    if (!idempotencyKey) {
      return NextResponse.json(
        { error: "MISSING_IDEMPOTENCY_KEY", message: "중복 방지 키가 누락되었습니다.", requestId },
        { status: 400 }
      );
    }

    const targetScenes = sceneIdToProcess
      ? scenes.filter((s: { id: string }) => s.id === sceneIdToProcess)
      : scenes;

    if (targetScenes.length === 0) {
      return NextResponse.json(
        { error: "SCENE_NOT_FOUND", message: "대상 씬을 찾을 수 없습니다.", requestId },
        { status: 404 }
      );
    }

    // 2. Reserve Usage via PostgreSQL RPC (each scene = 1 media_generation credit)
    const { data: reserveRes, error: reserveError } = await supabase.rpc("reserve_usage", {
      p_job_type: "media_generation",
      p_idempotency_key: idempotencyKey,
      p_quantity: targetScenes.length,
      p_description: `미디어 생성: ${project.title || projectId}`,
    });

    if (reserveError) {
      console.error(`[${requestId}] [RESERVE_USAGE] Code: ${reserveError.code}, Message: ${reserveError.message}`);
      return NextResponse.json(
        {
          error: "RESERVE_USAGE_FAILED",
          errorCode: reserveError.code || "RESERVE_FAILED",
          message: reserveError.message.includes("USAGE_LIMIT_EXCEEDED")
            ? "이번 달 AI 미디어 생성 가능 횟수를 모두 소진하셨습니다."
            : "사용량 차감 예약에 실패했습니다.",
          requestId,
        },
        { status: 400 }
      );
    }

    const job = Array.isArray(reserveRes) ? reserveRes[0] : reserveRes;
    jobId = job.job_id;

    // If this exact request already completed (retry with same idempotency key), don't re-charge or re-call paid APIs
    if (job.already_exists && job.current_status === "completed") {
      const targetIds = new Set(targetScenes.map((s: { id: string }) => s.id));
      const { data: currentScenes } = await supabase
        .from("scenes")
        .select("*")
        .in("id", Array.from(targetIds));

      return NextResponse.json({
        success: true,
        projectId,
        processedCount: currentScenes?.length || 0,
        scenes: currentScenes || [],
        requestId,
        alreadyExists: true,
      });
    }

    const imagenProvider = new GoogleImagenProvider();
    const ttsProvider = new TextToSpeechProvider();

    console.log(`[${requestId}] Starting media generation for ${targetScenes.length} scenes in project ${projectId}`);

    // Update status to generating
    for (const scene of targetScenes) {
      await supabase
        .from("scenes")
        .update({ media_status: "generating" })
        .eq("id", scene.id);
    }

    const updatedScenes = [];

    // Process scenes sequentially
    for (const scene of targetScenes) {
      try {
        // A. Generate 9:16 Vertical Image using Google Imagen 3
        const imageResult = await imagenProvider.generateImage({
          prompt: scene.image_prompt || scene.visual_description,
          visualStyle: project.visual_style,
          mood: project.mood,
          aspectRatio: "9:16",
          requestId,
        });

        // B. Generate Voice Narration Audio using TTS
        const audioResult = await ttsProvider.generateAudio({
          text: scene.narration || scene.caption,
          voiceStyle: project.voice_style,
          requestId,
        });

        // Upload generated assets to storage instead of storing base64 inline
        const imageUrl = imageResult.imageUrl.startsWith("data:")
          ? await uploadDataUrlToMediaBucket(
              supabase,
              `projects/${projectId}/scenes/${scene.id}/image`,
              imageResult.imageUrl
            )
          : imageResult.imageUrl;

        const audioUrl = audioResult.audioUrl.startsWith("data:")
          ? await uploadDataUrlToMediaBucket(
              supabase,
              `projects/${projectId}/scenes/${scene.id}/audio`,
              audioResult.audioUrl
            )
          : audioResult.audioUrl;

        // C. Update DB Scene Record
        const { data: updatedScene, error: updateErr } = await supabase
          .from("scenes")
          .update({
            image_url: imageUrl,
            audio_url: audioUrl,
            media_status: "completed",
            asset_source: "ai_image",
            updated_at: new Date().toISOString(),
          })
          .eq("id", scene.id)
          .select("*")
          .single();

        if (updateErr) {
          console.error(`[${requestId}] Failed to update scene ${scene.id}: ${updateErr.message}`);
          updatedScenes.push({
            ...scene,
            image_url: imageUrl,
            audio_url: audioUrl,
            media_status: "completed",
          });
        } else {
          updatedScenes.push(updatedScene);
        }
      } catch (sceneErr: unknown) {
        console.error(
          `[${requestId}] Error processing scene ${scene.id}: ${sceneErr instanceof Error ? sceneErr.message : String(sceneErr)}`
        );
        await supabase
          .from("scenes")
          .update({ media_status: "failed" })
          .eq("id", scene.id);
      }
    }

    // Commit Usage Reservation - the paid Imagen/TTS calls were attempted for
    // every target scene regardless of whether the DB write afterward succeeded
    const { error: commitErr } = await supabase.rpc("commit_usage", { p_job_id: jobId });
    if (commitErr) {
      console.error(`[${requestId}] [COMMIT_USAGE] Code: ${commitErr.code}, Message: ${commitErr.message}`);
    }

    return NextResponse.json({
      success: true,
      projectId,
      processedCount: updatedScenes.length,
      scenes: updatedScenes,
      requestId,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[${requestId}] Generate media endpoint error: ${error.message}`);

    if (jobId) {
      const { error: relErr } = await supabase.rpc("release_usage", {
        p_job_id: jobId,
        p_error_message: error.message || "미디어 생성 실패",
      });
      if (relErr) {
        console.error(`[${requestId}] [RELEASE_USAGE] Code: ${relErr.code}, Message: ${relErr.message}`);
      }
    }

    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: error.message, requestId },
      { status: 500 }
    );
  }
}
