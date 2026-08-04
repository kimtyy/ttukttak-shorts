import React from "react";
import { Composition, registerRoot } from "remotion";
import { ShortsVideo, ShortsVideoProps } from "./ShortsVideo";

export const RemotionRoot: React.FC = () => {
  const defaultScenes = [
    {
      id: "sc_1",
      scene_number: 1,
      role: "hook" as const,
      duration: 5,
      narration: "무더운 여름, 시원한 눈꽃맥주 한 잔 어떠세요?",
      caption: "가평 현리 최고 시원한 맥주?",
      visual_description: "눈꽃 맥주 잔",
      image_prompt: "vertical 9:16 composition, frosty ice beer glass",
      required_asset: "",
      asset_source: "ai_image" as const,
      motion: "slow_zoom_in" as const,
      transition: "cut" as const,
    },
    {
      id: "sc_2",
      scene_number: 2,
      role: "feature" as const,
      duration: 5,
      narration: "바삭한 먹태와 특제 청양마요 소스의 조화!",
      caption: "바삭 먹태 X 청양마요 환상 조합",
      visual_description: "먹태 요리 접시",
      image_prompt: "vertical 9:16 composition, crispy dried pollack dish",
      required_asset: "",
      asset_source: "ai_image" as const,
      motion: "pan_right" as const,
      transition: "fade" as const,
    },
  ];

  const defaultProps: ShortsVideoProps = {
    title: "뚝딱쇼츠 동영상",
    scenes: defaultScenes,
    fps: 30,
  };

  const fps = 30;
  const totalDurationSec = defaultScenes.reduce((acc, s) => acc + (s.duration || 5), 0);
  const durationInFrames = Math.max(1, totalDurationSec * fps);

  return (
    <>
      <Composition<ShortsVideoProps>
        id="ShortsVideo"
        component={ShortsVideo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={1080}
        height={1920}
        defaultProps={defaultProps}
      />
    </>
  );
};

registerRoot(RemotionRoot);
