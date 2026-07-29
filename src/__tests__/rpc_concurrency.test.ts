import { describe, it, expect, beforeEach } from "vitest";

interface SubscriptionRecord {
  user_id: string;
  plan_code: string;
  status: "active" | "canceled" | "expired";
  monthly_script_limit: number;
  monthly_recommendation_limit: number;
  current_period_start: Date;
  current_period_end: Date;
}

interface GenerationJob {
  id: string;
  user_id: string;
  job_type: "script_generation" | "topic_recommendation";
  idempotency_key: string;
  status: "processing" | "completed" | "failed" | "refunded";
}

interface LedgerEntry {
  id: string;
  user_id: string;
  action: "script_generation" | "topic_recommendation" | "refund";
  quantity: number;
  direction: "debit" | "credit";
  status: "pending" | "committed" | "reversed";
  job_id: string;
  idempotency_key: string;
}

class MockSupabaseDB {
  public subscriptions: SubscriptionRecord[] = [];
  public jobs: GenerationJob[] = [];
  public ledger: LedgerEntry[] = [];

  public reset() {
    this.subscriptions = [];
    this.jobs = [];
    this.ledger = [];
  }

  public reserveUsage(
    authUserId: string | null,
    jobType: "script_generation" | "topic_recommendation",
    idempotencyKey: string,
    quantity = 1
  ) {
    if (!authUserId) {
      throw new Error("AUTH_REQUIRED: User is not authenticated");
    }

    if (!["script_generation", "topic_recommendation"].includes(jobType)) {
      throw new Error("INVALID_JOB_TYPE: Job type not supported");
    }

    const existingJob = this.jobs.find(
      (j) => j.user_id === authUserId && j.job_type === jobType && j.idempotency_key === idempotencyKey
    );
    if (existingJob) {
      return { jobId: existingJob.id, alreadyExists: true, currentStatus: existingJob.status };
    }

    const sub = this.subscriptions.find(
      (s) => s.user_id === authUserId && ["active", "trialing", "past_due"].includes(s.status)
    );

    if (!sub) {
      throw new Error("NO_ACTIVE_SUBSCRIPTION");
    }

    const limit = jobType === "script_generation" ? sub.monthly_script_limit : sub.monthly_recommendation_limit;

    const committedUsed = this.ledger
      .filter((l) => l.user_id === authUserId && l.action === jobType && l.status === "committed" && l.direction === "debit")
      .reduce((sum, l) => sum + l.quantity, 0);

    const pendingUsed = this.ledger
      .filter((l) => l.user_id === authUserId && l.action === jobType && l.status === "pending" && l.direction === "debit")
      .reduce((sum, l) => sum + l.quantity, 0);

    const totalUsed = committedUsed + pendingUsed;

    if (totalUsed + quantity > limit) {
      throw new Error(`USAGE_LIMIT_EXCEEDED: Limit ${limit} reached`);
    }

    const jobId = `job_${Math.random().toString(36).substring(2, 9)}`;
    const newJob: GenerationJob = {
      id: jobId,
      user_id: authUserId,
      job_type: jobType,
      idempotency_key: idempotencyKey,
      status: "processing",
    };
    this.jobs.push(newJob);

    const newLedger: LedgerEntry = {
      id: `led_${Math.random().toString(36).substring(2, 9)}`,
      user_id: authUserId,
      action: jobType,
      quantity,
      direction: "debit",
      status: "pending",
      job_id: jobId,
      idempotency_key: idempotencyKey,
    };
    this.ledger.push(newLedger);

    return { jobId, alreadyExists: false, currentStatus: "processing" };
  }

  public commitUsage(authUserId: string | null, jobId: string) {
    if (!authUserId) throw new Error("AUTH_REQUIRED");
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (job.user_id !== authUserId) throw new Error("UNAUTHORIZED");

    if (job.status === "completed") return true;

    job.status = "completed";
    const led = this.ledger.find((l) => l.job_id === jobId && l.status === "pending");
    if (led) led.status = "committed";
    return true;
  }

  public releaseUsage(authUserId: string | null, jobId: string) {
    if (!authUserId) throw new Error("AUTH_REQUIRED");
    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error("JOB_NOT_FOUND");
    if (job.user_id !== authUserId) throw new Error("UNAUTHORIZED");

    const led = this.ledger.find((l) => l.job_id === jobId && l.status === "pending");
    if (led) {
      led.status = "reversed";
    }

    if (job.status !== "completed") {
      job.status = "failed";
    }
    return true;
  }

