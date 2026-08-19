"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClientForBrowser } from "@/lib/supabase/client";
import { UploadCloud, X, ImagePlus, FolderOpen } from "lucide-react";

const MIN_PHOTOS = 3;
const MAX_PHOTOS = 10;
const MAX_LONG_EDGE = 1600;
const JPEG_QUALITY = 0.85;

interface PendingPhoto {
  id: string;
  file: File;
  previewUrl: string;
}

/** 브라우저 캔버스로 긴 변 기준 리사이즈 후 JPEG Blob으로 변환한다. */
async function resizeImageToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("캔버스 컨텍스트를 생성할 수 없습니다.");
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지 변환에 실패했습니다."))),
      "image/jpeg",
      JPEG_QUALITY
    );
  });
}

export function MyAssetsForm({ scriptRemaining }: { scriptRemaining: number }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [brandName, setBrandName] = useState("");
  const [keyMessage, setKeyMessage] = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [duration, setDuration] = useState<15 | 30 | 45 | 60>(30);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleFilesSelected = (fileList: FileList | null) => {
    if (!fileList) return;
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    const next = [...photos];
    for (const file of files) {
      if (next.length >= MAX_PHOTOS) break;
      next.push({ id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`, file, previewUrl: URL.createObjectURL(file) });
    }
    setPhotos(next);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (photos.length < MIN_PHOTOS || photos.length > MAX_PHOTOS) {
      setErrorMsg(`사진은 ${MIN_PHOTOS}~${MAX_PHOTOS}장 사이로 올려주세요. (현재 ${photos.length}장)`);
      return;
    }
    if (scriptRemaining <= 0) {
      setErrorMsg("이번 달 남은 대본 생성 횟수를 모두 사용하셨습니다.");
      return;
    }

    setIsSubmitting(true);
    try {
      const supabase = createClientForBrowser();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("로그인이 필요합니다.");
      }

      // 1. 사진 리사이즈 + Storage 업로드
      const imageUrls: string[] = [];
      for (let i = 0; i < photos.length; i++) {
        setProgressLabel(`사진 업로드 중 (${i + 1}/${photos.length})...`);
        const blob = await resizeImageToJpeg(photos[i].file);
        const storagePath = `${user.id}/${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}.jpg`;

        const { error: uploadErr } = await supabase.storage
          .from("project-uploads")
          .upload(storagePath, blob, { contentType: "image/jpeg", upsert: false });

        if (uploadErr) {
          throw new Error(`사진 업로드 실패: ${uploadErr.message}`);
        }

        const { data: publicUrlData } = supabase.storage.from("project-uploads").getPublicUrl(storagePath);
        imageUrls.push(publicUrlData.publicUrl);
      }

      // 2. 사진 기반 대본 생성 요청
      setProgressLabel("사진을 분석해 대본을 만들고 있어요...");
      const idempotencyKey = `gen_assets_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          purpose: "business_promotion",
          duration,
          images: imageUrls,
          brand_name: brandName,
          key_message: keyMessage,
          call_to_action: callToAction,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || "대본 생성에 실패했습니다.");
      }

      router.push(`/projects/${data.project.id}`);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "오류가 발생했습니다.");
    } finally {
      setIsSubmitting(false);
      setProgressLabel("");
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 shadow-sm space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600">
            <FolderOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900">내 자료로 만들기</h1>
            <p className="text-slate-500 text-sm mt-1">
              매장/제품 사진 {MIN_PHOTOS}~{MAX_PHOTOS}장을 올리면 AI가 사진을 분석해 순서와 대본을 자동으로 구성합니다.
            </p>
          </div>
        </div>

        {/* Photo Upload */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-800">
            사진 업로드 ({photos.length}/{MAX_PHOTOS}장, 최소 {MIN_PHOTOS}장)
          </label>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl p-6 cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/40 transition-colors">
            <UploadCloud className="w-8 h-8 text-slate-400" />
            <span className="text-sm text-slate-500 font-medium">클릭하거나 파일을 끌어다 놓으세요</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFilesSelected(e.target.files)}
            />
          </label>

          {photos.length > 0 && (
            <div className="grid grid-cols-3 md:grid-cols-5 gap-3 pt-2">
              {photos.map((p) => (
                <div key={p.id} className="relative aspect-[9/16] rounded-lg overflow-hidden border border-slate-200 group">
                  <img src={p.previewUrl} alt="업로드 사진 미리보기" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(p.id)}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <label className="aspect-[9/16] rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-emerald-400 transition-colors">
                  <ImagePlus className="w-5 h-5 text-slate-400" />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => handleFilesSelected(e.target.files)}
                  />
                </label>
              )}
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="space-y-2">
          <label className="block text-sm font-bold text-slate-800">영상 길이</label>
          <div className="flex gap-2">
            {([15, 30, 45, 60] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={`px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${
                  duration === d
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-white border-slate-200 text-slate-600 hover:border-emerald-400"
                }`}
              >
                {d}초
              </button>
            ))}
          </div>
        </div>

        {/* Optional Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">매장명 (선택)</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="예: 정성갈비"
              className="w-full text-sm rounded-lg border border-slate-300 p-2.5"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">행동 유도 문구 (선택)</label>
            <input
              type="text"
              value={callToAction}
              onChange={(e) => setCallToAction(e.target.value)}
              placeholder="예: 지금 방문하고 할인받으세요"
              className="w-full text-sm rounded-lg border border-slate-300 p-2.5"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <label className="block text-xs font-semibold text-slate-600">강조할 점 (선택)</label>
            <textarea
              rows={2}
              value={keyMessage}
              onChange={(e) => setKeyMessage(e.target.value)}
              placeholder="예: 24시간 숙성 양념, 가족 단위 손님 환영"
              className="w-full text-sm rounded-lg border border-slate-300 p-2.5"
            />
          </div>
        </div>

        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-3">{errorMsg}</div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              {progressLabel || "처리 중..."}
            </>
          ) : (
            "사진으로 대본 만들기"
          )}
        </button>
      </form>
    </div>
  );
}
