import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { QR_SCAN_EVENT_TYPE } from "@/lib/qr-access";
import {
  HISTORY_SCAN_INCLUDE,
  HISTORY_SESSION_INCLUDE,
  formatScanRow,
  formatSessionRow,
  mergeHistoryRows,
  type HistoryScanLog,
  type HistorySession,
} from "@/lib/history-format";

// 共有ダッシュボードの履歴を取得（認証不要、トークンで医院を特定）
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // トークンから医院を取得
    const clinic = await prisma.clinic.findUnique({
      where: { shareToken: token },
      select: { id: true },
    });

    if (!clinic) {
      return NextResponse.json(
        { error: "無効な共有リンクです" },
        { status: 404 }
      );
    }

    const clinicId = clinic.id;

    const { searchParams } = new URL(request.url);
    const VALID_PERIODS = ["today", "week", "month", "all"];
    const period = VALID_PERIODS.includes(searchParams.get("period") || "")
      ? searchParams.get("period")!
      : "all";
    const channelIdsParam = searchParams.get("channelIds");
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0") || 0);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20") || 20));

    const selectedChannelIds = channelIdsParam
      ? channelIdsParam.split(",").filter((id) => id.trim())
      : [];

    // 期間の計算
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (period === "all") {
      // 全期間
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

    const dateFilter = dateFrom && dateTo
      ? { createdAt: { gte: dateFrom, lte: dateTo } }
      : {};

    // アクティブなチャンネルを取得
    const activeChannels = await prisma.channel.findMany({
      where: { clinicId, isActive: true },
      select: { id: true },
    });
    const activeChannelIds = activeChannels.map((c: { id: string }) => c.id);

    // チャンネルフィルター
    let channelFilter: { channelId?: string | { in: string[] } } = {};
    if (selectedChannelIds.length > 0) {
      const filteredIds = selectedChannelIds.filter((id) =>
        activeChannelIds.includes(id)
      );
      if (filteredIds.length > 0) {
        channelFilter = { channelId: { in: filteredIds } };
      }
    } else if (activeChannelIds.length > 0) {
      channelFilter = { channelId: { in: activeChannelIds } };
    } else {
      return NextResponse.json({
        history: [],
        totalCount: 0,
        hasMore: false,
        offset,
        limit,
      });
    }

    // 読み込みログに紐付いていない完了セッションのみ取得。
    // 紐付いているものは読み込みログ側の行にまとめられるので、ここでは数えない
    // （そうしないと1回の読み込みが2行になり、件数が実際の読み込み回数とズレる）
    const whereFilter = {
      clinicId,
      isDemo: false,
      isDeleted: false,
      completedAt: { not: null as null },
      accessLogId: null,
      ...dateFilter,
      ...channelFilter,
    };

    // QR読み込みログの条件
    const scanFilter = {
      clinicId,
      eventType: QR_SCAN_EVENT_TYPE,
      isDeleted: false,
      ...dateFilter,
      ...channelFilter,
    };

    // 履歴データとカウントを並行取得
    const [sessions, sessionTotal, scans, scanTotal] = await Promise.all([
      prisma.diagnosisSession.findMany({
        where: whereFilter,
        include: HISTORY_SESSION_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit + 1,
      }),
      prisma.diagnosisSession.count({ where: whereFilter }),
      prisma.accessLog.findMany({
        where: scanFilter,
        include: HISTORY_SCAN_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit + 1,
      }),
      prisma.accessLog.count({ where: scanFilter }),
    ]);

    const totalCount = sessionTotal + scanTotal;

    // 読み込み行（紐付く完了セッションがあれば属性を合体）とセッション行を統合
    const combined = mergeHistoryRows(
      (scans as unknown as HistoryScanLog[]).map((log) =>
        formatScanRow(
          log.session &&
            (log.session as HistorySession & { isDeleted?: boolean }).isDeleted
            ? { ...log, session: null }
            : log
        )
      ),
      (sessions as unknown as HistorySession[]).map(formatSessionRow)
    );

    const history = combined.slice(0, limit);

    return NextResponse.json({
      history,
      totalCount,
      hasMore: offset + limit < totalCount,
      offset,
      limit,
    });
  } catch (error) {
    console.error("Shared history error:", error);
    return NextResponse.json(
      { error: "履歴データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
