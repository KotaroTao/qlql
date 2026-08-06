import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getQrAccessTotal } from "@/lib/qr-access";

// 指定医院のダッシュボード統計を取得（管理者用）
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId } = await params;

    // 医院の存在確認
    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true },
    });

    if (!clinic) {
      return NextResponse.json({ error: "医院が見つかりません" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // 期間の計算
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (period === "all") {
      // 全期間の場合は日付フィルターを適用しない
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

    const dateFilter = dateFrom && dateTo
      ? { createdAt: { gte: dateFrom, lte: dateTo } }
      : {};

    // 統計データを並行取得
    const [
      accessCount,
      completedCount,
      ctaClickCount,
      channels,
      clinicPageViews,
      genderStats,
      completedSessions,
    ] = await Promise.all([
      // QR読み込み数（実際にQRが読み込まれた回数）
      // 医院側ダッシュボードと同じ共通ルールで数え、同じ数字が出るようにする
      getQrAccessTotal({ clinicId, dateRange: dateFilter }),

      // 診断完了数（削除・デモを除外）
      prisma.diagnosisSession.count({
        where: {
          clinicId,
          isDemo: false,
          isDeleted: false,
          completedAt: { not: null },
          ...dateFilter,
        },
      }),

      // CTAクリック数（削除済みを除外）
      prisma.cTAClick.count({
        where: {
          clinicId,
          isDeleted: false,
          ...dateFilter,
        },
      }),

      // QRコード一覧
      prisma.channel.findMany({
        where: { clinicId },
        select: { id: true, name: true, isActive: true, channelType: true },
        orderBy: { createdAt: "desc" },
      }),

      // 医院紹介ページの閲覧数
      prisma.accessLog.count({
        where: {
          clinicId,
          eventType: "clinic_page_view",
          ...dateFilter,
        },
      }),

      // 性別統計
      prisma.diagnosisSession.groupBy({
        by: ["userGender"],
        where: {
          clinicId,
          isDemo: false,
          completedAt: { not: null },
          ...dateFilter,
        },
        _count: { id: true },
      }),

      // 年齢データを取得
      prisma.diagnosisSession.findMany({
        where: {
          clinicId,
          isDemo: false,
          completedAt: { not: null },
          ...dateFilter,
        },
        select: { userAge: true },
      }),
    ]);

    // 完了率を計算
    const completionRate =
      accessCount > 0 ? Math.round((completedCount / accessCount) * 100 * 10) / 10 : 0;

    // CTA率を計算
    const ctaRate =
      completedCount > 0 ? Math.round((ctaClickCount / completedCount) * 100 * 10) / 10 : 0;

    // 性別統計を整理
    const genderByType: Record<string, number> = {
      male: 0,
      female: 0,
      other: 0,
    };
    for (const stat of genderStats) {
      if (stat.userGender && genderByType.hasOwnProperty(stat.userGender)) {
        genderByType[stat.userGender] = stat._count.id;
      }
    }

    // 年齢層統計を計算
    const ageRanges: Record<string, number> = {
      "0-9": 0,
      "10-19": 0,
      "20-29": 0,
      "30-39": 0,
      "40-49": 0,
      "50-59": 0,
      "60-69": 0,
      "70-79": 0,
      "80+": 0,
    };
    for (const session of completedSessions) {
      const age = session.userAge;
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

    return NextResponse.json({
      clinicName: clinic.name,
      stats: {
        accessCount,
        completedCount,
        completionRate,
        ctaClickCount,
        ctaRate,
        clinicPageViews,
        genderByType,
        ageRanges,
      },
      channels: {
        total: channels.length,
        active: channels.filter((c: { isActive: boolean }) => c.isActive).length,
        hidden: channels.filter((c: { isActive: boolean }) => !c.isActive).length,
      },
      period: dateFrom && dateTo
        ? { from: dateFrom.toISOString(), to: dateTo.toISOString() }
        : null,
    });
  } catch (error) {
    console.error("Admin clinic stats error:", error);
    return NextResponse.json(
      { error: "統計データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
