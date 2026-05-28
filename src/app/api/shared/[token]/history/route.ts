import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCtaTypeName } from "@/lib/cta-types";

// 診断タイプの表示名
const DIAGNOSIS_TYPE_NAMES: Record<string, string> = {
  "oral-age": "お口年齢診断",
  "child-orthodontics": "子供の矯正タイミングチェック",
  "periodontal-risk": "歯周病リスク診断",
  "cavity-risk": "虫歯リスク診断",
  "whitening-check": "ホワイトニング適正診断",
  "teeth-yellowing": "歯の黄ばみ診断",
  "visit-timing": "受診タイミング診断",
  "bad-breath-risk": "口臭リスク診断",
  "bruxism-risk": "歯ぎしりリスク診断",
  "denture-risk": "入れ歯危険度診断",
};

const GENDER_NAMES: Record<string, string> = {
  male: "男性",
  female: "女性",
  other: "-",
};

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

    const whereFilter = {
      clinicId,
      isDemo: false,
      isDeleted: false,
      completedAt: { not: null as null },
      ...dateFilter,
      ...channelFilter,
    };

    // 履歴データとカウントを並行取得
    const [sessions, totalCount] = await Promise.all([
      prisma.diagnosisSession.findMany({
        where: whereFilter,
        include: {
          channel: { select: { id: true, name: true } },
          diagnosisType: { select: { slug: true, name: true } },
          ctaClicks: { select: { ctaType: true } },
          _count: { select: { ctaClicks: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit + 1,
      }),
      prisma.diagnosisSession.count({ where: whereFilter }),
    ]);

    const hasMore = sessions.length > limit;
    const sessionsToReturn = hasMore ? sessions.slice(0, limit) : sessions;

    type SessionWithRelations = {
      id: string;
      createdAt: Date;
      userAge: number | null;
      userGender: string | null;
      resultCategory: string | null;
      sessionType: string | null;
      region: string | null;
      city: string | null;
      town: string | null;
      channel: { id: string; name: string } | null;
      diagnosisType: { slug: string; name: string } | null;
      ctaClicks: { ctaType: string }[];
      _count: { ctaClicks: number };
    };

    const history = (sessionsToReturn as SessionWithRelations[]).map((s) => {
      const ctaByType: Record<string, number> = {};
      for (const click of s.ctaClicks) {
        ctaByType[click.ctaType] = (ctaByType[click.ctaType] || 0) + 1;
      }

      let area = "-";
      if (s.region && s.city && s.town) {
        area = `${s.region} ${s.city} ${s.town}`;
      } else if (s.region && s.city) {
        area = `${s.region} ${s.city}`;
      } else if (s.region) {
        area = s.region;
      }

      let diagnosisTypeName: string;
      if (s.sessionType === "link") {
        diagnosisTypeName = "リンクQR";
      } else {
        diagnosisTypeName = s.diagnosisType?.name || DIAGNOSIS_TYPE_NAMES[s.diagnosisType?.slug || ""] || "不明";
      }

      const ctaClick = s.ctaClicks[0];

      return {
        id: s.id,
        type: s.sessionType === "link" ? "link" : "diagnosis",
        createdAt: s.createdAt,
        userAge: s.userAge,
        userGender: s.userGender ? GENDER_NAMES[s.userGender] || s.userGender : null,
        diagnosisType: diagnosisTypeName,
        resultCategory: s.resultCategory,
        channelName: s.channel?.name || "不明",
        area,
        ctaType: ctaClick ? getCtaTypeName(ctaClick.ctaType) : null,
        ctaClickCount: s._count.ctaClicks,
        ctaByType,
      };
    });

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
