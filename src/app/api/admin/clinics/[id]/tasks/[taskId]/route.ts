import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// タスク更新（ステータス変更・メモ更新など）
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId, taskId } = await params;

    const task = await prisma.clinicTask.findFirst({
      where: { id: taskId, clinicId },
    });

    if (!task) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    const { status, note, title, description } = body;

    const updateData: Record<string, unknown> = {};

    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (note !== undefined) updateData.note = note?.trim() || null;

    if (status !== undefined) {
      const validStatuses = ["pending", "requested", "in_progress", "completed"];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ error: "無効なステータスです" }, { status: 400 });
      }
      updateData.status = status;

      // ステータスに応じて日時を自動セット
      if (status === "requested" && !task.requestedAt) {
        updateData.requestedAt = new Date();
      }
      if (status === "completed") {
        updateData.completedAt = new Date();
      }
      // 完了から戻す場合
      if (status !== "completed" && task.completedAt) {
        updateData.completedAt = null;
      }
    }

    // 催促記録
    if (body.reminded) {
      updateData.reminderCount = task.reminderCount + 1;
      updateData.lastRemindedAt = new Date();
    }

    const updated = await prisma.clinicTask.update({
      where: { id: taskId },
      data: updateData,
    });

    return NextResponse.json({ message: "タスクを更新しました", task: updated });
  } catch (error) {
    console.error("Update clinic task error:", error);
    return NextResponse.json({ error: "タスク更新に失敗しました" }, { status: 500 });
  }
}

// タスク削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId, taskId } = await params;

    const task = await prisma.clinicTask.findFirst({
      where: { id: taskId, clinicId },
    });

    if (!task) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
    }

    await prisma.clinicTask.delete({ where: { id: taskId } });

    return NextResponse.json({ message: "タスクを削除しました" });
  } catch (error) {
    console.error("Delete clinic task error:", error);
    return NextResponse.json({ error: "タスク削除に失敗しました" }, { status: 500 });
  }
}
