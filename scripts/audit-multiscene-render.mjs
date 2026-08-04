import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

// Audit script: simulates a REAL project shape (8 scenes, varying durations,
// narration audio) to check whether the Remotion composition actually
// sequences scenes / audio, since it is NOT wired into the production
// render-worker API route at all (that route never calls Remotion).

async function testRender() {
  const scenes = Array.from({ length: 8 }).map((_, i) => ({
    id: `sc_${i + 1}`,
    scene_number: i + 1,
    role: i === 0 ? "hook" : i === 7 ? "cta" : "body",
    duration: [3, 4, 5, 4, 3, 6, 4, 3][i], // total = 32s, varies per scene like a real script
    narration: `씬 ${i + 1} 나레이션 텍스트입니다.`,
    caption: `씬 ${i + 1} 자막`,
    visual_description: `테스트 비주얼 ${i + 1}`,
    image_prompt: "",
    required_asset: "",
    asset_source: "ai_image",
    motion: "slow_zoom_in",
    transition: "cut",
    image_url: `https://picsum.photos/seed/${i + 1}/1080/1920`,
    audio_url: null,
  }));

  const totalDurationSec = scenes.reduce((sum, s) => sum + s.duration, 0);
  console.log(`Constructed ${scenes.length} scenes, expected total duration: ${totalDurationSec}s`);

  const entryPoint = path.resolve("./src/remotion/Root.tsx");
  const bundleLocation = await bundle({ entryPoint, webpackOverride: (c) => c });

  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "ShortsVideo",
    inputProps: { title: "멀티씬 검수 테스트", scenes },
  });

  console.log(`Composition durationInFrames (from Root.tsx, NOT derived from scenes): ${composition.durationInFrames}`);
  console.log(`Composition fps: ${composition.fps} -> hardcoded composition length = ${(composition.durationInFrames / composition.fps).toFixed(2)}s`);
  console.log(`Expected (sum of scene.duration): ${totalDurationSec}s`);

  const outputLocation = path.resolve("./public/audit_multiscene.mp4");
  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
    onProgress: ({ progress }) => console.log(`Rendering: ${Math.round(progress * 100)}%`),
  });

  console.log(`Done. File size: ${fs.statSync(outputLocation).size} bytes`);
}

testRender().catch((err) => {
  console.error("Render error:", err);
  process.exit(1);
});
