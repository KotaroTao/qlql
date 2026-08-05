import { NextRequest, NextResponse } from "next/server";
import { resolveClinicContext } from "@/lib/dashboard-auth";
import { prisma } from "@/lib/prisma";
import { QR_SCAN_EVENT_TYPE } from "@/lib/qr-access";
import {
  HISTORY_SCAN_INCLUDE,
  HISTORY_SESSION_INCLUDE,
  formatScanRow,
  formatSessionRow,
  mergeHistoryRows,
  type HistoryRow,
  type HistoryScanLog,
  type HistorySession,
} from "@/lib/history-format";

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveClinicContext(request);
    if (!ctx) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const session = { clinicId: ctx.clinicId };

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    // channelIds=id1,id2 形式でも受け付ける（チラシ単位フィルタ用）
    const channelIdsParam = searchParams.get("channelIds");
    const channelIds = channelIdsParam
      ? channelIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
      : null;
    const diagnosisType = searchParams.get("diagnosisType");
    const VALID_PERIODS = ["today", "week", "month", "all", "custom"];
    const period = VALID_PERIODS.includes(searchParams.get("period") || "")
      ? searchParams.get("period")!
      : "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0") || 0);
    const limit = Math.min(10000, Math.max(1, parseInt(searchParams.get("limit") || "50") || 50));
    const skipCount = searchParams.get("skipCount") === "true"; // 追加読み込み時はカウントをスキップ

    // 期間の計算（"all"の場合は期間フィルターなし）
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (period === "all") {
      // 全期間の場合は日付フィルターを適用しない
    } else if (period === "custom" && startDate && endDate) {
      dateFrom = new Date(startDate);
      dateTo = new Date();
      dateTo.setTime(new Date(endDate).getTime());
      dateTo.setHours(23, 59, 59, 999);
    } else {
      dateTo = new Date();
      switch (period) {
        case "today":
          dateFrom = new Date();
          dateFrom.setHours(0, 0, 0, 0);
          break;
        case "week":
          dateFrom = new Date();
          dateFrom.setDate(dateFrom.getDate() - 7);
          dateFrom.setHours(0, 0, 0, 0);
          break;
        case "month":
        default:
          dateFrom = new Date();
          dateFrom.setMonth(dateFrom.getMonth() - 1);
          dateFrom.setHours(0, 0, 0, 0);
          break;
      }
    }

    // アクティブなチャンネルIDを取得（非表示チャンネルを除外）
    const activeChannels = await prisma.channel.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      select: { id: true },
    });
    const activeChannelIds = activeChannels.map((c: { id: string }) => c.id);

    // フィルター条件
    // accessLogId: null が重要。QR読み込みログに紐付いたセッションは
    // 読み込みログ側の行にまとめて表示するので、ここでは二重に取らない。
    // （紐付きが無いのは、qr_scan 計測開始前の過去データや直接URLアクセス）
    type WhereFilterType = {
      clinicId: string;
      isDemo: boolean;
      isDeleted: boolean;
      completedAt: { not: null };
      accessLogId: null;
      createdAt?: { gte: Date; lte: Date };
      channelId?: string | { in: string[] };
      diagnosisType?: { slug: string };
    };

    const whereFilter: WhereFilterType = {
      clinicId: session.clinicId,
      isDemo: false,
      isDeleted: false,
      completedAt: { not: null },
      accessLogId: null,
      ...(dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {}),
    };

    if (channelId) {
      whereFilter.channelId = channelId;
    } else if (channelIds && channelIds.length > 0) {
      // channelIds= で複数指定（チラシ単位フィルタ）。アクティブ・非アクティブ問わず、
      // 指定されたチャネルの履歴を返す。
      whereFilter.channelId = { in: channelIds };
    } else if (activeChannelIds.length > 0) {
      // 特定チャンネル指定がない場合、アクティブチャンネルのみ
      whereFilter.channelId = { in: activeChannelIds };
    } else {
      // アクティブなチャンネルがない場合、履歴を空で返す
      return NextResponse.json({
        history: [],
        totalCount: 0,
        hasMore: false,
        offset,
        limit,
      });
    }

    if (diagnosisType) {
      whereFilter.diagnosisType = { slug: diagnosisType };
    }

    // 履歴データを取得（カウントは初回のみ実行）
    const sessionsQuery = prisma.diagnosisSession.findMany({
      where: whereFilter,
      include: HISTORY_SESSION_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit + 1, // 次のページがあるか確認するために1件多く取得
    });

    // skipCountがtrueの場合はカウントをスキップ（パフォーマンス最適化）
    const [sessions, totalCount] = skipCount
      ? [await sessionsQuery, -1]
      : await Promise.all([
          sessionsQuery,
          prisma.diagnosisSession.count({ where: whereFilter }),
        ]);

    // 次のページがあるかどうかを判定
    const hasMore = sessions.length > limit;
    const sessionsToReturn = hasMore ? sessions.slice(0, limit) : sessions;

    // 読み込みログに紐付いていない完了セッションを行に整形（過去データ・直接アクセス分）
    const diagnosisHistory = (sessionsToReturn as HistorySession[]).map(
      formatSessionRow
    );

    // QR読み込みログの履歴を取得
    type AccessLogFilterType = {
      clinicId: string;
      eventType: string;
      isDeleted: boolean;
      createdAt?: { gte: Date; lte: Date };
      channelId?: string | { in: string[] };
    };

    const accessLogFilter: AccessLogFilterType = {
      clinicId: session.clinicId,
      eventType: QR_SCAN_EVENT_TYPE,
      isDeleted: false,
      ...(dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {}),
    };

    if (channelId) {
      accessLogFilter.channelId = channelId;
    } else if (channelIds && channelIds.length > 0) {
      accessLogFilter.channelId = { in: channelIds };
    } else if (activeChannelIds.length > 0) {
      accessLogFilter.channelId = { in: activeChannelIds };
    }

    // diagnosisTypeが指定されている場合はQRスキャンを除外
    const includeQRScans = !diagnosisType;

    let qrScanHistory: HistoryRow[] = [];

    if (includeQRScans) {
      const qrScans = (await prisma.accessLog.findMany({
        where: accessLogFilter,
        include: HISTORY_SCAN_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit + 1, // 次のページがあるか確認するために1件多く取得
      })) as unknown as HistoryScanLog[];

      // 紐付く完了セッションがある行は、その属性（年齢・性別・診断結果）を
      // 同じ1行に合体させる。読み込みと完了が2行に分かれないので、
      // 履歴の件数がそのまま「実際にQRを読み込んだ回数」になる。
      // ただし削除済みセッションが紐付いている場合は、属性なしの読み込み行として扱う。
      qrScanHistory = qrScans.map((log) =>
        formatScanRow(
          log.session && (log.session as HistorySession & { isDeleted?: boolean }).isDeleted
            ? { ...log, session: null }
            : log
        )
      );
    }

    // 両方の履歴を統合し、日時でソート
    const combinedHistory = mergeHistoryRows(qrScanHistory, diagnosisHistory);

    // 次のページがあるかどうかを判定（skipCount時はlimit+1パターンで判定）
    const combinedHasMore = combinedHistory.length > limit;
    const history = combinedHasMore ? combinedHistory.slice(0, limit) : combinedHistory;

    // 合計件数（skipCountがtrueの場合はカウントをスキップ）
    let combinedTotalCount: number;
    let responseHasMore: boolean;

    if (skipCount) {
      // 追加読み込み時はCOUNTをスキップしてパフォーマンス最適化
      combinedTotalCount = -1;
      responseHasMore = combinedHasMore;
    } else {
      // 初回読み込み時は正確な件数を取得
      const qrScanTotalCount = includeQRScans
        ? await prisma.accessLog.count({ where: accessLogFilter })
        : 0;
      combinedTotalCount = totalCount + qrScanTotalCount;
      responseHasMore = offset + limit < combinedTotalCount;
    }

    return NextResponse.json({
      history,
      totalCount: combinedTotalCount,
      hasMore: responseHasMore,
      offset,
      limit,
    });
  } catch (error) {
    console.error("Dashboard history error:", error);
    return NextResponse.json(
      { error: "履歴データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
