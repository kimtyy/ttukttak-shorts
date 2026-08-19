"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ShortsScene } from "@/types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2, CheckCircle, AlertTriangle, Copy, Sparkles, Play, Image as ImageIcon, Volume2, Film, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import { ShortsPlayerModal } from "@/components/video/ShortsPlayerModal";

function SortableSceneCard({
  scene,
  index,
  onUpdate,
  onDelete,
  onGenerateSingleMedia,
}: {
  scene: ShortsScene;
  index: number;
  onUpdate: (id: string, field: keyof ShortsScene, value: unknown) => void;
  onDelete: (id: string) => void;
  onGenerateSingleMedia: (sceneId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: scene.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-4 hover:border-slate-300 transition-all"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="cursor-grab text-slate-400 hover:text-slate-600 p-1"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <span className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-md">
            장면 {index + 1}
          </span>
          <select
            value={scene.role}
            onChange={(e) => onUpdate(scene.id, "role", e.target.value)}
            className="text-xs font-bold text-slate-700 bg-slate-100 border-none rounded-lg px-2.5 py-1"
          >
            <option value="hook">후킹 (Hook)</option>
            <option value="problem">문제 제기</option>
            <option value="desire">욕구 자극</option>
            <option value="introduction">소개</option>
            <option value="feature">주요 기능/특징</option>
            <option value="proof">증거/후기</option>
            <option value="development">전개</option>
            <option value="key_point">핵심 포인트</option>
            <option value="offer">혜택/제안</option>
            <option value="conclusion">결론</option>
            <option value="cta">행동 유도 (CTA)</option>
          </select>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
            <span className="text-xs text-slate-500 font-medium">시간:</span>
            <input
              type="number"
              min={1}
              max={60}
              value={scene.duration}
              onChange={(e) => onUpdate(scene.id, "duration", parseInt(e.target.value) || 1)}
              className="w-10 text-xs font-extrabold text-slate-900 text-center bg-transparent focus:outline-none"
            />
            <span className="text-xs text-slate-500">초</span>
          </div>

          <button
            type="button"
            onClick={() => onDelete(scene.id)}
            className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content Grid: Texts & 9:16 Visual Preview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Left 2 Cols: Narration & Subtitle */}
        <div className="md:col-span-2 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">내레이션 (목소리 대본)</label>
              <textarea
                rows={3}
                value={scene.narration}
                onChange={(e) => onUpdate(scene.id, "narration", e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 text-slate-800 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">화면 자막 (핵심 압축)</label>
              <textarea
                rows={3}
                value={scene.caption}
                onChange={(e) => onUpdate(scene.id, "caption", e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 p-2.5 text-slate-800 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {scene.asset_source !== "user_upload" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">화면 연출 설명</label>
                <input
                  type="text"
                  value={scene.visual_description}
                  onChange={(e) => onUpdate(scene.id, "visual_description", e.target.value)}
                  className="w-full text-xs rounded border border-slate-300 p-2"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">이미지 생성 프롬프트 (영어)</label>
                <input
                  type="text"
                  value={scene.image_prompt}
                  onChange={(e) => onUpdate(scene.id, "image_prompt", e.target.value)}
                  className="w-full text-xs rounded border border-slate-300 p-2 font-mono text-slate-700"
                />
              </div>
            </div>
          )}
        </div>

        {/* Right Col: 9:16 Imagen Media Preview Card */}
        <div className="flex flex-col items-center justify-center p-3 bg-slate-900 rounded-xl border border-slate-800 text-white relative overflow-hidden group">
          {scene.image_url ? (
            <div className="relative w-full aspect-[9/16] rounded-lg overflow-hidden border border-slate-700">
              <img
                src={scene.image_url}
                alt={`Scene ${index + 1} Visual`}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded text-white flex items-center gap-1 backdrop-blur-sm ${
                  scene.asset_source === "user_upload" ? "bg-emerald-600/90" : "bg-purple-600/90"
                }`}
              >
                {scene.asset_source === "user_upload" ? (
                  "내 사진"
                ) : (
                  <>
                    <Sparkles className="w-3 h-3" /> Imagen 3
                  </>
                )}
              </div>
              {scene.audio_url && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-emerald-400 text-[10px] font-bold p-1 rounded-full backdrop-blur-sm">
                  <Volume2 className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          ) : scene.asset_source === "user_upload" ? (
            <div className="w-full aspect-[9/16] rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-3 text-center bg-slate-950/50">
              <ImageIcon className="w-8 h-8 text-slate-600 mb-2" />
              <span className="text-xs text-slate-400 font-medium">연결된 사진이 없습니다</span>
            </div>
          ) : (
            <div className="w-full aspect-[9/16] rounded-lg border-2 border-dashed border-slate-700 flex flex-col items-center justify-center p-3 text-center bg-slate-950/50">
              <ImageIcon className="w-8 h-8 text-slate-600 mb-2" />
              <span className="text-xs text-slate-400 font-medium">9:16 비주얼 미생성</span>
              <button
                type="button"
                onClick={() => onGenerateSingleMedia(scene.id)}
                className="mt-3 text-[11px] font-bold px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-1 transition-all"
              >
                <Sparkles className="w-3 h-3" /> 이미지 생성
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export interface ProjectHeaderData {
  id: string;
  title: string;
  duration: number;
  hook?: string;
  thumbnail_text?: string;
  description?: string;
  hashtags?: string[];
  total_narration?: string;
  content_strategy?: string;
  version: number;
  narration_mode?: "ai_voice" | "music_only";
  bgm_track_id?: string | null;
}

interface BgmTrack {
  id: string;
  title: string;
  storage_path: string;
  duration_seconds: number | null;
}

export function SceneEditor({
  project: initialProject,
  scenes: initialScenes,
}: {
  project: ProjectHeaderData;
  scenes: ShortsScene[];
}) {
  const router = useRouter();
  const [projectHeader, setProjectHeader] = useState<ProjectHeaderData>(initialProject);
  const [scenes, setScenes] = useState<ShortsScene[]>(
    initialScenes.map((s, idx) => ({ ...s, id: s.id || `sc_${idx + 1}` }))
  );
  const [version, setVersion] = useState<number>(initialProject.version || 1);

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "conflict">("saved");
  const [isGeneratingMedia, setIsGeneratingMedia] = useState(false);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [bgmTracks, setBgmTracks] = useState<BgmTrack[]>([]);

  useEffect(() => {
    fetch("/api/bgm-tracks")
      .then((res) => res.json())
      .then((data) => setBgmTracks(data.tracks || []))
      .catch(() => {});
  }, []);

  // Render Pipeline States
  const [renderStatus, setRenderStatus] = useState<"idle" | "queued" | "processing" | "completed" | "failed">("idle");
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderedVideoUrl, setRenderedVideoUrl] = useState<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);

  const targetDuration = projectHeader.duration || 30;
  const currentTotalDuration = scenes.reduce((acc, s) => acc + (s.duration || 0), 0);
  const isDurationMatched = currentTotalDuration === targetDuration;

  // "내 자료로 만들기"로 만든 프로젝트: 모든 씬이 사용자가 올린 사진을 쓴다 -
  // 비주얼 생성은 불필요/위험(사진을 AI 이미지로 덮어쓸 수 있음)하므로 UI를 다르게 보여준다.
  const isUserUploadProject = scenes.length > 0 && scenes.every((s) => s.asset_source === "user_upload");
  const isMusicOnly = projectHeader.narration_mode === "music_only";

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const performSave = useCallback(
    async (latestScenes: ShortsScene[], latestHeader: ProjectHeaderData, currentVersion: number) => {
      setSaveState("saving");
      try {
        const res = await fetch(`/api/projects/${latestHeader.id}/scenes`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            version: currentVersion,
            title: latestHeader.title,
            hook: latestHeader.hook,
            thumbnail_text: latestHeader.thumbnail_text,
            description: latestHeader.description,
            hashtags: latestHeader.hashtags,
            total_narration: latestHeader.total_narration,
            content_strategy: latestHeader.content_strategy,
            narration_mode: latestHeader.narration_mode,
            bgm_track_id: latestHeader.bgm_track_id,
            scenes: latestScenes.map((s, idx) => ({
              ...s,
              scene_number: idx + 1,
            })),
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          if (data.error === "SAVE_CONFLICT") {
            setSaveState("conflict");
            return;
          }
          throw new Error(data.message || data.error);
        }

        if (data.version) {
          setVersion(data.version);
        }
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    []
  );

  // Debounced auto-save. `version` is tracked via a ref rather than a dependency:
  // it only changes as a *result* of a save (or a conflict), never as a user edit,
  // so it must not itself re-trigger the debounce timer (that caused one redundant
  // save request to fire right after every successful save).
  const versionRef = useRef(version);
  useEffect(() => {
    versionRef.current = version;
  }, [version]);

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      performSave(scenes, projectHeader, versionRef.current);
    }, 1500);
    return () => clearTimeout(timer);
  }, [scenes, projectHeader, performSave]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setScenes((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const reordered = arrayMove(items, oldIndex, newIndex);
        return reordered.map((s, idx) => ({ ...s, scene_number: idx + 1 }));
      });
    }
  };

  const handleUpdateScene = (id: string, field: keyof ShortsScene, value: unknown) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleDeleteScene = (id: string) => {
    if (scenes.length <= 1) {
      alert("최소 1개 이상의 장면이 존재해야 합니다.");
      return;
    }
    setScenes((prev) =>
      prev.filter((s) => s.id !== id).map((s, idx) => ({ ...s, scene_number: idx + 1 }))
    );
  };

  const handleAddScene = () => {
    const newScene: ShortsScene = {
      id: `sc_${Date.now()}`,
      scene_number: scenes.length + 1,
      role: "feature",
      duration: 5,
      narration: "새로운 장면 내레이션",
      caption: "새로운 장면 자막",
      visual_description: "새 장면 연출 설명",
      image_prompt: "vertical 9:16 composition, high quality, no text",
      required_asset: "",
      asset_source: "text_motion",
      motion: "static",
      transition: "cut",
    };
    setScenes((prev) => [...prev, newScene]);
  };

  // Generate Google Imagen 3 Images & Audio for Project
  const handleGenerateMedia = async (sceneId?: string) => {
    setIsGeneratingMedia(true);
    try {
      const res = await fetch(`/api/projects/${projectHeader.id}/generate-media`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "미디어 생성 중 오류가 발생했습니다.");
      }

      if (data.scenes && Array.isArray(data.scenes)) {
        setScenes((prev) =>
          prev.map((s) => {
            const updated = data.scenes.find((sc: ShortsScene) => sc.id === s.id);
            return updated ? { ...s, ...updated } : s;
          })
        );
      }
    } catch (err: unknown) {
      const error = err as Error;
      alert(`AI 미디어 생성 오류: ${error.message}`);
    } finally {
      setIsGeneratingMedia(false);
    }
  };

  // Remotion MP4 Server Video Render Trigger with Idempotency & Async Polling
  const handleRenderVideo = async () => {
    const idempotencyKey = `render_job_${Date.now()}_${projectHeader.id}`;
    setRenderStatus("queued");
    setRenderProgress(0);

    try {
      const res = await fetch(`/api/projects/${projectHeader.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "동영상 렌더링 요청 중 오류가 발생했습니다.");
      }

      setRenderStatus("processing");
      // `data.progress` is genuinely 0 right after queuing (falsy but valid) -
      // `||` would treat that as "missing" and show a fake 10% for a moment.
      setRenderProgress(data.progress ?? 10);

      // Start Polling for Status & Progress
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`/api/projects/${projectHeader.id}/render-status`);
          const statusData = await statusRes.json();

          if (statusRes.ok && statusData) {
            setRenderProgress(statusData.progress || 0);
            setRenderStatus(statusData.status);

            if (statusData.status === "completed") {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              setRenderedVideoUrl(statusData.videoUrl);
            } else if (statusData.status === "failed") {
              if (pollTimerRef.current) clearInterval(pollTimerRef.current);
              alert(`동영상 렌더링 실패: ${statusData.errorMessage || "알 수 없는 오류"}`);
            }
          }
        } catch {
          // Silent polling retry
        }
      }, 1200);
    } catch (err: unknown) {
      const error = err as Error;
      setRenderStatus("failed");
      alert(`동영상 렌더링 시작 오류: ${error.message}`);
    }
  };

  const handleDuplicate = async () => {
    try {
      const res = await fetch(`/api/projects/${projectHeader.id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        router.push(`/projects/${data.duplicatedProjectId}`);
      }
    } catch {
      alert("복제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      {/* Video Player Modal */}
      <ShortsPlayerModal
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        title={projectHeader.title}
        scenes={scenes}
      />

      {/* Top Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="w-full md:w-auto">
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={projectHeader.title}
              onChange={(e) => setProjectHeader({ ...projectHeader, title: e.target.value })}
              className="text-2xl font-black text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none w-full sm:w-auto min-w-0"
            />
            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-md">
              {targetDuration}초 프로젝트
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">버전: {version}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border">
            {saveState === "saving" && (
              <span className="text-amber-600 flex items-center gap-1">
                <div className="w-3 h-3 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                저장 중...
              </span>
            )}
            {saveState === "saved" && (
              <span className="text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> 저장됨
              </span>
            )}
            {saveState === "error" && (
              <span className="text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" /> 저장 실패
              </span>
            )}
            {saveState === "conflict" && (
              <span className="text-red-600 font-bold">충돌 발생 (새로고침 필요)</span>
            )}
          </div>

          {/* AI Media Generation Button */}
          {isUserUploadProject && isMusicOnly ? (
            <div className="text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2.5 rounded-xl">
              내 사진 + 배경음악만 사용됩니다 — 추가 생성이 필요 없어요
            </div>
          ) : (
            <button
              type="button"
              onClick={() => handleGenerateMedia()}
              disabled={isGeneratingMedia}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              {isGeneratingMedia ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {isUserUploadProject ? "나레이션 생성 중..." : "Imagen 3 미디어 생성 중..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {isUserUploadProject ? "🎙 AI 나레이션 생성" : "✨ AI 비주얼 & 음성 생성"}
                </>
              )}
            </button>
          )}

          {/* Remotion MP4 Server Render Button */}
          <button
            type="button"
            onClick={handleRenderVideo}
            disabled={renderStatus === "queued" || renderStatus === "processing"}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          >
            {renderStatus === "processing" || renderStatus === "queued" ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                MP4 렌더링 중 ({renderProgress}%)
              </>
            ) : (
              <>
                <Film className="w-4 h-4" />
                🎬 MP4 동영상 완성하기
              </>
            )}
          </button>

          {/* Player Modal Button */}
          <button
            type="button"
            onClick={() => setIsPlayerOpen(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-md transition-all hover:scale-105 active:scale-95"
          >
            <Play className="w-4 h-4 text-purple-400 fill-purple-400" />
            쇼츠 미리보기
          </button>

          <button
            type="button"
            onClick={handleDuplicate}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2.5 rounded-xl flex items-center gap-1 transition-colors"
          >
            <Copy className="w-4 h-4" /> 복제
          </button>
        </div>
      </div>

      {/* Render Progress Bar Banner */}
      {(renderStatus === "queued" || renderStatus === "processing" || renderStatus === "completed") && (
        <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="w-5 h-5 text-emerald-400 animate-pulse" />
              <span className="text-sm font-bold">
                {renderStatus === "completed"
                  ? "🎉 MP4 쇼츠 동영상 완성!"
                  : `Remotion + FFmpeg 서버 비동기 렌더링 진행 중 (${renderProgress}%)`}
              </span>
            </div>
            {renderedVideoUrl && (
              <a
                href={renderedVideoUrl}
                download={`${projectHeader.title}_shorts.mp4`}
                target="_blank"
                rel="noreferrer"
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-md transition-all"
              >
                <Download className="w-4 h-4" /> MP4 완성본 다운로드
              </a>
            )}
          </div>
          <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500 ease-out"
              style={{ width: `${renderProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Duration Validation Warning */}
      {!isDurationMatched && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-amber-800 text-xs font-medium">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>
              장면 시간 합계(<strong>{currentTotalDuration}초</strong>)가 목표 영상 길이(
              <strong>{targetDuration}초</strong>)와 일치하지 않습니다. 각 장면의 시간을 조절해 주세요.
            </span>
          </div>
        </div>
      )}

      {/* Header Info Overview */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">콘텐츠 요약 및 후킹</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">첫 3초 후킹 문구</label>
            <input
              type="text"
              value={projectHeader.hook || ""}
              onChange={(e) => setProjectHeader({ ...projectHeader, hook: e.target.value })}
              className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800 font-bold"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-600">대표 썸네일 문구</label>
            <input
              type="text"
              value={projectHeader.thumbnail_text || ""}
              onChange={(e) => setProjectHeader({ ...projectHeader, thumbnail_text: e.target.value })}
              className="w-full text-xs rounded border border-slate-300 p-2 text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Narration Mode Selection */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <h3 className="text-sm font-bold text-slate-800">나레이션 방식</h3>
        <div className="flex flex-col md:flex-row gap-3">
          <label
            className={`flex-1 flex items-center gap-2 border rounded-xl p-3 cursor-pointer transition-colors ${
              (projectHeader.narration_mode || "ai_voice") === "ai_voice"
                ? "border-blue-500 bg-blue-50"
                : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="narration_mode"
              checked={(projectHeader.narration_mode || "ai_voice") === "ai_voice"}
              onChange={() => setProjectHeader({ ...projectHeader, narration_mode: "ai_voice" })}
            />
            <span className="text-xs font-semibold text-slate-700">AI 음성 나레이션</span>
          </label>
          <label
            className={`flex-1 flex items-center gap-2 border rounded-xl p-3 cursor-pointer transition-colors ${
              projectHeader.narration_mode === "music_only" ? "border-blue-500 bg-blue-50" : "border-slate-200"
            }`}
          >
            <input
              type="radio"
              name="narration_mode"
              checked={projectHeader.narration_mode === "music_only"}
              onChange={() => setProjectHeader({ ...projectHeader, narration_mode: "music_only" })}
            />
            <span className="text-xs font-semibold text-slate-700">배경음악만 사용 (나레이션 없음)</span>
          </label>
        </div>

        {projectHeader.narration_mode === "music_only" && (
          <div className="space-y-1 pt-1">
            <label className="block text-[11px] font-semibold text-slate-600">배경음악 선택</label>
            <select
              value={projectHeader.bgm_track_id || ""}
              onChange={(e) => setProjectHeader({ ...projectHeader, bgm_track_id: e.target.value || null })}
              className="w-full text-xs rounded-lg border border-slate-300 p-2"
            >
              <option value="">배경음악을 선택하세요</option>
              {bgmTracks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
            {bgmTracks.length === 0 && (
              <p className="text-[11px] text-amber-600">등록된 배경음악이 없습니다. 관리자에게 문의하세요.</p>
            )}
          </div>
        )}
      </div>

      {/* Scenes List with DND */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-base font-bold text-slate-900">장면 구성 및 편집 ({scenes.length}개 장면)</h3>
          <button
            type="button"
            onClick={handleAddScene}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" /> 장면 추가
          </button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={scenes.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {scenes.map((scene, index) => (
                <SortableSceneCard
                  key={scene.id}
                  scene={scene}
                  index={index}
                  onUpdate={handleUpdateScene}
                  onDelete={handleDeleteScene}
                  onGenerateSingleMedia={(sceneId) => handleGenerateMedia(sceneId)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
