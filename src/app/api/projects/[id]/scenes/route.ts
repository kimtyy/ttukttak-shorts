import { NextRequest, NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await context.params;
    const supabase = await createClientForServer();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const body = await request.json();
    const {
      version,
      title,
      hook,
      thumbnail_text,
      description,
      hashtags,
      total_narration,
      content_strategy,
      scenes,
      narration_mode,
      bgm_track_id,
    } = body;

    if (version === undefined || !scenes || !Array.isArray(scenes)) {
      return NextResponse.json({ error: "INVALID_SAVE_PAYLOAD" }, { status: 400 });
    }

    const { data: newVersion, error } = await supabase.rpc("save_project_scenes", {
      p_project_id: projectId,
      p_version: version,
      p_title: title,
      p_hook: hook,
      p_thumbnail_text: thumbnail_text,
      p_description: description,
      p_hashtags: hashtags || [],
      p_total_narration: total_narration,
      p_content_strategy: content_strategy,
      p_scenes: scenes,
      p_narration_mode: narration_mode ?? null,
      p_bgm_track_id: bgm_track_id ?? null,
    });

    if (error) {
      if (error.message.includes("SAVE_CONFLICT")) {
        return NextResponse.json({ error: "SAVE_CONFLICT", message: error.message }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, version: newVersion });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: "INTERNAL_SERVER_ERROR", message: error.message }, { status: 500 });
  }
}
