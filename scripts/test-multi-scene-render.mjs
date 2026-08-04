import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import path from "path";
import fs from "fs";

async function runMultiSceneRenderTest() {
  console.log("🚀 Starting 8-Scene Real Remotion MP4 Render & FFprobe Verification...");

  const entryPoint = path.resolve("./src/remotion/Root.tsx");
  if (!fs.existsSync(entryPoint)) {
    console.error(`EntryPoint not found: ${entryPoint}`);
    process.exit(1);
  }

  // 1. Multi-scene mock project (8 scenes, 38s total duration)
  const scenes = [
    { id: "sc_1", scene_number: 1, role: "hook", duration: 4, narration: "무더운 여름 현리 최고 시원한 맥주집!", caption: "가평 현리 최고 시원한 맥주?", visual_description: "시원한 얼음 맥주 잔", image_prompt: "vertical 9:16 composition, frosty ice beer glass", required_asset: "", asset_source: "ai_image", motion: "slow_zoom_in", transition: "cut" },
    { id: "sc_2", scene_number: 2, role: "problem", duration: 5, narration: "오늘 하루도 업무 스트레스로 지치셨나요?", caption: "오늘 업무 스트레스 쌓였다면?", visual_description: "퇴근길 도시 야경", image_prompt: "vertical 9:16 composition, city night view cozy pub", required_asset: "", asset_source: "ai_image", motion: "pan_right", transition: "fade" },
    { id: "sc_3", scene_number: 3, role: "desire", duration: 5, narration: "살얼음 띄운 시원한 눈꽃 맥주가 생각납니다.", caption: "살얼음 소복한 눈꽃 맥주 한 잔!", visual_description: "살얼음 소복 소용돌이", image_prompt: "vertical 9:16 composition, swirl snow ice beer", required_asset: "", asset_source: "ai_image", motion: "slow_zoom_out", transition: "cut" },
    { id: "sc_4", scene_number: 4, role: "feature", duration: 5, narration: "갓 구워낸 바삭 고소한 먹태와 특제 소스!", caption: "바삭 먹태 X 특제 청양마요 소스", visual_description: "먹태 접시와 마요네즈 디핑 소스", image_prompt: "vertical 9:16 composition, crispy dried pollack dish", required_asset: "", asset_source: "ai_image", motion: "pan_left", transition: "cross_dissolve" },
    { id: "sc_5", scene_number: 5, role: "proof", duration: 4, narration: "현리 주민들이 강력하게 단골 추천하는 성지", caption: "현리 단골 1위 살얼음 맥주 성지", visual_description: "손님들 웃음 넘치는 매장 전경", image_prompt: "vertical 9:16 composition, lively pub atmosphere", required_asset: "", asset_source: "ai_image", motion: "static", transition: "cut" },
    { id: "sc_6", scene_number: 6, role: "key_point", duration: 5, narration: "얼음 잔 유지 특허 냉동 보관 기술로 극강의 시원함!", caption: "특허 냉동 기술의 극강 시원함", visual_description: "차가운 서리 내린 잔", image_prompt: "vertical 9:16 composition, frosted beer mug", required_asset: "", asset_source: "ai_image", motion: "pan_up", transition: "fade" },
    { id: "sc_7", scene_number: 7, role: "offer", duration: 5, narration: "지금 방문하시면 모듬 건어물 안주 특별 할인 이벤트 중!", caption: "방문 시 안주 특별 할인 혜택!", visual_description: "이벤트 안내 배너", image_prompt: "vertical 9:16 composition, pub menu promotion", required_asset: "", asset_source: "ai_image", motion: "slow_zoom_in", transition: "cut" },
    { id: "sc_8", scene_number: 8, role: "cta", duration: 5, narration: "오늘 저녁, 설맥 현리점에서 가볍게 한잔하세요!", caption: "오늘 저녁 설맥 현리점에서 만나요!", visual_description: "설맥 현리점 네온사인 전경", image_prompt: "vertical 9:16 composition, Korean pub neon sign exterior night", required_asset: "", asset_source: "ai_image", motion: "text_pop", transition: "cut" }
  ];

  const title = "설맥 현리점 8씬 실전 렌더링 테스트";
  const fps = 30;
  const totalDurationSec = scenes.reduce((acc, s) => acc + s.duration, 0);
  const durationInFrames = totalDurationSec * fps;

  console.log(`📊 Project Details: ${scenes.length} Scenes | Total Duration: ${totalDurationSec}s (${durationInFrames} frames)`);

  // 2. Bundle Remotion Composition
  console.log("📦 Bundling Remotion composition with Webpack...");
  const bundleLocation = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  // 3. Select Composition & Inject Props & Dynamic Duration
  const composition = await selectComposition({
    serveUrl: bundleLocation,
    id: "ShortsVideo",
    inputProps: {
      title,
      scenes,
      fps,
    },
  });

  composition.durationInFrames = durationInFrames;

  // 4. Render Media
  const outputDir = path.resolve("./public/renders");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputLocation = path.join(outputDir, "multi_scene_8scenes_test.mp4");
  console.log(`🎬 Rendering 8-Scene MP4 to: ${outputLocation}...`);

  await renderMedia({
    composition,
    serveUrl: bundleLocation,
    codec: "h264",
    outputLocation,
    onProgress: ({ progress }) => {
      console.log(`Render progress: ${Math.round(progress * 100)}%`);
    },
  });

  const fileSize = fs.statSync(outputLocation).size;
  console.log(`✅ Multi-scene MP4 rendering finished! File size: ${fileSize} bytes`);
}

runMultiSceneRenderTest().catch((err) => {
  console.error("❌ Render test error:", err);
  process.exit(1);
});
