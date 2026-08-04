import { Composition, registerRoot } from "remotion";
import { ShortsVideo } from "./ShortsVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ShortsVideo"
        component={ShortsVideo as any}
        durationInFrames={150}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          title: "뚝딱쇼츠 테스트",
          scenes: [
            {
              id: "sc_1",
              scene_number: 1,
              role: "hook" as const,
              duration: 5,
              narration: "테스트 쇼츠 나레이션입니다.",
              caption: "테스트 자막입니다",
              visual_description: "눈꽃 맥주 잔",
              image_prompt: "vertical 9:16 composition, frosty ice beer glass",
              required_asset: "",
              asset_source: "ai_image" as const,
              motion: "slow_zoom_in" as const,
              transition: "cut" as const,
            },
          ],
        }}
      />
    </>
  );
};

registerRoot(RemotionRoot);
