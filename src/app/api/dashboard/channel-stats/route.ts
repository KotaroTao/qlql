import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getQrAccessCountsByChannel } from "@/lib/qr-access";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

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

    // アクティブなチャンネルを取得
    const channels = await prisma.channel.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      select: {
        id: true,
      },
    });

    const channelIds = channels.map((c: { id: string }) => c.id);

    if (channelIds.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    // 日付フィルター条件
    const dateFilter = dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {};

    // 各チャンネルの統計を取得
    const [
      accessCountMap,
      completedCounts,
      ctaCounts,
      ctaByChannel,
      genderByChannel,
      ageByChannel,
      accessLogs,
    ] = await Promise.all([
      // アクセス数（チャンネル別）= 実際にQRが読み込まれた回数（qr-access.ts の共通ルール）
      getQrAccessCountsByChannel(channelIds, dateFilter),

      // 診断完了数（チャンネル別）
      prisma.diagnosisSession.groupBy({
        by: ["channelId"],
        where: {
          clinicId: session.clinicId,
          channelId: { in: channelIds },
          ...dateFilter,
          isDemo: false,
          isDeleted: false,
          completedAt: { not: null },
        },
        _count: { id: true },
      }),

      // CTAクリック数（チャンネル別）
      prisma.cTAClick.groupBy({
        by: ["channelId"],
        where: {
          clinicId: session.clinicId,
          channelId: { in: channelIds },
          isDeleted: false,
          ...dateFilter,
        },
        _count: { id: true },
      }),

      // CTA内訳（チャンネル・タイプ別）
      prisma.cTAClick.groupBy({
        by: ["channelId", "ctaType"],
        where: {
          clinicId: session.clinicId,
          channelId: { in: channelIds },
          isDeleted: false,
          ...dateFilter,
        },
        _count: { id: true },
      }),

      // 性別統計（チャンネル別）
      prisma.diagnosisSession.groupBy({
        by: ["channelId", "userGender"],
        where: {
          clinicId: session.clinicId,
          channelId: { in: channelIds },
          ...dateFilter,
          isDemo: false,
          isDeleted: false,
          completedAt: { not: null },
        },
        _count: { id: true },
      }),

      // 年齢データ（チャンネル別）
      prisma.diagnosisSession.findMany({
        where: {
          clinicId: session.clinicId,
          channelId: { in: channelIds },
          ...dateFilter,
          isDemo: false,
          isDeleted: false,
          completedAt: { not: null },
        },
        select: { channelId: true, userAge: true },
      }),

      // アクセスログ（日付別集計用）
      prisma.accessLog.findMany({
        where: {
          clinicId: session.clinicId,
          channelId: { in: channelIds },
          ...dateFilter,
          eventType: { not: "clinic_page_view" },
          isDeleted: false,
        },
        select: { channelId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    // 統計データを整理
    const stats: Record<string, {
      accessCount: number;
      completedCount: number;
      completionRate: number;
      ctaCount: number;
      ctaRate: number;
      ctaByType: Record<string, number>;
      genderByType: Record<string, number>;
      ageRanges: Record<string, number>;
      accessByDate: { date: string; count: number }[];
    }> = {};

    // 初期化
    for (const channelId of channelIds) {
      stats[channelId] = {
        accessCount: 0,
        completedCount: 0,
        completionRate: 0,
        ctaCount: 0,
        ctaRate: 0,
        ctaByType: {},
        genderByType: { male: 0, female: 0, other: 0 },
        ageRanges: { "~19": 0, "20-29": 0, "30-39": 0, "40-49": 0, "50-59": 0, "60~": 0 },
        accessByDate: [],
      };
    }

    // アクセス数（実際にQRが読み込まれた回数）
    for (const [channelIdKey, count] of Object.entries(accessCountMap)) {
      if (stats[channelIdKey]) {
        stats[channelIdKey].accessCount = count;
      }
    }

    // 診断完了数
    for (const item of completedCounts) {
      if (item.channelId && stats[item.channelId]) {
        stats[item.channelId].completedCount = item._count.id;
      }
    }

    // CTAクリック数
    for (const item of ctaCounts) {
      if (item.channelId && stats[item.channelId]) {
        stats[item.channelId].ctaCount = item._count.id;
      }
    }

    // CTA内訳
    for (const item of ctaByChannel) {
      if (item.channelId && stats[item.channelId]) {
        stats[item.channelId].ctaByType[item.ctaType] = item._count.id;
      }
    }

    // 性別統計
    for (const item of genderByChannel) {
      if (item.channelId && item.userGender && stats[item.channelId]) {
        stats[item.channelId].genderByType[item.userGender] = item._count.id;
      }
    }

    // 年齢層統計
    for (const session of ageByChannel) {
      if (session.channelId && session.userAge !== null && stats[session.channelId]) {
        const age = session.userAge;
        if (age < 20) stats[session.channelId].ageRanges["~19"]++;
        else if (age < 30) stats[session.channelId].ageRanges["20-29"]++;
        else if (age < 40) stats[session.channelId].ageRanges["30-39"]++;
        else if (age < 50) stats[session.channelId].ageRanges["40-49"]++;
        else if (age < 60) stats[session.channelId].ageRanges["50-59"]++;
        else stats[session.channelId].ageRanges["60~"]++;
      }
    }

    // 完了率・CTA率・広告効果指標を計算
    for (const channelId of channelIds) {
      const s = stats[channelId];

      // 完了率
      s.completionRate = s.accessCount > 0
        ? Math.round((s.completedCount / s.accessCount) * 100 * 10) / 10
        : 0;

      // CTA率（診断完了者のうちCTAをクリックした割合）
      s.ctaRate = s.completedCount > 0
        ? Math.round((s.ctaCount / s.completedCount) * 100 * 10) / 10
        : 0;
    }

    // 日付別アクセス数を集計（直近10日分のみ）
    const accessByDateMap: Record<string, Record<string, number>> = {};
    for (const channelId of channelIds) {
      accessByDateMap[channelId] = {};
    }
    for (const log of accessLogs) {
      if (log.channelId && accessByDateMap[log.channelId]) {
        const dateKey = log.createdAt.toISOString().split("T")[0];
        accessByDateMap[log.channelId][dateKey] = (accessByDateMap[log.channelId][dateKey] || 0) + 1;
      }
    }
    for (const channelId of channelIds) {
      const dateMap = accessByDateMap[channelId];
      const sortedDates = Object.keys(dateMap).sort((a, b) => b.localeCompare(a));
      stats[channelId].accessByDate = sortedDates.slice(0, 10).map((date) => ({
        date,
        count: dateMap[date],
      }));
    }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Channel stats error:", error);
    return NextResponse.json(
      { error: "チャンネル統計の取得に失敗しました" },
      { status: 500 }
    );
  }
}
