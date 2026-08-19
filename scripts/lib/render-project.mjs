import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

const ENTRY_POINT = path.resolve("./src/remotion/Root.tsx");

/**
 * Bundles the Remotion composition and renders an MP4 for the given scenes.
 * Duration is derived from the sum of scene.duration (not the Root.tsx default),
 * matching what Series.Sequence in ShortsVideo.tsx actually plays.
 */
export async function renderProject({
  title,
  scenes,
  outputLocation,
  fps = 30,
  onProgress,
  includeBgm = false,
  bgmUrl = null,
}) {
  if (!fs.existsSync(ENTRY_POINT)) {
    throw new Error(`Remotion entry point not found: ${ENTRY_POINT}`);
  }
  if (!scenes || scenes.length === 0) {
    throw new Error("scenes 배열이 비어 있습니다.");
  }

  const sortedScenes = [...scenes].sort((a, b) => a.scene_number - b.scene_number);
  const totalDurationSec = sortedScenes.reduce((acc, s) => acc + (s.duration || 5), 0);
  const durationInFrames = Math.max(1, Math.round(totalDurationSec * fps));

  const bundleLocation = await bundle({ entryPoint: ENTRY_POINT, webpackOverride: (c) => c });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "ShortsVideo",
    inputProps: { title, scenes: sortedScenes, fps, includeBgm, bgmUrl },
  });

  composition.durationInFrames = durationInFrames;

  const outputDir = path.dirname(outputLocation);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
    onProgress: onProgress ? ({ progress }) => onProgress(progress) : undefined,
  });

  return { outputLocation, durationInFrames, totalDurationSec, fps, sceneCount: sortedScenes.length };
}
