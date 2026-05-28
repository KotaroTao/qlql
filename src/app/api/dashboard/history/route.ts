import { NextRequest, NextResponse } from "next/server";
import { resolveClinicContext } from "@/lib/dashboard-auth";
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
    type WhereFilterType = {
      clinicId: string;
      isDemo: boolean;
      isDeleted: boolean;
      completedAt: { not: null };
      createdAt?: { gte: Date; lte: Date };
      channelId?: string | { in: string[] };
      diagnosisType?: { slug: string };
    };

    const whereFilter: WhereFilterType = {
      clinicId: session.clinicId,
      isDemo: false,
      isDeleted: false,
      completedAt: { not: null },
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
      include: {
        channel: {
          select: { id: true, name: true },
        },
        diagnosisType: {
          select: { slug: true, name: true },
        },
        ctaClicks: {
          select: { ctaType: true },
        },
        _count: {
          select: { ctaClicks: true },
        },
      },
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

    // 性別の表示名
    const GENDER_NAMES: Record<string, string> = {
      male: "男性",
      female: "女性",
      other: "-",
    };

    // 履歴データを整形
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

    // 診断履歴を整形
    const diagnosisHistory = (sessionsToReturn as SessionWithRelations[]).map((s) => {
      // CTA内訳を集計
      const ctaByType: Record<string, number> = {};
      for (const click of s.ctaClicks) {
        ctaByType[click.ctaType] = (ctaByType[click.ctaType] || 0) + 1;
      }

      // エリア情報を整形（都道府県 + 市区町村 + 町名）
      let area = "-";
      if (s.region && s.city && s.town) {
        area = `${s.region} ${s.city} ${s.town}`;
      } else if (s.region && s.city) {
        area = `${s.region} ${s.city}`;
      } else if (s.region) {
        area = s.region;
      } else if (s.city) {
        area = s.city;
      }

      const ctaClick = s.ctaClicks[0];

      // セッションタイプに応じた表示名を決定
      let diagnosisTypeName: string;
      if (s.sessionType === "link") {
        diagnosisTypeName = "リンクQR";
      } else {
        diagnosisTypeName = s.diagnosisType?.name || DIAGNOSIS_TYPE_NAMES[s.diagnosisType?.slug || ""] || "不明";
      }

      return {
        id: s.id,
        type: s.sessionType === "link" ? "link" as const : "diagnosis" as const,
        createdAt: s.createdAt,
        userAge: s.userAge,
        userGender: s.userGender ? GENDER_NAMES[s.userGender] || s.userGender : null,
        diagnosisType: diagnosisTypeName,
        diagnosisTypeSlug: s.diagnosisType?.slug || null,
        resultCategory: s.resultCategory,
        channelName: s.channel?.name || "不明",
        channelId: s.channel?.id,
        area,
        ctaType: ctaClick ? getCtaTypeName(ctaClick.ctaType) : null,
        ctaClickCount: s._count.ctaClicks,
        ctaByType,
      };
    });

    // QRスキャン（リンクタイプ）の履歴を取得
    type AccessLogFilterType = {
      clinicId: string;
      eventType: string;
      isDeleted: boolean;
      createdAt?: { gte: Date; lte: Date };
      channelId?: string | { in: string[] };
    };

    const accessLogFilter: AccessLogFilterType = {
      clinicId: session.clinicId,
      eventType: "qr_scan",
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

    let qrScanHistory: Array<{
      id: string;
      type: "qr_scan";
      createdAt: Date;
      userAge: null;
      userGender: null;
      diagnosisType: string;
      diagnosisTypeSlug: null;
      channelName: string;
      channelId: string | null;
      area: string;
      ctaType: null;
      ctaClickCount: number;
      ctaByType: Record<string, number>;
    }> = [];

    if (includeQRScans) {
      type AccessLogWithChannel = {
        id: string;
        createdAt: Date;
        region: string | null;
        city: string | null;
        channel: { id: string; name: string } | null;
      };

      const qrScans = await prisma.accessLog.findMany({
        where: accessLogFilter,
        include: {
          channel: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit + 1, // 次のページがあるか確認するために1件多く取得
      }) as AccessLogWithChannel[];

      qrScanHistory = qrScans.map((log: AccessLogWithChannel) => {
        let area = "-";
        if (log.region && log.city) {
          area = `${log.region} ${log.city}`;
        } else if (log.region) {
          area = log.region;
        } else if (log.city) {
          area = log.city;
        }

        return {
          id: log.id,
          type: "qr_scan" as const,
          createdAt: log.createdAt,
          userAge: null,
          userGender: null,
          diagnosisType: "QR読み込み",
          diagnosisTypeSlug: null,
          channelName: log.channel?.name || "不明",
          channelId: log.channel?.id || null,
          area,
          ctaType: null,
          ctaClickCount: 0,
          ctaByType: {},
        };
      });
    }

    // 両方の履歴を統合し、日時でソート
    const combinedHistory = [...diagnosisHistory, ...qrScanHistory].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

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
