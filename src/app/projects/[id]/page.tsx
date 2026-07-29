import { SceneEditor } from "@/components/project/SceneEditor";

export default async function ProjectEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const dummyProject = {
    id,
    title: "설맥 현리점 눈꽃맥주와 먹태 홍보 릴스",
    duration: 30,
    hook: "폭염에 지친 오늘, 얼음 소용돌이 눈꽃맥주 한 잔 어떠세요?",
    thumbnail_text: "현리 살얼음 맥주 성지",
    version: 1,
  };

  const dummyScenes = [
    {
      id: "sc_1",
      scene_number: 1,
      role: "hook" as const,
      duration: 5,
      narration: "무더운 오늘, 가평 현리에서 가장 시원한 맥주를 찾고 계신가요?",
      caption: "가평 현리 최고 시원한 맥주?",
      visual_description: "시원한 눈꽃 입자가 수놓아진 눈꽃맥주 잔 close-up 샷",
      image_prompt: "vertical 9:16 composition, frosty ice beer glass, close up, vibrant lighting, no text",
      required_asset: "눈꽃맥주 영상",
      asset_source: "user_upload" as const,
      motion: "slow_zoom_in" as const,
      transition: "cut" as const,
    },
    {
      id: "sc_2",
      scene_number: 2,
      role: "feature" as const,
      duration: 20,
      narration: "살얼음이 소복이 올라간 눈꽃맥주와 바삭바삭 담백하게 구워낸 고소한 먹태의 조화!",
      caption: "살얼음 맥주 X 바삭 먹태 환상 조합",
      visual_description: "손으로 찢은 바삭한 먹태와 특제 청양마요 소스 세팅 샷",
      image_prompt: "vertical 9:16 composition, crispy dried pollack dish with mayo dip, warm cozy pub background, no text",
      required_asset: "먹태 세팅 사진",
      asset_source: "ai_image" as const,
      motion: "pan_right" as const,
      transition: "fade" as const,
    },
    {
      id: "sc_3",
      scene_number: 3,
      role: "cta" as const,
      duration: 5,
      narration: "오늘 저녁, 설맥 현리점에서 가벼운 한잔으로 스트레스를 싹 날려보세요!",
      caption: "오늘 저녁 설맥 현리점에서 만나요!",
      visual_description: "설맥 현리점 네온사인 매장 전경",
      image_prompt: "vertical 9:16 composition, cozy Korean pub exterior neon sign night view, no text",
      required_asset: "",
      asset_source: "text_motion" as const,
      motion: "text_pop" as const,
      transition: "cut" as const,
    },
  ];

  return <SceneEditor project={dummyProject} scenes={dummyScenes} />;
}
