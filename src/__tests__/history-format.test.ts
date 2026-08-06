import { describe, it, expect } from "vitest";
import {
  formatScanRow,
  formatSessionRow,
  mergeHistoryRows,
  type HistoryScanLog,
  type HistorySession,
} from "@/lib/history-format";

// テスト用のセッションを組み立てるヘルパー
function makeSession(overrides: Partial<HistorySession> = {}): HistorySession {
  return {
    id: "session-1",
    createdAt: new Date("2026-07-07T16:36:00Z"),
    userAge: 28,
    userGender: "female",
    resultCategory: "要注意",
    sessionType: "diagnosis",
    region: "東京都",
    city: "渋谷区",
    town: "富ヶ谷二丁目",
    channel: { id: "ch-1", name: "無料相談" },
    diagnosisType: { slug: "oral-age", name: "お口年齢診断" },
    ctaClicks: [{ ctaType: "line" }],
    _count: { ctaClicks: 1 },
    ...overrides,
  };
}

function makeScanLog(overrides: Partial<HistoryScanLog> = {}): HistoryScanLog {
  return {
    id: "log-1",
    createdAt: new Date("2026-07-07T16:30:00Z"),
    region: "東京都",
    city: null,
    channel: { id: "ch-1", name: "無料相談" },
    session: null,
    ...overrides,
  };
}

describe("QR読み込み履歴の行組み立て", () => {
  it("読み込みだけ（完了なし）の行は属性が空になる", () => {
    const row = formatScanRow(makeScanLog());

    expect(row.type).toBe("qr_scan");
    expect(row.sourceType).toBe("qr_scan");
    expect(row.sessionId).toBeNull();
    expect(row.userAge).toBeNull();
    expect(row.userGender).toBeNull();
    expect(row.diagnosisType).toBe("QR読み込み");
    expect(row.area).toBe("東京都");
  });

  it("完了セッションが紐付いた読み込みは1行に合体される", () => {
    const row = formatScanRow(makeScanLog({ session: makeSession() }));

    // 行のIDと日時は「読み込み」側（＝実際にQRを読んだ瞬間）
    expect(row.id).toBe("log-1");
    expect(row.createdAt).toEqual(new Date("2026-07-07T16:30:00Z"));
    expect(row.sourceType).toBe("qr_scan");

    // 中身はセッション側の属性が入る
    expect(row.type).toBe("diagnosis");
    expect(row.sessionId).toBe("session-1");
    expect(row.userAge).toBe(28);
    expect(row.userGender).toBe("女性");
    expect(row.diagnosisType).toBe("お口年齢診断");
    expect(row.resultCategory).toBe("要注意");
    expect(row.ctaClickCount).toBe(1);

    // エリアは精度の高いセッション側（町丁目まで）を採用する
    expect(row.area).toBe("東京都 渋谷区 富ヶ谷二丁目");
  });

  it("セッション側にエリアが無ければ読み込みログのエリアを使う", () => {
    const row = formatScanRow(
      makeScanLog({
        region: "東京都",
        city: "港区",
        session: makeSession({ region: null, city: null, town: null }),
      })
    );

    expect(row.area).toBe("東京都 港区");
  });

  it("リンクQRのセッションは「リンクQR」と表示される", () => {
    const row = formatScanRow(
      makeScanLog({
        session: makeSession({ sessionType: "link", diagnosisType: null }),
      })
    );

    expect(row.type).toBe("link");
    expect(row.diagnosisType).toBe("リンクQR");
  });

  it("読み込みに紐付かない完了セッションはそのまま1行になる", () => {
    const row = formatSessionRow(makeSession());

    expect(row.id).toBe("session-1");
    expect(row.sourceType).toBe("session");
    expect(row.sessionId).toBe("session-1");
    expect(row.type).toBe("diagnosis");
  });

  it("読み込み行とセッション行は日時の新しい順に並ぶ", () => {
    const older = formatSessionRow(
      makeSession({ id: "old", createdAt: new Date("2026-07-01T10:00:00Z") })
    );
    const newer = formatScanRow(
      makeScanLog({ id: "new", createdAt: new Date("2026-07-28T10:23:00Z") })
    );

    const merged = mergeHistoryRows([newer], [older]);

    expect(merged.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("1回の読み込み＋完了は2行にならない（二重カウント防止）", () => {
    // 読み込み1件 + それに紐付く完了セッション1件 → 履歴は1行
    const scanWithSession = formatScanRow(makeScanLog({ session: makeSession() }));
    // 紐付いていない完了セッション（過去データ）は別の1行
    const legacySession = formatSessionRow(
      makeSession({ id: "legacy", createdAt: new Date("2026-05-01T10:00:00Z") })
    );

    const merged = mergeHistoryRows([scanWithSession], [legacySession]);

    expect(merged).toHaveLength(2);
  });
});
