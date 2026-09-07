import { describe, it, expect, vi, beforeEach } from "vitest";

// Prisma をモックして、DBなしで「重複防止の分岐」だけを検証する
// （vi.mock はファイル先頭に巻き上げられるので、モック関数は vi.hoisted で先に用意する）
const { findFirst, create } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { diagnosisSession: { findFirst, create } },
}));

import { createSessionWithScanLink } from "@/lib/qr-scan-link";

const baseData = {
  clinicId: "clinic-1",
  channelId: "ch-1",
  clientKey: "key-00000001",
  completedAt: new Date(),
};

// Prisma のユニーク制約違反エラーを模したオブジェクト
const uniqueError = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

describe("createSessionWithScanLink の重複防止", () => {
  beforeEach(() => {
    findFirst.mockReset();
    create.mockReset();
  });

  it("同じ完了キーのセッションが既にあれば、新規作成せず既存を返す", async () => {
    findFirst.mockResolvedValueOnce({ id: "existing-1" });

    const result = await createSessionWithScanLink("log-1", baseData);

    expect(result).toEqual({ id: "existing-1", deduplicated: true });
    expect(create).not.toHaveBeenCalled();
    expect(findFirst).toHaveBeenCalledWith({
      where: { clientKey: "key-00000001", channelId: "ch-1" },
      select: { id: true },
    });
  });

  it("既存が無ければ読み込みログに紐付けて作成する", async () => {
    findFirst.mockResolvedValueOnce(null);
    create.mockResolvedValueOnce({ id: "new-1" });

    const result = await createSessionWithScanLink("log-1", baseData);

    expect(result).toEqual({ id: "new-1", deduplicated: false });
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0][0].data.accessLogId).toBe("log-1");
    expect(create.mock.calls[0][0].data.clientKey).toBe("key-00000001");
  });

  it("ほぼ同時に2回届いて完了キーのユニーク制約に弾かれたら、先に作られた1件を返す", async () => {
    findFirst
      .mockResolvedValueOnce(null) // 1回目の確認時点ではまだ無い
      .mockResolvedValueOnce({ id: "raced-1" }); // 制約違反後の再確認で見つかる
    create.mockRejectedValueOnce(uniqueError);

    const result = await createSessionWithScanLink("log-1", baseData);

    expect(result).toEqual({ id: "raced-1", deduplicated: true });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("読み込みIDの取り合いで弾かれた場合は、紐付けなしで作り直す（従来どおり）", async () => {
    const dataWithoutKey = { ...baseData, clientKey: null };
    create
      .mockRejectedValueOnce(uniqueError)
      .mockResolvedValueOnce({ id: "unlinked-1" });

    const result = await createSessionWithScanLink("log-1", dataWithoutKey);

    expect(result).toEqual({ id: "unlinked-1", deduplicated: false });
    expect(create).toHaveBeenCalledTimes(2);
    expect(create.mock.calls[0][0].data.accessLogId).toBe("log-1");
    expect(create.mock.calls[1][0].data.accessLogId).toBeUndefined();
    // 完了キーが無いので既存検索は行わない
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("完了キーが無く、読み込みIDも無いときはそのまま作成する", async () => {
    create.mockResolvedValueOnce({ id: "plain-1" });

    const result = await createSessionWithScanLink(null, { ...baseData, clientKey: null });

    expect(result).toEqual({ id: "plain-1", deduplicated: false });
    expect(findFirst).not.toHaveBeenCalled();
    expect(create.mock.calls[0][0].data.accessLogId).toBeUndefined();
  });
});
