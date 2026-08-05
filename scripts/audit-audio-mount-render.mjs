import fs from "fs";
import path from "path";
import { renderProject } from "./lib/render-project.mjs";

// Verifies step 5 of the render-worker rewrite: does a `data:audio/mp3;base64,...`
// audio_url (the actual format tts.ts returns on OpenAI success) actually get
// mounted and audible in the rendered MP4? Scene 2 has no audio_url and scene 3
// uses the excluded "speech://" marker, to confirm both are correctly silent
// while scene 1 (data: URL) is not.

const toneBase64 = fs.readFileSync(path.resolve("./scratch_audio/tone_b64.txt"), "utf-8");

const scenes = [
  {
    id: "sc_1",
    scene_number: 1,
    duration: 4,
    narration: "오디오 마운트 검증 씬 1",
    caption: "씬 1: data:audio 오디오 있음",
    visual_description: "",
    audio_url: `data:audio/mp3;base64,${toneBase64}`,
  },
  {
    id: "sc_2",
    scene_number: 2,
    duration: 3,
    narration: "오디오 마운트 검증 씬 2",
    caption: "씬 2: audio_url 없음",
    visual_description: "",
    audio_url: null,
  },
  {
    id: "sc_3",
    scene_number: 3,
    duration: 3,
    narration: "오디오 마운트 검증 씬 3",
    caption: "씬 3: speech:// 폴백 (재생 불가 마커, 의도적으로 무시됨)",
    visual_description: "",
    audio_url: `speech://${encodeURIComponent("이것은 브라우저 전용 마커입니다")}`,
  },
];

const outputLocation = path.resolve("./scratch_audio/audit_audio_mount.mp4");

const result = await renderProject({
  title: "오디오 마운트 검증",
  scenes,
  outputLocation,
  onProgress: (p) => console.log(`Rendering: ${Math.round(p * 100)}%`),
});

console.log(`Done. duration=${result.totalDurationSec}s scenes=${result.sceneCount} -> ${outputLocation}`);
