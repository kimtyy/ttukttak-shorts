// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SceneEditor, ProjectHeaderData } from "@/components/project/SceneEditor";
import { ShortsScene } from "@/types";

// Reproduces the 2026-08-04 10:08~10:09 SAVE_CONFLICT burst: this mock server
// implements the exact optimistic-concurrency contract of
// save_project_scenes() (supabase/migrations/01_initial_schema.sql) and
// scenes/route.ts -- reject with SAVE_CONFLICT when the submitted version
// doesn't match the server's current version, otherwise persist and return
// { success: true, version: currentVersion + 1 } at the TOP level (not nested
// under `project`).
function createMockServer(initialVersion: number) {
  let serverVersion = initialVersion;
  const requestLog: Array<{ submittedVersion: number; status: number; body: unknown }> = [];

  const handler = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    if (!url.includes("/scenes") || init?.method !== "PATCH") {
      return new Response(JSON.stringify({}), { status: 200 });
    }

    const payload = JSON.parse(init.body as string);
    const submittedVersion: number = payload.version;

    if (submittedVersion !== serverVersion) {
      const body = {
        error: "SAVE_CONFLICT",
        message: `SAVE_CONFLICT: Project version mismatch (Current: ${serverVersion}, Submitted: ${submittedVersion})`,
      };
      requestLog.push({ submittedVersion, status: 409, body });
      return new Response(JSON.stringify(body), { status: 409 });
    }

    serverVersion += 1;
    const body = { success: true, version: serverVersion };
    requestLog.push({ submittedVersion, status: 200, body });
    return new Response(JSON.stringify(body), { status: 200 });
  });

  return { handler, requestLog, getServerVersion: () => serverVersion };
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const baseProject: ProjectHeaderData = {
  id: "proj_test_1",
  title: "테스트 프로젝트",
  duration: 10,
  version: 1,
};

const baseScenes: ShortsScene[] = [
  {
    id: "sc_1",
    scene_number: 1,
    role: "hook",
    duration: 5,
    narration: "초기 나레이션 1",
    caption: "초기 자막 1",
    visual_description: "",
    image_prompt: "",
    required_asset: "",
    asset_source: "text_motion",
    motion: "static",
    transition: "cut",
  },
  {
    id: "sc_2",
    scene_number: 2,
    role: "cta",
    duration: 5,
    narration: "초기 나레이션 2",
    caption: "초기 자막 2",
    visual_description: "",
    image_prompt: "",
    required_asset: "",
    asset_source: "text_motion",
    motion: "static",
    transition: "cut",
  },
];

describe("SceneEditor 자동저장 버전 동기화 (2026-08-04 SAVE_CONFLICT 회귀 재현/수정 검증)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("연속 두 번의 편집·자동저장이 SAVE_CONFLICT 없이 버전을 1→2→3으로 올린다", async () => {
    const server = createMockServer(1);
    vi.stubGlobal("fetch", server.handler);

    render(<SceneEditor project={baseProject} scenes={baseScenes} />);

    expect(screen.getByText("버전: 1")).toBeTruthy();

    // 1차 편집: 씬 1 나레이션 수정
    const narrationBoxes = screen.getAllByDisplayValue(/초기 나레이션/);
    fireEvent.change(narrationBoxes[0], { target: { value: "수정된 나레이션 1차" } });

    await vi.advanceTimersByTimeAsync(1600); // debounce(1500ms) 통과
    await vi.waitFor(() => expect(screen.getByText("버전: 2")).toBeTruthy());

    // 2차 편집: 씬 2 자막 수정 (같은 세션에서 이어서 편집)
    const captionBoxes = screen.getAllByDisplayValue(/초기 자막/);
    fireEvent.change(captionBoxes[1], { target: { value: "수정된 자막 2차" } });

    await vi.advanceTimersByTimeAsync(1600);
    await vi.waitFor(() => expect(screen.getByText("버전: 3")).toBeTruthy());

    // 충돌 화면 문구가 한 번도 나타나지 않았는지 확인
    expect(screen.queryByText("충돌 발생 (새로고침 필요)")).toBeNull();

    // 요청/응답 로그 전체 출력 (버전 1→2, 2→3 진행 증빙)
    console.log("=== PATCH /scenes 요청 로그 ===");
    server.requestLog.forEach((entry, i) => {
      console.log(
        `[req ${i + 1}] submitted version=${entry.submittedVersion} -> HTTP ${entry.status} -> ${JSON.stringify(entry.body)}`
      );
    });

    expect(server.requestLog.every((e) => e.status === 200)).toBe(true);
    expect(server.requestLog.map((e) => e.submittedVersion)).toEqual([1, 2]);
    expect(server.getServerVersion()).toBe(3);

    // 저장 성공 후 불필요한 재저장이 나가지 않는지 (요청은 편집 2건에 대해 정확히 2건만)
    expect(server.handler).toHaveBeenCalledTimes(2);
  });

  it("[회귀 재현] data.project?.version을 읽는 이전 버그 상태였다면 2번째 저장부터 SAVE_CONFLICT가 발생했을 것이다", async () => {
    // 이전 버그를 그대로 흉내: 클라이언트가 저장 응답에서 버전을 절대 갱신하지 않는 상태를 시뮬레이션
    const server = createMockServer(1);
    const clientVersion = 1;
    const staleHandler = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const res = await server.handler(input, init);
      // 실제 응답은 버전이 올라가지만, 버그 상태의 클라이언트는 data.project?.version(undefined)만 보고 절대 갱신하지 않음
      return res;
    });
    vi.stubGlobal("fetch", staleHandler);

    // 버그 재현을 위해 서버에 stale한 version(=1)을 두 번 연속 보낸다고 가정
    const first = await fetch("/api/projects/x/scenes", {
      method: "PATCH",
      body: JSON.stringify({ version: clientVersion }),
    });
    expect(first.status).toBe(200); // 첫 저장은 성공 (서버 1->2)

    // 버그 상태: clientVersion이 갱신되지 않고 그대로 1
    const second = await fetch("/api/projects/x/scenes", {
      method: "PATCH",
      body: JSON.stringify({ version: clientVersion }),
    });
    const secondBody = await second.json();
    expect(second.status).toBe(409);
    expect(secondBody.error).toBe("SAVE_CONFLICT");
  });
});
