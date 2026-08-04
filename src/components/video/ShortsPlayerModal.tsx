"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { ShortsScene, SceneMotion } from "@/types";
import { Play, Pause, SkipBack, SkipForward, X, Sparkles, Volume2, VolumeX, Download } from "lucide-react";

interface ShortsPlayerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  scenes: ShortsScene[];
}

export function ShortsPlayerModal({ isOpen, onClose, title, scenes }: ShortsPlayerModalProps) {
  const [currentSceneIdx, setCurrentSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0); // 0 to 100% within current scene
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const currentScene = scenes[currentSceneIdx] || null;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleClose = () => {
    setIsPlaying(false);
    clearTimer();
    onClose();
  };

  // Playback timer & scene auto-advance logic
  useEffect(() => {
    if (!isPlaying || !currentScene || !isOpen) {
      clearTimer();
      return;
    }

    const durationSec = currentScene.duration || 5;
    const intervalMs = 100; // update progress every 100ms
    const stepIncrement = (intervalMs / (durationSec * 1000)) * 100;

    // Handle Audio Playback if available
    if (currentScene.audio_url && currentScene.audio_url.startsWith("data:audio")) {
      if (audioRef.current) {
        audioRef.current.src = currentScene.audio_url;
        audioRef.current.muted = isMuted;
        audioRef.current.play().catch(() => {});
      }
    } else if (currentScene.audio_url && currentScene.audio_url.startsWith("speech://")) {
      // Browser Web Speech API fallback
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const text = decodeURIComponent(currentScene.audio_url.replace("speech://", ""));
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ko-KR";
        utterance.rate = 1.0;
        if (!isMuted) window.speechSynthesis.speak(utterance);
      }
    }

    clearTimer();
    timerRef.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          // Advance to next scene or finish
          if (currentSceneIdx < scenes.length - 1) {
            setCurrentSceneIdx((idx) => idx + 1);
            return 0;
          } else {
            setIsPlaying(false);
            return 100;
          }
        }
        return prev + stepIncrement;
      });
    }, intervalMs);

    return () => clearTimer();
  }, [currentSceneIdx, isPlaying, isOpen, currentScene, isMuted, scenes.length, clearTimer]);

  if (!isOpen || scenes.length === 0) return null;

  const handleNext = () => {
    if (currentSceneIdx < scenes.length - 1) {
      setCurrentSceneIdx((prev) => prev + 1);
      setProgress(0);
    }
  };

  const handlePrev = () => {
    if (currentSceneIdx > 0) {
      setCurrentSceneIdx((prev) => prev - 1);
      setProgress(0);
    }
  };

  const togglePlay = () => {
    setIsPlaying((prev) => !prev);
  };

  // Helper for Ken Burns CSS motion animation class
  const getMotionStyle = (motion: SceneMotion) => {
    switch (motion) {
      case "slow_zoom_in":
        return "scale-125 transition-transform duration-[10000ms] ease-out";
      case "slow_zoom_out":
        return "scale-100 transition-transform duration-[10000ms] ease-out";
      case "pan_left":
        return "-translate-x-6 scale-110 transition-transform duration-[10000ms] ease-out";
      case "pan_right":
        return "translate-x-6 scale-110 transition-transform duration-[10000ms] ease-out";
      case "pan_up":
        return "-translate-y-6 scale-110 transition-transform duration-[10000ms] ease-out";
      case "pan_down":
        return "translate-y-6 scale-110 transition-transform duration-[10000ms] ease-out";
      default:
        return "scale-105 transition-transform duration-[5000ms] ease-in-out";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <audio ref={audioRef} className="hidden" />

      {/* Modal Container */}
      <div className="relative w-full max-w-sm flex flex-col items-center">
        {/* Header Bar */}
        <div className="w-full flex items-center justify-between text-white mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-white">
              AI Imagen 9:16
            </span>
            <h3 className="text-sm font-semibold truncate max-w-[180px]">{title}</h3>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 9:16 Phone Frame */}
        <div className="relative w-full aspect-[9/16] rounded-3xl overflow-hidden bg-gray-900 border-4 border-gray-800 shadow-2xl flex flex-col justify-between select-none">
          {/* Top Progress Bars (Instagram Stories / Shorts style) */}
          <div className="absolute top-0 left-0 right-0 z-30 flex gap-1 p-2 bg-gradient-to-b from-black/70 to-transparent">
            {scenes.map((s, idx) => (
              <div key={s.id || idx} className="h-1 flex-1 bg-white/30 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white transition-all duration-100 ease-linear"
                  style={{
                    width:
                      idx < currentSceneIdx
                        ? "100%"
                        : idx === currentSceneIdx
                        ? `${progress}%`
                        : "0%",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Background Image / Motion Layer */}
          <div className="absolute inset-0 z-0 overflow-hidden bg-gray-950">
            {currentScene?.image_url ? (
              <img
                key={currentScene.id + "_" + currentSceneIdx}
                src={currentScene.image_url}
                alt={currentScene.visual_description || "Scene Visual"}
                className={`w-full h-full object-cover ${getMotionStyle(currentScene.motion)}`}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 text-white/70">
                <Sparkles className="w-12 h-12 text-purple-400 mb-3 animate-pulse" />
                <p className="text-xs text-purple-300 font-medium">Google Imagen 3 이미지 준비 중</p>
                <p className="text-[11px] text-white/40 mt-1 max-w-[200px]">
                  {currentScene?.image_prompt || currentScene?.visual_description}
                </p>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />
          </div>

          {/* Center Overlay Controls (Hover/Tap) */}
          <div className="relative z-20 flex-1 flex items-center justify-between px-3">
            <button
              onClick={handlePrev}
              disabled={currentSceneIdx === 0}
              className="p-2 rounded-full bg-black/30 hover:bg-black/60 text-white/80 hover:text-white disabled:opacity-20 transition-all"
            >
              <SkipBack className="w-5 h-5" />
            </button>

            <button
              onClick={togglePlay}
              className="p-4 rounded-full bg-purple-600/80 hover:bg-purple-600 text-white shadow-lg hover:scale-105 active:scale-95 transition-all"
            >
              {isPlaying ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-0.5" />}
            </button>

            <button
              onClick={handleNext}
              disabled={currentSceneIdx === scenes.length - 1}
              className="p-2 rounded-full bg-black/30 hover:bg-black/60 text-white/80 hover:text-white disabled:opacity-20 transition-all"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          {/* Subtitle & Narration Overlay Layer */}
          <div className="relative z-20 p-5 pb-6 text-center space-y-2 pointer-events-none">
            {/* Scene Role & Badge */}
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-purple-300">
              <span>Scene {currentSceneIdx + 1}/{scenes.length}</span>
              <span>•</span>
              <span className="uppercase text-amber-300 font-bold">{currentScene?.role || "Scene"}</span>
            </div>

            {/* High-Impact Subtitle Caption */}
            <div className="px-3 py-2 rounded-xl bg-black/70 backdrop-blur-md border border-white/20 shadow-2xl">
              <p className="text-white text-base font-extrabold leading-snug drop-shadow-md tracking-tight">
                {currentScene?.caption || currentScene?.narration}
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Action Controls */}
        <div className="w-full flex items-center justify-between text-xs text-white/80 mt-3 px-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-green-400" />}
            <span>{isMuted ? "음소거 해제" : "음성 재생 중"}</span>
          </button>

          {currentScene?.image_url && currentScene.image_url.startsWith("data:") && (
            <a
              href={currentScene.image_url}
              download={`shorts_scene_${currentSceneIdx + 1}.jpg`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>이미지 저장</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
