import { NextResponse } from "next/server";
import { createClientForServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClientForServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("bgm_tracks")
    .select("id, title, storage_path, duration_seconds")
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "BGM_TRACKS_FETCH_FAILED", message: error.message }, { status: 500 });
  }

  return NextResponse.json({ tracks: data || [] });
}
