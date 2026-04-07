import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// デフォルトの媒体リスト（歯科医院でよく使われる媒体）
const DEFAULT_PLATFORMS = [
  { platformName: "Googleビジネスプロフィール", priority: 0 },
  { platformName: "ホームページ", priority: 1 },
  { platformName: "EPARK歯科", priority: 2 },
  { platformName: "デンターネット", priority: 3 },
  { platformName: "Caloo（カルー）", priority: 4 },
  { platformName: "歯科タウン", priority: 5 },
  { platformName: "病院なび", priority: 6 },
  { platformName: "ドクターズ・ファイル", priority: 7 },
  { platformName: "エキテン", priority: 8 },
  { platformName: "Yahoo!プレイス", priority: 9 },
  { platformName: "Apple Maps", priority: 10 },
  { platformName: "iタウンページ", priority: 11 },
];

// デフォルト媒体を一括作成
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId } = await params;
    const body = await request.json();

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true },
    });

    if (!clinic) {
      return NextResponse.json({ error: "医院が見つかりません" }, { status: 404 });
    }

    // デフォルト媒体を一括作成
    if (body.createDefaults) {
      const existing = await prisma.napPlatform.findMany({
        where: { clinicId },
        select: { platformName: true },
      });
      const existingNames = new Set(existing.map((p: { platformName: string }) => p.platformName));

      const newPlatforms = DEFAULT_PLATFORMS.filter(
        (p) => !existingNames.has(p.platformName)
      );

      if (newPlatforms.length === 0) {
        return NextResponse.json({ message: "すべてのデフォルト媒体は既に登録済みです" });
      }

      const created = await prisma.$transaction(
        newPlatforms.map((p) =>
          prisma.napPlatform.create({
            data: { clinicId, ...p },
          })
        )
      );

      return NextResponse.json({
        message: `${created.length}件の媒体を追加しました`,
      });
    }

    // 個別の媒体を追加
    const { platformName, platformUrl } = body;

    if (!platformName || platformName.trim() === "") {
      return NextResponse.json({ error: "媒体名は必須です" }, { status: 400 });
    }

    // 最大priorityを取得して末尾に追加
    const maxPriority = await prisma.napPlatform.findFirst({
      where: { clinicId },
      orderBy: { priority: "desc" },
      select: { priority: true },
    });

    const platform = await prisma.napPlatform.create({
      data: {
        clinicId,
        platformName: platformName.trim(),
        platformUrl: platformUrl?.trim() || null,
        priority: (maxPriority?.priority ?? -1) + 1,
      },
    });

    return NextResponse.json({ message: "媒体を追加しました", platform });
  } catch (error) {
    console.error("Create NAP platform error:", error);
    return NextResponse.json({ error: "媒体の追加に失敗しました" }, { status: 500 });
  }
}
