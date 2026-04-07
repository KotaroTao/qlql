import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// 議事録更新
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId, meetingId } = await params;

    const meeting = await prisma.meetingMinutes.findFirst({
      where: { id: meetingId, clinicId },
    });

    if (!meeting) {
      return NextResponse.json({ error: "議事録が見つかりません" }, { status: 404 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.title !== undefined) updateData.title = body.title.trim();
    if (body.meetingDate !== undefined) updateData.meetingDate = new Date(body.meetingDate);
    if (body.content !== undefined) updateData.content = body.content?.trim() || null;
    if (body.summary !== undefined) updateData.summary = body.summary?.trim() || null;
    if (body.ourStaff !== undefined) updateData.ourStaff = body.ourStaff?.trim() || null;
    if (body.clinicAttendees !== undefined) updateData.clinicAttendees = body.clinicAttendees?.trim() || null;
    if (body.zoomUrl !== undefined) updateData.zoomUrl = body.zoomUrl?.trim() || null;
    if (body.recordingUrl !== undefined) updateData.recordingUrl = body.recordingUrl?.trim() || null;
    if (body.nextActions !== undefined) updateData.nextActions = body.nextActions?.trim() || null;
    if (body.isVisibleToClinic !== undefined) updateData.isVisibleToClinic = body.isVisibleToClinic;

    const updated = await prisma.meetingMinutes.update({
      where: { id: meetingId },
      data: updateData,
    });

    return NextResponse.json({ message: "議事録を更新しました", meeting: updated });
  } catch (error) {
    console.error("Update meeting error:", error);
    return NextResponse.json({ error: "議事録の更新に失敗しました" }, { status: 500 });
  }
}

// 議事録削除
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; meetingId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId, meetingId } = await params;

    const meeting = await prisma.meetingMinutes.findFirst({
      where: { id: meetingId, clinicId },
    });

    if (!meeting) {
      return NextResponse.json({ error: "議事録が見つかりません" }, { status: 404 });
    }

    await prisma.meetingMinutes.delete({ where: { id: meetingId } });

    return NextResponse.json({ message: "議事録を削除しました" });
  } catch (error) {
    console.error("Delete meeting error:", error);
    return NextResponse.json({ error: "議事録の削除に失敗しました" }, { status: 500 });
  }
}
