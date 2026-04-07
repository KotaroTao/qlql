import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// 媒体を更新（ステータス・メモなど）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; platformId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId, platformId } = await params;

    const platform = await prisma.napPlatform.findFirst({
      where: { id: platformId, clinicId },
    });

    if (!platform) {
      return NextResponse.json({ error: "媒体が見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.platformName !== undefined) updateData.platformName = body.platformName.trim();
    if (body.platformUrl !== undefined) updateData.platformUrl = body.platformUrl?.trim() || null;
    if (body.note !== undefined) updateData.note = body.note?.trim() || null;

    // NAP一致状態の更新
    const validNapStatuses = ["unchecked", "match", "mismatch"];
    for (const field of ["nameStatus", "addressStatus", "phoneStatus"] as const) {
      if (body[field] !== undefined && validNapStatuses.includes(body[field])) {
        updateData[field] = body[field];
      }
    }

    // 全体ステータスの更新
    if (body.status !== undefined) {
      const validPlatformStatuses = ["unchecked", "ok", "requested", "completed"];
      if (validPlatformStatuses.includes(body.status)) {
        updateData.status = body.status;
        if (body.status === "requested" && !platform.requestedAt) {
          updateData.requestedAt = new Date();
        }
        if (body.status === "completed") {
          updateData.completedAt = new Date();
        }
        if (body.status !== "completed" && platform.completedAt) {
          updateData.completedAt = null;
        }
      }
    }

    // 催促記録
    if (body.reminded) {
      updateData.reminderCount = platform.reminderCount + 1;
      updateData.lastRemindedAt = new Date();
    }

    const updated = await prisma.napPlatform.update({
      where: { id: platformId },
      data: updateData,
    });

    return NextResponse.json({ message: "媒体を更新しました", platform: updated });
  } catch (error) {
    console.error("Update NAP platform error:", error);
    return NextResponse.json({ error: "媒体の更新に失敗しました" }, { status: 500 });
  }
}

// 媒体を削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; platformId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId, platformId } = await params;

    const platform = await prisma.napPlatform.findFirst({
      where: { id: platformId, clinicId },
    });

    if (!platform) {
      return NextResponse.json({ error: "媒体が見つかりません" }, { status: 404 });
    }

    await prisma.napPlatform.delete({ where: { id: platformId } });

    return NextResponse.json({ message: "媒体を削除しました" });
  } catch (error) {
    console.error("Delete NAP platform error:", error);
    return NextResponse.json({ error: "媒体の削除に失敗しました" }, { status: 500 });
  }
}
