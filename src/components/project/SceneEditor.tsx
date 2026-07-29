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
import { GripVertical, Plus, Trash2, CheckCircle, AlertTriangle, Copy } from "lucide-react";
import { useRouter } from "next/navigation";

function SortableSceneCard({
  scene,
  index,
  onUpdate,
  onDelete,
}: {
  scene: ShortsScene;
  index: number;
  onUpdate: (id: string, field: keyof ShortsScene, value: unknown) => void;
  onDelete: (id: string) => void;
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

  const targetDuration = projectHeader.duration || 30;
  const currentTotalDuration = scenes.reduce((acc, s) => acc + (s.duration || 0), 0);
  const isDurationMatched = currentTotalDuration === targetDuration;

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

        setVersion(data.version);
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    []
  );

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    setSaveState("saving");
    const handler = setTimeout(() => {
      performSave(scenes, projectHeader, version);
    }, 1000);

    return () => clearTimeout(handler);
  }, [scenes, projectHeader, version, performSave]);

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
      {/* Top Controls Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={projectHeader.title}
              onChange={(e) => setProjectHeader({ ...projectHeader, title: e.target.value })}
              className="text-2xl font-black text-slate-900 border-b border-transparent hover:border-slate-300 focus:border-blue-600 focus:outline-none"
            />
            <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2.5 py-1 rounded-md">
              {targetDuration}초 프로젝트
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">버전: {version}</p>
        </div>

        <div className="flex items-center gap-3">
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

          <button
            type="button"
            onClick={handleDuplicate}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-3 py-2 rounded-xl flex items-center gap-1 transition-colors"
          >
            <Copy className="w-4 h-4" /> 프로젝트 복제
          </button>
        </div>
      </div>

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
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
