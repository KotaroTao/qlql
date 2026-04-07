import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// 議事録一覧取得
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
      select: { id: true, name: true },
    });

    if (!clinic) {
      return NextResponse.json({ error: "医院が見つかりません" }, { status: 404 });
    }

    const meetings = await prisma.meetingMinutes.findMany({
      where: { clinicId },
      orderBy: { meetingDate: "desc" },
    });

    return NextResponse.json({ clinicName: clinic.name, meetings });
  } catch (error) {
    console.error("Get meetings error:", error);
    return NextResponse.json({ error: "議事録の取得に失敗しました" }, { status: 500 });
  }
}

// 議事録作成
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

    const clinic = await prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true },
    });

    if (!clinic) {
      return NextResponse.json({ error: "医院が見つかりません" }, { status: 404 });
    }

    const body = await request.json();

    if (!body.title || !body.meetingDate) {
      return NextResponse.json({ error: "タイトルとミーティング日時は必須です" }, { status: 400 });
    }

    const meeting = await prisma.meetingMinutes.create({
      data: {
        clinicId,
        meetingDate: new Date(body.meetingDate),
        title: body.title.trim(),
        content: body.content?.trim() || null,
        summary: body.summary?.trim() || null,
        ourStaff: body.ourStaff?.trim() || null,
        clinicAttendees: body.clinicAttendees?.trim() || null,
        zoomUrl: body.zoomUrl?.trim() || null,
        recordingUrl: body.recordingUrl?.trim() || null,
        nextActions: body.nextActions?.trim() || null,
        isVisibleToClinic: body.isVisibleToClinic ?? true,
      },
    });

    return NextResponse.json({ message: "議事録を作成しました", meeting });
  } catch (error) {
    console.error("Create meeting error:", error);
    return NextResponse.json({ error: "議事録の作成に失敗しました" }, { status: 500 });
  }
}