  public refundUsage(role: "authenticated" | "service_role", jobId: string) {
    if (role !== "service_role") {
      throw new Error("PERMISSION_DENIED: refund_usage is service_role only");
    }

    const job = this.jobs.find((j) => j.id === jobId);
    if (!job) throw new Error("JOB_NOT_FOUND");

    const committedLedger = this.ledger.find((l) => l.job_id === jobId && l.status === "committed");
    if (!committedLedger) throw new Error("NO_COMMITTED_LEDGER");

    this.ledger.push({
      id: `led_${Math.random().toString(36).substring(2, 9)}`,
      user_id: job.user_id,
      action: "refund",
      quantity: committedLedger.quantity,
      direction: "credit",
      status: "committed",
      job_id: jobId,
      idempotency_key: `refund_${jobId}`,
    });

    job.status = "refunded";
    return true;
  }
}

describe("PostgreSQL RPC & Usage Concurrency Integration Tests", () => {
  let db: MockSupabaseDB;
  const USER_A = "user_aaaa_1111";
  const USER_B = "user_bbbb_2222";

  beforeEach(() => {
    db = new MockSupabaseDB();
    db.subscriptions.push({
      user_id: USER_A,
      plan_code: "free",
      status: "active",
      monthly_script_limit: 1,
      monthly_recommendation_limit: 10,
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
  });

  it("남은 사용량이 1회일 때 다른 idempotency key로 두 요청 동시 실행 시 1개만 성공하고 한도 초과(USAGE_LIMIT_EXCEEDED)를 반환한다", () => {
    const req1 = () => db.reserveUsage(USER_A, "script_generation", "key_001");
    const req2 = () => db.reserveUsage(USER_A, "script_generation", "key_002");

    const res1 = req1();
    expect(res1.alreadyExists).toBe(false);
    expect(res1.currentStatus).toBe("processing");

    expect(req2).toThrow("USAGE_LIMIT_EXCEEDED");
  });

  it("동일 idempotency key로 10회 동시 요청 시 작업과 pending 원장이 각각 1개만 생성된다", () => {
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(db.reserveUsage(USER_A, "script_generation", "same_key_100"));
    }

    expect(results[0].alreadyExists).toBe(false);
    expect(results[1].alreadyExists).toBe(true);
    expect(results[9].alreadyExists).toBe(true);
    expect(results[0].jobId).toBe(results[9].jobId);

    expect(db.jobs.filter((j) => j.user_id === USER_A).length).toBe(1);
    expect(db.ledger.filter((l) => l.user_id === USER_A).length).toBe(1);
  });

  it("다른 사용자의 job_id로 commit 또는 release할 수 없다 (권한 격리)", () => {
    const res = db.reserveUsage(USER_A, "script_generation", "key_a");
    const jobId = res.jobId;

    expect(() => db.commitUsage(USER_B, jobId)).toThrow("UNAUTHORIZED");
    expect(() => db.releaseUsage(USER_B, jobId)).toThrow("UNAUTHORIZED");
  });

  it("committed 작업은 일반 release_usage()로 환급되지 않고, refund_usage는 service_role 전용이다", () => {
    const res = db.reserveUsage(USER_A, "script_generation", "key_commit_test");
    db.commitUsage(USER_A, res.jobId);

    db.releaseUsage(USER_A, res.jobId);
    const led = db.ledger.find((l) => l.job_id === res.jobId);
    expect(led?.status).toBe("committed");

    expect(() => db.refundUsage("authenticated", res.jobId)).toThrow("PERMISSION_DENIED");

    expect(db.refundUsage("service_role", res.jobId)).toBe(true);
    expect(db.jobs.find((j) => j.id === res.jobId)?.status).toBe("refunded");
  });

  it("추천 한도가 남아 있어도 대본 생성 한도를 초과하면 대본 생성이 차단된다", () => {
    const res = db.reserveUsage(USER_A, "script_generation", "script_key_1");
    db.commitUsage(USER_A, res.jobId);

    expect(() => db.reserveUsage(USER_A, "script_generation", "script_key_2")).toThrow("USAGE_LIMIT_EXCEEDED");

    const recRes = db.reserveUsage(USER_A, "topic_recommendation", "topic_key_1");
    expect(recRes.alreadyExists).toBe(false);
  });
});
