import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

/**
 * bgm_tracks 시딩 스크립트.
 *
 * 사용자가 로열티프리 mp3 파일을 로컬 폴더에 넣어두면, 이 스크립트가
 * `bgm-tracks` Supabase Storage 버킷에 업로드하고 public.bgm_tracks 테이블에
 * 행을 등록한다. narration_mode='music_only' 렌더링에서 선택 가능한 배경음악
 * 목록으로 즉시 노출된다.
 *
 * 사용법:
 *   node scripts/seed-bgm-tracks.mjs <mp3가_들어있는_폴더>
 *
 * 필요 환경변수 (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const sourceDir = process.argv[2];

if (!sourceDir) {
  console.error("사용법: node scripts/seed-bgm-tracks.mjs <mp3가_들어있는_폴더>");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !serviceRoleKey) {
  console.error("NEXT_PUBLIC_SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다 (.env.local 확인).");
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function toTitle(filename) {
  return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ").trim();
}

async function main() {
  const resolvedDir = path.resolve(sourceDir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`폴더를 찾을 수 없습니다: ${resolvedDir}`);
  }

  const files = fs
    .readdirSync(resolvedDir)
    .filter((f) => f.toLowerCase().endsWith(".mp3"));

  if (files.length === 0) {
    throw new Error(`${resolvedDir}에 mp3 파일이 없습니다.`);
  }

  console.log(`${files.length}개 mp3 파일을 발견했습니다. 업로드를 시작합니다...`);

  for (const file of files) {
    const filePath = path.join(resolvedDir, file);
    const fileBuffer = fs.readFileSync(filePath);
    const storagePath = `${Date.now()}-${file}`;

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("bgm-tracks")
      .upload(storagePath, fileBuffer, { contentType: "audio/mpeg", upsert: false });

    if (uploadErr) {
      console.error(`[SKIP] ${file} 업로드 실패: ${uploadErr.message}`);
      continue;
    }

    const { error: insertErr } = await supabaseAdmin.from("bgm_tracks").insert({
      title: toTitle(file),
      storage_path: storagePath,
      is_active: true,
    });

    if (insertErr) {
      console.error(`[SKIP] ${file} DB 등록 실패: ${insertErr.message}`);
      continue;
    }

    console.log(`[OK] ${file} -> bgm_tracks 등록 완료 (storage_path=${storagePath})`);
  }

  console.log("완료.");
}

main().catch((err) => {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
});
