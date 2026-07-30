import { notFound } from "next/navigation";
import { createClientForServer } from "@/lib/supabase/server";
import { SceneEditor, type ProjectHeaderData } from "@/components/project/SceneEditor";
import { ShortsScene } from "@/types";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClientForServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*, scenes(*)")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!project) {
    notFound();
  }

  const projectHeader: ProjectHeaderData = {
    id: project.id,
    title: project.title,
    duration: project.duration,
    hook: project.hook,
    thumbnail_text: project.thumbnail_text,
    description: project.description,
    hashtags: project.hashtags,
    total_narration: project.total_narration,
    content_strategy: project.content_strategy,
    version: project.version,
  };

  const scenes: ShortsScene[] = (project.scenes || [])
    .slice()
    .sort((a: ShortsScene, b: ShortsScene) => a.scene_number - b.scene_number);

  return <SceneEditor project={projectHeader} scenes={scenes} />;
}
