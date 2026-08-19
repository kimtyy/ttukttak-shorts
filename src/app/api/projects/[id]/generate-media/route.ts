import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";
import { GoogleImagenProvider } from "@/lib/ai/providers/imagen";
import { TextToSpeechProvider } from "@/lib/ai/providers/tts";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const requestId = `media_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

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
    try {
      const body = await request.json();
      sceneIdToProcess = body?.sceneId;
    } catch {
      // Body empty or invalid JSON is fine, process all
    }

    const imagenProvider = new GoogleImagenProvider();
    const ttsProvider = new TextToSpeechProvider();

    const targetScenes = sceneIdToProcess
      ? scenes.filter((s: { id: string }) => s.id === sceneIdToProcess)
      : scenes;

    console.log(`[${requestId}] Starting media generation for ${targetScenes.length} scenes in project ${projectId}`);

    // Update status to generating
    for (const scene of targetScenes) {
      await supabase
        .from("scenes")
        .update({ media_status: "generating" })
        .eq("id", scene.id);
    }

    const updatedScenes = [];
    const failures: Array<{ sceneId: string; sceneNumber: number; stage: string; message: string }> = [];

    const isMusicOnly = project.narration_mode === "music_only";

    // Process scenes in parallel or sequential
    for (const scene of targetScenes) {
      try {
        // "내 자료로 만들기" 씬은 이미 사용자가 올린 실제 사진을 가리키고 있으므로
        // AI 이미지로 덮어쓰지 않는다.
        const isUserUpload = scene.asset_source === "user_upload" && !!scene.image_url;

        // A. Generate 9:16 Vertical Image using Google Imagen 3 (user_upload 씬은 스킵)
        const imageUrl = isUserUpload
          ? scene.image_url
          : (
              await imagenProvider.generateImage({
                prompt: scene.image_prompt || scene.visual_description,
                visualStyle: project.visual_style,
                mood: project.mood,
                aspectRatio: "9:16",
                requestId,
              })
            ).imageUrl;

        // B. Generate Voice Narration Audio using TTS (narration_mode='music_only'면 스킵)
        const audioUrl = isMusicOnly
          ? null
          : (
              await ttsProvider.generateAudio({
                text: scene.narration || scene.caption,
                voiceStyle: project.voice_style,
                requestId,
              })
            ).audioUrl;

        // C. Update DB Scene Record
        const { data: updatedScene, error: updateErr } = await supabase
          .from("scenes")
          .update({
            image_url: imageUrl,
            audio_url: audioUrl,
            media_status: "completed",
            asset_source: isUserUpload ? "user_upload" : "ai_image",
            updated_at: new Date().toISOString(),
          })
          .eq("id", scene.id)
          .select("*")
          .single();

        if (updateErr) {
          console.error(`[${requestId}] Failed to update scene ${scene.id}: ${updateErr.message}`);
          failures.push({
            sceneId: scene.id,
            sceneNumber: scene.scene_number,
            stage: "DB_UPDATE",
            message: updateErr.message,
          });
          await supabase.from("scenes").update({ media_status: "failed" }).eq("id", scene.id);
          continue;
        }

        updatedScenes.push(updatedScene);
      } catch (sceneErr: unknown) {
        const message = sceneErr instanceof Error ? sceneErr.message : String(sceneErr);
        console.error(`[${requestId}] Error processing scene ${scene.id}: ${message}`);
        failures.push({ sceneId: scene.id, sceneNumber: scene.scene_number, stage: "GENERATION", message });
        await supabase.from("scenes").update({ media_status: "failed" }).eq("id", scene.id);
      }
    }

    if (failures.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: "MEDIA_GENERATION_FAILED",
          message: `${failures.length}/${targetScenes.length}개 씬의 미디어 생성 또는 저장에 실패했습니다.`,
          projectId,
          processedCount: updatedScenes.length,
          failedCount: failures.length,
          failures,
          scenes: updatedScenes,
          requestId,
        },
        { status: 500 }
      );
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
    return NextResponse.json(
      { error: "INTERNAL_SERVER_ERROR", message: error.message, requestId },
      { status: 500 }
    );
  }
}
