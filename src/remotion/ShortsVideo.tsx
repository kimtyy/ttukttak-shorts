import React from "react";
import { Series, Html5Audio, Img, interpolate } from "remotion";
import { loadFont } from "@remotion/google-fonts/NotoSansKR";
import { ShortsScene } from "@/types";

// 뚝딱쇼츠 고정 자막 스타일 - 사용자가 고를 수 있는 옵션이 아니라 항상 이 폰트/스타일을 쓴다.
// 초보자가 폰트·색상을 직접 고민할 필요가 없도록 검증된 굵은 한글 고딕 스타일을 강제한다.
// 굵기는 900(Black) 하나만 로드한다 - Cloud Run 렌더 워커에서 폰트를 매번 네트워크로
// 받아오므로(구글 폰트 CDN), 굵기를 늘릴수록 요청 수가 배로 늘어나 렌더링 시작이
// 느려지고 실패 지점이 늘어난다. 후킹/일반 자막 구분은 크기·테두리·위치로만 준다.
const { fontFamily: NOTO_SANS_KR } = loadFont("normal", {
  weights: ["900"],
  subsets: ["korean", "latin"],
  ignoreTooManyRequestsWarning: true,
});

export type ShortsVideoProps = {
  title: string;
  scenes: ShortsScene[];
  fps?: number;
  includeBgm?: boolean;
  bgmUrl?: string | null;
};

const BGM_FADE_SECONDS = 1.5;
const BGM_MAX_VOLUME = 0.18; // 나레이션보다 확실히 낮은 볼륨으로 고정

export const ShortsVideo: React.FC<ShortsVideoProps> = ({
  title,
  scenes,
  fps = 30,
  includeBgm = false,
  bgmUrl = null,
}) => {
  const totalDurationInFrames = (scenes || []).reduce(
    (acc, s) => acc + Math.max(1, (s.duration || 5) * fps),
    0
  );

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        backgroundColor: "#090d16",
        position: "relative",
        overflow: "hidden",
        fontFamily: NOTO_SANS_KR,
      }}
    >
      {/* 배경음악은 나레이션 유무와 완전히 독립: includeBgm이 켜져 있고 사용자가
          파일을 올렸으면(bgmUrl) 항상 낮은 볼륨의 별도 트랙으로 믹싱한다. */}
      {includeBgm && bgmUrl && (
        <Html5Audio
          src={bgmUrl}
          loop
          volume={(frame) => {
            const fadeFrames = Math.round(BGM_FADE_SECONDS * fps);
            const fadeIn = interpolate(frame, [0, fadeFrames], [0, BGM_MAX_VOLUME], { extrapolateRight: "clamp" });
            const fadeOut = interpolate(
              frame,
              [totalDurationInFrames - fadeFrames, totalDurationInFrames],
              [BGM_MAX_VOLUME, 0],
              { extrapolateLeft: "clamp" }
            );
            return Math.min(fadeIn, fadeOut);
          }}
        />
      )}

      <Series>
        {(scenes || []).map((scene, idx) => {
          const durationInFrames = Math.max(1, (scene.duration || 5) * fps);

          return (
            <Series.Sequence key={scene.id || idx} durationInFrames={durationInFrames}>
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                {/* Visual Background */}
                {scene.image_url ? (
                  <Img
                    src={scene.image_url}
                    alt={scene.visual_description || "Scene Visual"}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#a855f7",
                      fontSize: 42,
                      fontWeight: "bold",
                    }}
                  >
                    {title} - Scene {idx + 1}
                  </div>
                )}

                {/* Optional Audio Narration Layer. "speech://..." is a browser-only
                    Web Speech API marker (see tts.ts fallback) with no playable
                    asset behind it, so it is intentionally excluded here. */}
                {scene.audio_url &&
                  (scene.audio_url.startsWith("data:audio") || scene.audio_url.startsWith("http")) && (
                    <Html5Audio src={scene.audio_url} />
                  )}

                {/* Subtitle Overlay - 뚝딱쇼츠 고정 스타일 (사용자 커스터마이징 불가).
                    후킹(hook) 씬은 화면 상단에 크고 임팩트 있게, 나머지는 하단에
                    가독성 중심으로 배치해 시각적으로 구분한다. 어떤 배경 사진 위에서도
                    읽히도록 굵은 검정 텍스트 스트로크 + 그림자를 항상 적용한다. */}
                <div
                  style={
                    scene.role === "hook"
                      ? {
                          position: "absolute",
                          top: 150,
                          left: 36,
                          right: 36,
                          backgroundColor: "rgba(0,0,0,0.55)",
                          padding: "28px 30px",
                          borderRadius: 28,
                          textAlign: "center",
                          border: "3px solid #fbbf24",
                          boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
                        }
                      : {
                          position: "absolute",
                          bottom: 120,
                          left: 40,
                          right: 40,
                          backgroundColor: "rgba(0,0,0,0.75)",
                          padding: "24px 32px",
                          borderRadius: 24,
                          textAlign: "center",
                          border: "2px solid rgba(255,255,255,0.2)",
                        }
                  }
                >
                  <p
                    style={{
                      color: "#ffffff",
                      fontSize: scene.role === "hook" ? 84 : 58,
                      fontWeight: 900,
                      margin: 0,
                      lineHeight: 1.25,
                      WebkitTextStroke: scene.role === "hook" ? "10px #000000" : "7px #000000",
                      paintOrder: "stroke fill",
                      textShadow: "0 4px 14px rgba(0,0,0,0.6)",
                    }}
                  >
                    {scene.caption || scene.narration}
                  </p>
                </div>
              </div>
            </Series.Sequence>
          );
        })}
      </Series>
    </div>
  );
};
