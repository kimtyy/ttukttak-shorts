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

    // Process scenes in parallel or sequential
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

        // C. Update DB Scene Record
        const { data: updatedScene, error: updateErr } = await supabase
          .from("scenes")
          .update({
            image_url: imageResult.imageUrl,
            audio_url: audioResult.audioUrl,
            media_status: "completed",
            asset_source: imageResult.provider === "imagen-3" ? "ai_image" : "ai_image",
            updated_at: new Date().toISOString(),
          })
          .eq("id", scene.id)
          .select("*")
          .single();

        if (updateErr) {
          console.error(`[${requestId}] Failed to update scene ${scene.id}: ${updateErr.message}`);
          updatedScenes.push({
            ...scene,
            image_url: imageResult.imageUrl,
            audio_url: audioResult.audioUrl,
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
