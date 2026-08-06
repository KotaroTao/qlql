import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSubscriptionState } from "@/lib/subscription";
import { getQrAccessCountsByChannel } from "@/lib/qr-access";

// 医院に属するチラシ一覧を取得
// 各チラシに紐付くQRごとの「QR名 / スキャン数」も併せて返す
// （/dashboard/flyers 画面で 1QR 1行 表示するための情報）
// クエリパラメータ period（today/week/month/all/custom）でスキャン集計対象期間を絞れる。
// custom の場合は startDate / endDate（YYYY-MM-DD）も併せて指定する。
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // 期間フィルタを構築（既存の /api/channels と同じパターン）
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all";
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");

    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;
    if (period !== "all") {
      dateTo = new Date();
      if (period === "custom" && startDateParam && endDateParam) {
        dateFrom = new Date(startDateParam);
        dateTo = new Date(endDateParam);
        dateTo.setHours(23, 59, 59, 999);
      } else if (period === "today") {
        dateFrom = new Date();
        dateFrom.setHours(0, 0, 0, 0);
      } else if (period === "week") {
        dateFrom = new Date();
        dateFrom.setDate(dateFrom.getDate() - 7);
        dateFrom.setHours(0, 0, 0, 0);
      } else {
        // month（デフォルト）
        dateFrom = new Date();
        dateFrom.setMonth(dateFrom.getMonth() - 1);
        dateFrom.setHours(0, 0, 0, 0);
      }
    }
    const dateRangeFilter =
      dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {};

    type FlyerWithChannels = {
      id: string;
      name: string;
      description: string | null;
      distributionMethod: string | null;
      distributionQuantity: number | null;
      distributionPeriod: string | null;
      budget: number | null;
      imageUrl: string | null;
      imageUrl2: string | null;
      createdAt: Date;
      updatedAt: Date;
      channels: Array<{
        id: string;
        name: string;
        channelType: string;
        isActive: boolean;
      }>;
    };

    const flyers = (await prisma.flyer.findMany({
      where: { clinicId: session.clinicId },
      orderBy: { createdAt: "desc" },
      include: {
        channels: {
          // 非表示（isActive=false）も含めて返す。
          // 非表示にした後にUIで再表示できるよう、一覧から消えないようにするため。
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            name: true,
            channelType: true,
            isActive: true,
          },
        },
      },
    })) as unknown as FlyerWithChannels[];

    // 全チラシに紐付く全Channel IDを集めて、一括でスキャン関連カウントを取得
    const channelIds = flyers.flatMap((f) => f.channels.map((c) => c.id));

    // 各 Channel ごとの「QRアクセス」= 実際にQRが読み込まれた回数。
    // 数え方は src/lib/qr-access.ts に集約（ダッシュボード・共有ページ・管理画面と共通）。
    // 画面下部の「QR読み込み履歴」の件数とも必ず一致する。
    const channelScansMap = await getQrAccessCountsByChannel(
      channelIds,
      dateRangeFilter
    );

    return NextResponse.json({
      flyers: flyers.map((f) => ({
        id: f.id,
        name: f.name,
        description: f.description,
        distributionMethod: f.distributionMethod,
        distributionQuantity: f.distributionQuantity,
        distributionPeriod: f.distributionPeriod,
        budget: f.budget,
        imageUrl: f.imageUrl,
        imageUrl2: f.imageUrl2,
        channelCount: f.channels.length,
        channels: f.channels.map((c) => ({
          id: c.id,
          name: c.name,
          channelType: c.channelType,
          // isActive をレスポンスに含める。これが抜けていたためフロント側で
          // ch.isActive=undefined となり、有効なQRも「非表示」と誤判定されていた。
          isActive: c.isActive,
          scans: channelScansMap[c.id] || 0,
        })),
        createdAt: f.createdAt,
        updatedAt: f.updatedAt,
      })),
    });
  } catch (error) {
    console.error("List flyers error:", error);
    return NextResponse.json(
      { error: "チラシ一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// チラシを新規作成
// 必須項目: name / distributionMethod / imageUrl（表面画像）
// 任意項目: imageUrl2（裏面画像） / distributionQuantity / distributionPeriod / budget / description
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const subscriptionState = await getSubscriptionState(session.clinicId);
    if (subscriptionState.isDemo) {
      return NextResponse.json(
        { error: "デモアカウントではチラシの作成はできません。" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      distributionMethod,
      distributionQuantity,
      distributionPeriod,
      budget,
      imageUrl,
      imageUrl2,
    } = body;

    // 必須: チラシ名
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "チラシ名を入力してください" },
        { status: 400 }
      );
    }

    // 必須: 配布方法
    if (!distributionMethod || typeof distributionMethod !== "string" || distributionMethod.trim() === "") {
      return NextResponse.json(
        { error: "配布方法を選択してください" },
        { status: 400 }
      );
    }

    // 必須: チラシ表面画像（裏面は任意）
    if (!imageUrl || typeof imageUrl !== "string" || imageUrl.trim() === "") {
      return NextResponse.json(
        { error: "チラシ表面の画像をアップロードしてください" },
        { status: 400 }
      );
    }

    const flyer = await prisma.flyer.create({
      data: {
        clinicId: session.clinicId,
        name: name.trim(),
        description: description?.trim() || null,
        distributionMethod: distributionMethod.trim(),
        distributionQuantity:
          distributionQuantity !== null && distributionQuantity !== "" && distributionQuantity !== undefined
            ? parseInt(String(distributionQuantity), 10)
            : null,
        distributionPeriod: distributionPeriod?.trim() || null,
        budget:
          budget !== null && budget !== "" && budget !== undefined
            ? parseInt(String(budget), 10)
            : null,
        imageUrl: imageUrl,
        imageUrl2: imageUrl2 || null,
      },
    });

    return NextResponse.json({ flyer });
  } catch (error) {
    console.error("Create flyer error:", error);
    return NextResponse.json(
      { error: "チラシの作成に失敗しました" },
      { status: 500 }
    );
  }
}
