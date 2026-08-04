"use client";

import React, { useEffect, useRef, useState } from "react";
import { ShortsScene, SceneMotion } from "@/types";
import { X, Download, Loader2, Film, RotateCcw, AlertTriangle } from "lucide-react";

interface ShortsExportModalProps {
  onClose: () => void;
  title: string;
  scenes: ShortsScene[];
}

const CANVAS_WIDTH = 720;
const CANVAS_HEIGHT = 1280;

type ExportPhase = "idle" | "loading" | "recording" | "done" | "error";

function pickMimeType(): { mimeType: string; extension: string } {
  const candidates = [
    { mimeType: "video/mp4;codecs=avc1,mp4a.40.2", extension: "mp4" },
    { mimeType: "video/webm;codecs=vp9,opus", extension: "webm" },
    { mimeType: "video/webm;codecs=vp8,opus", extension: "webm" },
    { mimeType: "video/webm", extension: "webm" },
  ];
  for (const candidate of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }
  return { mimeType: "video/webm", extension: "webm" };
}

function getMotionTransform(motion: SceneMotion, t: number) {
  const pan = 36 * t;
  switch (motion) {
    case "slow_zoom_in":
      return { scale: 1 + 0.15 * t, dx: 0, dy: 0 };
    case "slow_zoom_out":
      return { scale: 1.15 - 0.15 * t, dx: 0, dy: 0 };
    case "pan_left":
      return { scale: 1.12, dx: -pan, dy: 0 };
    case "pan_right":
      return { scale: 1.12, dx: pan, dy: 0 };
    case "pan_up":
      return { scale: 1.12, dx: 0, dy: -pan };
    case "pan_down":
      return { scale: 1.12, dx: 0, dy: pan };
    default:
      return { scale: 1.05, dx: 0, dy: 0 };
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ").filter(Boolean);
  const lines: string[] = [];
  let currentLine = "";
  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (currentLine && ctx.measureText(testLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.slice(0, 4);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function ShortsExportModal({ onClose, title, scenes }: ShortsExportModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [progressLabel, setProgressLabel] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultExtension, setResultExtension] = useState("webm");

  const missingImageCount = scenes.filter((s) => !s.image_url).length;
  const isRecorderSupported =
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof HTMLCanvasElement !== "undefined" &&
    "captureStream" in HTMLCanvasElement.prototype;

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      audioCtxRef.current?.close().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const drawScene = (ctx: CanvasRenderingContext2D, scene: ShortsScene, sceneIdx: number, t: number) => {
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const img = imagesRef.current.get(scene.id);
    if (img && img.width > 0) {
      const { scale, dx, dy } = getMotionTransform(scene.motion, t);
      const imgRatio = img.width / img.height;
      const canvasRatio = CANVAS_WIDTH / CANVAS_HEIGHT;
      let drawW: number;
      let drawH: number;
      if (imgRatio > canvasRatio) {
        drawH = CANVAS_HEIGHT * scale;
        drawW = drawH * imgRatio;
      } else {
        drawW = CANVAS_WIDTH * scale;
        drawH = drawW / imgRatio;
      }
      const x = (CANVAS_WIDTH - drawW) / 2 + dx;
      const y = (CANVAS_HEIGHT - drawH) / 2 + dy;
      ctx.drawImage(img, x, y, drawW, drawH);
    } else {
      const gradient = ctx.createLinearGradient(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
      gradient.addColorStop(0, "#312e81");
      gradient.addColorStop(1, "#1e1b4b");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }

    const overlay = ctx.createLinearGradient(0, CANVAS_HEIGHT * 0.55, 0, CANVAS_HEIGHT);
    overlay.addColorStop(0, "rgba(0,0,0,0)");
    overlay.addColorStop(1, "rgba(0,0,0,0.78)");
    ctx.fillStyle = overlay;
    ctx.fillRect(0, CANVAS_HEIGHT * 0.55, CANVAS_WIDTH, CANVAS_HEIGHT * 0.45);

    const captionText = scene.caption || scene.narration || "";
    if (captionText) {
      ctx.font = "bold 34px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const maxWidth = CANVAS_WIDTH - 100;
      const lines = wrapText(ctx, captionText, maxWidth);
      const lineHeight = 44;
      const boxHeight = lines.length * lineHeight + 40;
      const boxY = CANVAS_HEIGHT - boxHeight - 90;

      ctx.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(ctx, 50, boxY, CANVAS_WIDTH - 100, boxHeight, 20);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      lines.forEach((line, i) => {
        ctx.fillText(line, CANVAS_WIDTH / 2, boxY + 20 + lineHeight * i + lineHeight / 2);
      });
    }

    const barGap = 6;
    const barWidth = (CANVAS_WIDTH - 40 - barGap * (scenes.length - 1)) / scenes.length;
    scenes.forEach((_, i) => {
      const bx = 20 + i * (barWidth + barGap);
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      roundRect(ctx, bx, 24, barWidth, 6, 3);
      ctx.fill();
      const fillRatio = i < sceneIdx ? 1 : i === sceneIdx ? t : 0;
      if (fillRatio > 0) {
        ctx.fillStyle = "#ffffff";
        roundRect(ctx, bx, 24, barWidth * fillRatio, 6, 3);
        ctx.fill();
      }
    });
  };

  const preloadImages = async () => {
    const map = new Map<string, HTMLImageElement>();
    await Promise.all(
      scenes.map(
        (scene) =>
          new Promise<void>((resolve) => {
            if (!scene.image_url) {
              resolve();
              return;
            }
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              map.set(scene.id, img);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = scene.image_url;
          })
      )
    );
    imagesRef.current = map;
  };

  const startExport = async () => {
    if (scenes.length === 0 || phase === "loading" || phase === "recording") return;

    if (!isRecorderSupported) {
      setPhase("error");
      setErrorMessage("이 브라우저는 동영상 녹화(MediaRecorder)를 지원하지 않습니다. 최신 Chrome/Edge를 사용해주세요.");
      return;
    }

    setErrorMessage("");
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    setResultUrl(null);

    // Create the AudioContext synchronously within this click handler so
    // browsers (Safari in particular) don't leave it suspended for lack of
    // a user gesture; image preloading below is async and would break that.
    const AudioCtxClass =
      window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioCtx = new AudioCtxClass();
    audioCtxRef.current = audioCtx;
    if (audioCtx.state === "suspended") {
      await audioCtx.resume().catch(() => {});
    }

    setPhase("loading");
    setProgressLabel("이미지를 불러오는 중...");

    try {
      await preloadImages();

      const canvas = canvasRef.current;
      const audioEl = audioElRef.current;
      if (!canvas || !audioEl) throw new Error("녹화 준비 중 오류가 발생했습니다.");
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("캔버스 컨텍스트를 가져올 수 없습니다.");

      const dest = audioCtx.createMediaStreamDestination();
      audioEl.crossOrigin = "anonymous";
      const sourceNode = audioCtx.createMediaElementSource(audioEl);
      sourceNode.connect(dest);

      const videoStream = canvas.captureStream(30);
      const combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const { mimeType, extension } = pickMimeType();
      setResultExtension(extension);
      const recorder = new MediaRecorder(combinedStream, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      const playSceneAudio = (scene: ShortsScene) => {
        if (scene.audio_url && !scene.audio_url.startsWith("speech://")) {
          audioEl.src = scene.audio_url;
          audioEl.currentTime = 0;
          audioEl.play().catch(() => {});
        } else {
          audioEl.pause();
          audioEl.removeAttribute("src");
          audioEl.load();
        }
      };

      setPhase("recording");
      recorder.start(250);
      playSceneAudio(scenes[0]);

      const totalDuration = scenes.reduce((acc, s) => acc + (s.duration || 5), 0);
      let sceneIdx = 0;

      await new Promise<void>((resolve) => {
        const startTime = performance.now();
        let sceneStart = startTime;

        const tick = (now: number) => {
          const scene = scenes[sceneIdx];
          const durationMs = (scene.duration || 5) * 1000;
          const elapsed = now - sceneStart;
          const t = Math.min(elapsed / durationMs, 1);

          drawScene(ctx, scene, sceneIdx, t);
          const elapsedTotal = Math.min((now - startTime) / 1000, totalDuration);
          setProgressLabel(`녹화 중... ${elapsedTotal.toFixed(1)}s / ${totalDuration}s`);

          if (elapsed >= durationMs) {
            if (sceneIdx < scenes.length - 1) {
              sceneIdx += 1;
              sceneStart = now;
              playSceneAudio(scenes[sceneIdx]);
              rafRef.current = requestAnimationFrame(tick);
            } else {
              resolve();
            }
          } else {
            rafRef.current = requestAnimationFrame(tick);
          }
        };
        rafRef.current = requestAnimationFrame(tick);
      });

      recorder.stop();
      audioEl.pause();
      await stopped;

      const blob = new Blob(chunks, { type: mimeType });
      setResultUrl(URL.createObjectURL(blob));
      setPhase("done");
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[ShortsExportModal] export failed:", error);
      setErrorMessage(
        error.name === "SecurityError"
          ? "일부 이미지가 외부 서버의 보안 정책(CORS)으로 캡처되지 못했습니다."
          : error.message || "내보내기 중 오류가 발생했습니다."
      );
      setPhase("error");
    }
  };

  const isBusy = phase === "loading" || phase === "recording";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <audio ref={audioElRef} className="hidden" />

      <div className="relative w-full max-w-sm flex flex-col items-center">
        <div className="w-full flex items-center justify-between text-white mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="bg-gradient-to-r from-emerald-500 to-teal-500 text-xs font-bold px-2 py-0.5 rounded-full uppercase tracking-wider text-white">
              MP4 내보내기
            </span>
            <h3 className="text-sm font-semibold truncate max-w-[140px]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="p-1.5 rounded-full hover:bg-white/20 text-white/80 hover:text-white transition-colors disabled:opacity-30"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative w-full aspect-[9/16] rounded-3xl overflow-hidden bg-gray-900 border-4 border-gray-800 shadow-2xl">
          {phase === "done" && resultUrl ? (
            <video src={resultUrl} controls loop className="w-full h-full object-cover bg-black" />
          ) : (
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full h-full object-cover bg-black"
            />
          )}

          {phase === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center bg-black/40">
              <Film className="w-10 h-10 text-emerald-400" />
              <p className="text-sm text-white/90 font-medium">
                {scenes.length}개 장면, 총 {scenes.reduce((acc, s) => acc + (s.duration || 5), 0)}초 분량을
                녹화합니다.
              </p>
              {missingImageCount > 0 && (
                <p className="text-xs text-amber-300 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  이미지가 없는 장면 {missingImageCount}개는 빈 배경으로 표시됩니다.
                </p>
              )}
            </div>
          )}

          {isBusy && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/30 pointer-events-none">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
              <p className="text-xs text-white font-semibold bg-black/60 px-3 py-1 rounded-full">{progressLabel}</p>
            </div>
          )}
        </div>

        <div className="w-full mt-3 space-y-2">
          {phase === "error" && (
            <p className="text-xs text-red-400 bg-red-950/60 border border-red-800 rounded-lg px-3 py-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {errorMessage}
            </p>
          )}

          {phase === "recording" && (
            <p className="text-[11px] text-white/50 text-center">
              녹화 중에는 이 탭을 벗어나거나 최소화하지 마세요. 실시간으로 재생하며 녹화합니다.
            </p>
          )}

          <div className="flex items-center gap-2">
            {phase === "done" && resultUrl ? (
              <>
                <a
                  href={resultUrl}
                  download={`${title || "shorts"}.${resultExtension}`}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition-all"
                >
                  <Download className="w-4 h-4" /> 다운로드 ({resultExtension})
                </a>
                <button
                  type="button"
                  onClick={startExport}
                  className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-all"
                >
                  <RotateCcw className="w-4 h-4" /> 다시 녹화
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startExport}
                disabled={isBusy || scenes.length === 0}
                className="flex-1 flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-bold transition-all"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> 처리 중...
                  </>
                ) : phase === "error" ? (
                  <>
                    <RotateCcw className="w-4 h-4" /> 다시 시도
                  </>
                ) : (
                  <>
                    <Film className="w-4 h-4" /> 녹화 시작
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
