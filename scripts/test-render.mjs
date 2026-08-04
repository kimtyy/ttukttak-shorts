import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

async function testRender() {
  console.log("🚀 Starting real Remotion MP4 video rendering test...");

  const entryPoint = path.resolve("./src/remotion/Root.tsx");
  if (!fs.existsSync(entryPoint)) {
    console.error(`EntryPoint not found: ${entryPoint}`);
    process.exit(1);
  }

  // 1. Bundle the Remotion Video Composition
  console.log("📦 Bundling Remotion composition...");
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  console.log(`Bundle created at: ${bundleLocation}`);

  // 2. Select Composition
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "ShortsVideo",
    inputProps: {
      title: "테스트 쇼츠 동영상",
      scenes: [
        {
          id: "sc_1",
          scene_number: 1,
          role: "hook",
          duration: 5,
          narration: "테스트 쇼츠 나레이션입니다.",
          caption: "테스트 자막입니다",
          visual_description: "눈꽃 맥주 잔",
          image_prompt: "vertical 9:16 composition, frosty ice beer glass",
          required_asset: "",
          asset_source: "ai_image",
          motion: "slow_zoom_in",
          transition: "cut",
        },
      ],
    },
  });

  // 3. Render MP4 Media
  const outputLocation = path.resolve("./public/real_test_shorts.mp4");
  console.log(`🎬 Rendering MP4 to: ${outputLocation}`);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
    onProgress: ({ progress }) => {
      console.log(`Rendering progress: ${Math.round(progress * 100)}%`);
    },
  });

  console.log(`✅ MP4 rendering complete! File size: ${fs.statSync(outputLocation).size} bytes`);
}

testRender().catch((err) => {
  console.error("❌ Render error:", err);
  process.exit(1);
});
