// 「QRアクセス（= 実際にQRが読み込まれた回数）」の数え方を1か所にまとめたモジュール。
//
// 画面のあちこち（チラシ管理・ダッシュボード・共有ページ・管理画面）で
// 同じ数字を出すために、必ずここの条件を使う。
//
// ── 数え方 ──────────────────────────────────────────────
//   QRアクセス = ①QR読み込みログ + ②読み込みに紐付いていない完了セッション
//
//   ① AccessLog(eventType="qr_scan")
//      QRを読み込んだ瞬間の記録。2026/5/10から計測開始。
//   ② DiagnosisSession(completedAt≠null, accessLogId=null)
//      「読み込みログが無いのに完了だけある」セッション。
//      具体的には計測開始前の過去データや、QRを介さず直接URLを開いた人。
//
//   読み込みログに紐付いたセッション（accessLogId≠null）は①で既に1件数えているので、
//   ②では数えない。これで1人の行動が必ず1件になる。
//
// ── 同じ数になる別の分け方（エリア地図で使用）────────────
//   紐付いた読み込みログと紐付いたセッションは 1:1 なので、次の式も同じ数になる:
//
//     ①読み込みログ + ②未紐付けセッション
//       =（紐付きログ + 未紐付けログ）+ ②
//       =（紐付きセッション + ②）+ 未紐付けログ
//       = 完了セッション全件 + 完了に至らなかった読み込みログ
//
//   読み込みログは位置情報を持たない（リダイレクトを速くするため取得していない）ので、
//   エリア地図ではこちらの分け方を使って、セッション側のGPS位置を活かしている。
//   → src/app/api/dashboard/locations/route.ts
// ────────────────────────────────────────────────────────
import { prisma } from "@/lib/prisma";

export const QR_SCAN_EVENT_TYPE = "qr_scan";

// 期間フィルタ（未指定なら全期間）
export type DateRangeFilter = { createdAt?: { gte: Date; lte: Date } };

/**
 * ①QR読み込みログを数えるための where 条件。
 */
export function qrScanLogWhere(options: {
  clinicId?: string;
  channelFilter?: Record<string, unknown>;
  dateRange?: DateRangeFilter;
}) {
  const { clinicId, channelFilter = {}, dateRange = {} } = options;
  return {
    ...(clinicId ? { clinicId } : {}),
    eventType: QR_SCAN_EVENT_TYPE,
    isDeleted: false,
    ...dateRange,
    ...channelFilter,
  };
}

/**
 * ②読み込みに紐付いていない完了セッションを数えるための where 条件。
 *
 * accessLogId: null が二重カウント防止の要。
 * これを外すと、1回の読み込みが「読み込み1件 + 完了1件」で2件になってしまう。
 */
export function unlinkedSessionWhere(options: {
  clinicId?: string;
  channelFilter?: Record<string, unknown>;
  dateRange?: DateRangeFilter;
  extra?: Record<string, unknown>;
}) {
  const { clinicId, channelFilter = {}, dateRange = {}, extra = {} } = options;
  return {
    ...(clinicId ? { clinicId } : {}),
    isDemo: false,
    isDeleted: false,
    completedAt: { not: null },
    accessLogId: null,
    ...dateRange,
    ...channelFilter,
    ...extra,
  };
}

/**
 * チャネルごとのQRアクセス数をまとめて取得する。
 * 戻り値は { チャネルID: 件数 } の形。
 */
export async function getQrAccessCountsByChannel(
  channelIds: string[],
  dateRange: DateRangeFilter = {}
): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  if (channelIds.length === 0) return counts;

  const channelFilter = { channelId: { in: channelIds } };

  const [scanCounts, sessionCounts] = await Promise.all([
    prisma.accessLog.groupBy({
      by: ["channelId"],
      where: qrScanLogWhere({ channelFilter, dateRange }),
      _count: { id: true },
    }),
    prisma.diagnosisSession.groupBy({
      by: ["channelId"],
      where: unlinkedSessionWhere({ channelFilter, dateRange }),
      _count: { id: true },
    }),
  ]);

  for (const row of scanCounts) {
    if (row.channelId) counts[row.channelId] = row._count.id;
  }
  for (const row of sessionCounts) {
    if (row.channelId) {
      counts[row.channelId] = (counts[row.channelId] || 0) + row._count.id;
    }
  }
  return counts;
}

/**
 * 医院全体（またはチャネル絞り込み）のQRアクセス総数。
 */
export async function getQrAccessTotal(options: {
  clinicId: string;
  channelFilter?: Record<string, unknown>;
  dateRange?: DateRangeFilter;
}): Promise<number> {
  const [scanTotal, sessionTotal] = await Promise.all([
    prisma.accessLog.count({ where: qrScanLogWhere(options) }),
    prisma.diagnosisSession.count({ where: unlinkedSessionWhere(options) }),
  ]);
  return scanTotal + sessionTotal;
}
