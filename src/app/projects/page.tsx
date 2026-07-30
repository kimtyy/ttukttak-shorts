"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Video, PlusCircle, Trash2, Edit3, Copy } from "lucide-react";

export interface ProjectItem {
  id: string;
  title: string;
  topic: string;
  purpose: string;
  duration: number;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error);
      }
      setProjects(data.projects || []);
    } catch (err: unknown) {
      const error = err as Error;
      setErrorMsg(error.message || "프로젝트 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const res = await fetch("/api/projects");
        const data = await res.json();
        if (!ignore) {
          if (!res.ok) {
            setErrorMsg(data.message || data.error);
          } else {
            setProjects(data.projects || []);
          }
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          const error = err as Error;
          setErrorMsg(error.message || "프로젝트 목록을 불러오지 못했습니다.");
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("정말 이 프로젝트를 삭제하시겠습니까?")) return;
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
      } else {
        alert("삭제 실패");
      }
    } catch {
      alert("삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}/duplicate`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        fetchProjects();
      } else {
        alert(data.message || "복제 실패");
      }
    } catch {
      alert("복제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-slate-900">내 프로젝트 목록</h1>
          <p className="text-slate-500 text-sm mt-1">생성된 쇼츠 대본과 장면 기획안을 관리합니다.</p>
        </div>
        <Link
          href="/create"
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-sm transition-all flex items-center gap-2 text-sm"
        >
          <PlusCircle className="w-4 h-4" /> 새 프로젝트 만들기
        </Link>
      </div>

      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">로딩 중...</div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border-2 border-dashed border-slate-200 p-12 text-center space-y-3">
          <Video className="w-12 h-12 text-slate-300 mx-auto" />
          <p className="text-slate-600 font-bold text-base">아직 생성된 프로젝트가 없습니다.</p>
          <p className="text-slate-400 text-xs">새 쇼츠 대본을 기획하고 저장해보세요!</p>
          <div className="pt-2">
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-5 py-2.5 rounded-xl text-xs shadow-sm transition-all"
            >
              <PlusCircle className="w-4 h-4" /> 첫 쇼츠 만들기
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="bg-blue-50 text-blue-700 font-extrabold text-[11px] px-2.5 py-0.5 rounded-md">
                    {p.duration}초
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {new Date(p.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                <h2 className="font-bold text-slate-900 text-base line-clamp-1">{p.title}</h2>
                <p className="text-slate-500 text-xs line-clamp-2">{p.topic || "주제 설명 없음"}</p>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <Link
                  href={`/projects/${p.id}`}
                  className="bg-slate-900 hover:bg-blue-600 text-white font-bold px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> 편집기 열기
                </Link>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleDuplicate(p.id)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                    title="프로젝트 복제"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="프로젝트 삭제"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
