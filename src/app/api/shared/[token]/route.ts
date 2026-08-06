import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  QR_SCAN_EVENT_TYPE,
  getQrAccessCountsByChannel,
  getQrAccessTotal,
} from "@/lib/qr-access";

// 共有ダッシュボードのデータを取得（認証不要、トークンで医院を特定）
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // トークンから医院を取得
    const clinic = await prisma.clinic.findUnique({
      where: { shareToken: token },
      select: { id: true, name: true, logoUrl: true, mainColor: true },
    });

    if (!clinic) {
      return NextResponse.json(
        { error: "無効な共有リンクです" },
        { status: 404 }
      );
    }

    const clinicId = clinic.id;

    const { searchParams } = new URL(request.url);
    const VALID_PERIODS = ["today", "week", "month", "all", "custom"];
    const period = VALID_PERIODS.includes(searchParams.get("period") || "")
      ? searchParams.get("period")!
      : "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const channelIdsParam = searchParams.get("channelIds");

    const selectedChannelIds = channelIdsParam
      ? channelIdsParam.split(",").filter((id) => id.trim())
      : [];

    // 期間の計算
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (period === "all") {
      // 全期間
    } else if (period === "custom" && startDate && endDate) {
      dateFrom = new Date(startDate);
      dateTo = new Date(endDate);
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

    // チャンネル一覧を取得
    const channels = await prisma.channel.findMany({
      where: { clinicId, isActive: true },
      select: {
        id: true,
        name: true,
        channelType: true,
        diagnosisTypeSlug: true,
        budget: true,
        distributionMethod: true,
        distributionQuantity: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
    const activeChannelIds = channels.map((c: { id: string }) => c.id);

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
    }

    const dateFilter = dateFrom && dateTo
      ? { createdAt: { gte: dateFrom, lte: dateTo } }
      : {};

    const completedFilter = {
      clinicId,
      ...dateFilter,
      ...channelFilter,
      isDemo: false,
      isDeleted: false,
      completedAt: { not: null as null },
    };

    // 統計データを並行取得
    const [
      accessCount,
      completedCount,
      ctaClicks,
      genderStats,
      completedSessions,
      sessionsWithCategory,
      ctaClicksWithSession,
      // チャンネル別統計
      channelAccessCounts,
      channelCtaCounts,
      // 都道府県別
      regionSessionData,
      regionAccessData,
      // 日別トレンド
      dailySessionRaw,
      dailyUnlinkedScanRaw,
      dailyCtaRaw,
    ] = await Promise.all([
      // QR読込数 = 実際にQRが読み込まれた回数（qr-access.ts の共通ルール）
      getQrAccessTotal({
        clinicId,
        channelFilter,
        dateRange: dateFilter,
      }),

      // 診断完了数
      prisma.diagnosisSession.count({
        where: completedFilter,
      }),

      // CTAクリック（タイプ別）
      prisma.cTAClick.groupBy({
        by: ["ctaType"],
        where: {
          clinicId,
          isDeleted: false,
          ...dateFilter,
          ...channelFilter,
        },
        _count: { id: true },
      }),

      // 性別統計
      prisma.diagnosisSession.groupBy({
        by: ["userGender"],
        where: completedFilter,
        _count: { id: true },
      }),

      // 年齢データ
      prisma.diagnosisSession.findMany({
        where: completedFilter,
        select: { userAge: true },
      }),

      // 結果カテゴリ別セッション数
      prisma.diagnosisSession.groupBy({
        by: ["resultCategory"],
        where: completedFilter,
        _count: { id: true },
      }),

      // セッションに紐づくCTAクリック
      prisma.cTAClick.findMany({
        where: {
          clinicId,
          isDeleted: false,
          ...dateFilter,
          ...channelFilter,
          sessionId: { not: null },
        },
        select: {
          sessionId: true,
          session: { select: { resultCategory: true } },
        },
      }),

      // チャンネル別アクセス数（実際にQRが読み込まれた回数）
      getQrAccessCountsByChannel(activeChannelIds, dateFilter),

      // チャンネル別CTAクリック数
      prisma.cTAClick.groupBy({
        by: ["channelId"],
        where: {
          clinicId,
          isDeleted: false,
          ...dateFilter,
          channelId: { in: activeChannelIds },
        },
        _count: { id: true },
      }),

      // 都道府県別集計（診断セッション）
      prisma.diagnosisSession.groupBy({
        by: ["region"],
        where: {
          clinicId,
          isDeleted: false,
          isDemo: false,
          completedAt: { not: null },
          ...dateFilter,
          ...channelFilter,
          region: { not: null },
        },
        _count: { id: true },
      }),

      // 都道府県別集計（完了に至らなかったQR読み込み分）
      // 完了した分は上の regionSessionData 側で計上済みなので、ここでは除外して二重計上を防ぐ
      prisma.accessLog.groupBy({
        by: ["region"],
        where: {
          clinicId,
          eventType: QR_SCAN_EVENT_TYPE,
          isDeleted: false,
          session: { is: null },
          ...dateFilter,
          ...channelFilter,
          region: { not: null },
        },
        _count: { id: true },
      }),

      // 日別トレンド用：完了セッション（createdAtを含む）
      prisma.diagnosisSession.findMany({
        where: {
          clinicId,
          isDeleted: false,
          isDemo: false,
          completedAt: { not: null },
          ...dateFilter,
          ...channelFilter,
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),

      // 日別トレンド用：完了に至らなかったQR読み込み（上と合わせて読み込み回数になる）
      prisma.accessLog.findMany({
        where: {
          clinicId,
          eventType: QR_SCAN_EVENT_TYPE,
          isDeleted: false,
          session: { is: null },
          ...dateFilter,
          ...channelFilter,
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),

      // 日別トレンド用：CTAクリック
      prisma.cTAClick.findMany({
        where: {
          clinicId,
          isDeleted: false,
          ...dateFilter,
          ...channelFilter,
        },
        select: { createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
    ]);

    // CTAクリックをタイプ別に整理
    const ctaByType: Record<string, number> = {};
    let ctaCount = 0;
    for (const cta of ctaClicks) {
      ctaByType[cta.ctaType] = cta._count.id;
      ctaCount += cta._count.id;
    }

    // 性別統計
    const genderByType: Record<string, number> = { male: 0, female: 0, other: 0 };
    for (const stat of genderStats) {
      if (stat.userGender && stat.userGender in genderByType) {
        genderByType[stat.userGender] = stat._count.id;
      }
    }

    // 年齢層統計
    const ageRanges: Record<string, number> = {
      "0-9": 0, "10-19": 0, "20-29": 0, "30-39": 0,
      "40-49": 0, "50-59": 0, "60-69": 0, "70-79": 0, "80+": 0,
    };
    for (const s of completedSessions) {
      const age = s.userAge;
      if (age !== null) {
        if (age < 10) ageRanges["0-9"]++;
        else if (age < 20) ageRanges["10-19"]++;
        else if (age < 30) ageRanges["20-29"]++;
        else if (age < 40) ageRanges["30-39"]++;
        else if (age < 50) ageRanges["40-49"]++;
        else if (age < 60) ageRanges["50-59"]++;
        else if (age < 70) ageRanges["60-69"]++;
        else if (age < 80) ageRanges["70-79"]++;
        else ageRanges["80+"]++;
      }
    }

    // 結果カテゴリ別統計
    const categoryStats: Record<string, { count: number; ctaCount: number; ctaRate: number }> = {};
    for (const stat of sessionsWithCategory) {
      const category = stat.resultCategory || "未分類";
      categoryStats[category] = { count: stat._count.id, ctaCount: 0, ctaRate: 0 };
    }
    for (const click of ctaClicksWithSession) {
      const category = click.session?.resultCategory || "未分類";
      if (!categoryStats[category]) {
        categoryStats[category] = { count: 0, ctaCount: 0, ctaRate: 0 };
      }
      categoryStats[category].ctaCount++;
    }
    for (const category of Object.keys(categoryStats)) {
      const stat = categoryStats[category];
      stat.ctaRate = stat.count > 0
        ? Math.round((stat.ctaCount / stat.count) * 100 * 10) / 10
        : 0;
    }

    // CTA率
    const ctaRate = completedCount > 0
      ? Math.round((ctaCount / completedCount) * 100 * 10) / 10
      : 0;

    // チャンネル別の統計をまとめる
    const channelAccessMap = channelAccessCounts;
    const channelCtaMap: Record<string, number> = {};
    for (const item of channelCtaCounts) {
      if (item.channelId) channelCtaMap[item.channelId] = item._count.id;
    }

    const channelsWithStats = channels.map((ch: typeof channels[number]) => {
      const access = channelAccessMap[ch.id] || 0;
      const cta = channelCtaMap[ch.id] || 0;
      return {
        ...ch,
        accessCount: access,
        ctaCount: cta,
        ctaRate: access > 0 ? Math.round((cta / access) * 100 * 10) / 10 : 0,
        costPerAccess: ch.budget && access > 0
          ? Math.round(ch.budget / access)
          : null,
      };
    });

    // 都道府県別データを統合
    const regionMap: Record<string, number> = {};
    for (const item of regionSessionData) {
      if (item.region) {
        regionMap[item.region] = (regionMap[item.region] || 0) + item._count.id;
      }
    }
    for (const item of regionAccessData) {
      if (item.region) {
        regionMap[item.region] = (regionMap[item.region] || 0) + item._count.id;
      }
    }
    const topRegions = Object.entries(regionMap)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 日別トレンドデータを整形
    // 完了セッションと「完了に至らなかった読み込み」を足すと読み込み回数になる
    const accessByDate: Record<string, number> = {};
    for (const row of [...dailySessionRaw, ...dailyUnlinkedScanRaw]) {
      const d = row.createdAt.toISOString().slice(0, 10);
      accessByDate[d] = (accessByDate[d] || 0) + 1;
    }
    const ctaByDate: Record<string, number> = {};
    for (const row of dailyCtaRaw) {
      const d = row.createdAt.toISOString().slice(0, 10);
      ctaByDate[d] = (ctaByDate[d] || 0) + 1;
    }
    const allDates = new Set([...Object.keys(accessByDate), ...Object.keys(ctaByDate)]);
    const dailyTrend = Array.from(allDates)
      .sort()
      .slice(-30)
      .map((date) => ({
        date,
        accessCount: accessByDate[date] || 0,
        ctaCount: ctaByDate[date] || 0,
      }));

    return NextResponse.json({
      clinic: {
        name: clinic.name,
        logoUrl: clinic.logoUrl,
        mainColor: clinic.mainColor,
      },
      stats: {
        accessCount,
        completedCount,
        completionRate: accessCount > 0
          ? Math.round((completedCount / accessCount) * 100 * 10) / 10
          : 0,
        ctaCount,
        ctaRate,
        ctaByType,
        categoryStats,
        genderByType,
        ageRanges,
      },
      channels: channelsWithStats,
      topRegions,
      dailyTrend,
    });
  } catch (error) {
    console.error("Shared dashboard error:", error);
    return NextResponse.json(
      { error: "データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
