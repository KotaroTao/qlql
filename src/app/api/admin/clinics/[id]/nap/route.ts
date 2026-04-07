import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// NAP情報 + タスク + 媒体を一括取得
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

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true, napInfo: true },
    });

    if (!clinic) {
      return NextResponse.json({ error: "医院が見つかりません" }, { status: 404 });
    }

    const [tasks, platforms] = await Promise.all([
      prisma.clinicTask.findMany({
        where: { clinicId },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      }),
      prisma.napPlatform.findMany({
        where: { clinicId },
        orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
      }),
    ]);

    return NextResponse.json({
      clinicName: clinic.name,
      napInfo: clinic.napInfo,
      tasks,
      platforms,
    });
  } catch (error) {
    console.error("Get NAP data error:", error);
    return NextResponse.json({ error: "NAP情報の取得に失敗しました" }, { status: 500 });
  }
}

// 正式NAP情報を更新
export async function PATCH(
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

    const napInfo = {
      officialName: body.officialName?.trim() || "",
      postalCode: body.postalCode?.trim() || "",
      prefecture: body.prefecture?.trim() || "",
      city: body.city?.trim() || "",
      address: body.address?.trim() || "",
      building: body.building?.trim() || "",
      phone: body.phone?.trim() || "",
      fax: body.fax?.trim() || "",
      url: body.url?.trim() || "",
    };

    await prisma.clinic.update({
      where: { id: clinicId },
      data: { napInfo },
    });

    return NextResponse.json({ message: "正式NAP情報を更新しました", napInfo });
  } catch (error) {
    console.error("Update NAP info error:", error);
    return NextResponse.json({ error: "NAP情報の更新に失敗しました" }, { status: 500 });
  }
}
