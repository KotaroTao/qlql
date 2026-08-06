import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canCreateChannel } from "@/lib/subscription";
import { getQrAccessCountsByChannel } from "@/lib/qr-access";
import type { Channel } from "@/types/clinic";

// QRコード一覧を取得（アクティブ・非表示両方）
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

    // 期間の計算（"all"の場合はフィルタリングしない）
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (period !== "all") {
      dateTo = new Date();

      if (period === "custom" && startDate && endDate) {
        dateFrom = new Date(startDate);
        dateTo.setTime(new Date(endDate).getTime());
        dateTo.setHours(23, 59, 59, 999);
      } else {
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
    }

    const channels = (await prisma.channel.findMany({
      where: { clinicId: session.clinicId },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
    })) as Channel[];

    // 診断タイプ名を取得してマッピング
    const diagnosisSlugs = channels
      .map((c) => c.diagnosisTypeSlug)
      .filter((slug): slug is string => slug !== null);

    const diagnosisTypes = diagnosisSlugs.length > 0
      ? await prisma.diagnosisType.findMany({
          where: { slug: { in: diagnosisSlugs } },
          select: { slug: true, name: true },
        })
      : [];

    const diagnosisNameMap: Record<string, string> = {};
    for (const dt of diagnosisTypes) {
      diagnosisNameMap[dt.slug] = dt.name;
    }

    // 各チャンネルのQR読込数（実際に読み込まれた回数）を共通ルールで取得
    const channelIds = channels.map((c) => c.id);
    const scanCountMap = await getQrAccessCountsByChannel(
      channelIds,
      dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {}
    );

    // チャンネルに診断名とスキャン数を追加
    const channelsWithDiagnosisName = channels.map((c) => ({
      ...c,
      diagnosisTypeName: c.diagnosisTypeSlug
        ? diagnosisNameMap[c.diagnosisTypeSlug] || c.diagnosisTypeSlug
        : null,
      scanCount: scanCountMap[c.id] || 0,
    }));

    const activeCount = channels.filter((c) => c.isActive).length;
    const hiddenCount = channels.filter((c) => !c.isActive).length;

    // QRコード作成可能状態を取得
    const canCreate = await canCreateChannel(session.clinicId);

    return NextResponse.json({
      channels: channelsWithDiagnosisName,
      activeCount,
      hiddenCount,
      canCreateQR: canCreate.canCreate,
      remainingQRCodes: canCreate.remaining,
      limitMessage: canCreate.message,
    });
  } catch (error) {
    console.error("Get channels error:", error);
    return NextResponse.json(
      { error: "QRコードの取得に失敗しました" },
      { status: 500 }
    );
  }
}

// 新しいQRコードを作成
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // QRコード作成可能かチェック
    const canCreate = await canCreateChannel(session.clinicId);
    if (!canCreate.canCreate) {
      return NextResponse.json(
        { error: canCreate.message || "QRコードを作成できません" },
        { status: 403 }
      );
    }

    const body = await request.json();
    // 配布関連の項目 (distributionMethod / distributionQuantity / distributionPeriod / budget) は
    // Phase 2 でチラシ側に移管されたため、Channel POST API では受け付けない（送られても無視）
    const { name, displayName, description, channelType, diagnosisTypeSlug, redirectUrl, imageUrl, expiresAt, flyerId } = body;

    if (!name || name.trim() === "") {
      return NextResponse.json(
        { error: "QRコード名を入力してください" },
        { status: 400 }
      );
    }

    const type = channelType || "diagnosis";

    // 診断タイプの場合は診断スラッグが必須
    if (type === "diagnosis" && (!diagnosisTypeSlug || diagnosisTypeSlug.trim() === "")) {
      return NextResponse.json(
        { error: "診断タイプを選択してください" },
        { status: 400 }
      );
    }

    // リンクタイプの場合はリダイレクトURLが必須
    if (type === "link" && (!redirectUrl || redirectUrl.trim() === "")) {
      return NextResponse.json(
        { error: "リダイレクト先URLを入力してください" },
        { status: 400 }
      );
    }

    // チラシ紐付けは Phase 2 で必須化
    if (!flyerId || typeof flyerId !== "string" || flyerId.trim() === "") {
      return NextResponse.json(
        { error: "このQRを掲載するチラシを選択してください" },
        { status: 400 }
      );
    }

    // URL形式チェック
    if (type === "link") {
      try {
        new URL(redirectUrl);
      } catch {
        return NextResponse.json(
          { error: "有効なURLを入力してください" },
          { status: 400 }
        );
      }
    }

    // 指定されたチラシが同一医院のものかを検証
    const flyer = await prisma.flyer.findFirst({
      where: { id: flyerId, clinicId: session.clinicId },
    });
    if (!flyer) {
      return NextResponse.json(
        { error: "指定されたチラシが見つかりません" },
        { status: 400 }
      );
    }
    const resolvedFlyerId = flyer.id;

    // ユニークなコードを生成
    const code = await generateUniqueChannelCode();

    const channel = (await prisma.channel.create({
      data: {
        clinicId: session.clinicId,
        name: name.trim(),
        displayName: displayName?.trim() || null,
        description: description?.trim() || null,
        // imageUrl は Phase 2 でチラシ側に移管されたが、後方互換のため Channel 自身にも残せる
        imageUrl: imageUrl || null,
        channelType: type,
        diagnosisTypeSlug: type === "diagnosis" ? diagnosisTypeSlug.trim() : null,
        redirectUrl: type === "link" ? redirectUrl.trim() : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        // 配布情報フィールド（budget, distributionMethod など）は Phase 2 でチラシ側に移管されたため
        // Channel には null で作成する。集計はチラシの値が使われる。
        flyerId: resolvedFlyerId,
        code,
      },
    })) as Channel;

    return NextResponse.json({ channel }, { status: 201 });
  } catch (error) {
    console.error("Create channel error:", error);
    return NextResponse.json(
      { error: "QRコードの作成に失敗しました" },
      { status: 500 }
    );
  }
}

async function generateUniqueChannelCode(): Promise<string> {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const maxAttempts = 10;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // 重複チェック
    const existing = await prisma.channel.findUnique({
      where: { code },
    });

    if (!existing) {
      return code;
    }
  }

  // フォールバック: タイムスタンプベースのコード
  return Date.now().toString(36).slice(-8);
}
