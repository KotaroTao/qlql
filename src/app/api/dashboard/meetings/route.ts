import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// クライアント用: 自院の議事録一覧を取得（isVisibleToClinic=trueのみ）
export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const meetings = await prisma.meetingMinutes.findMany({
      where: {
        clinicId: session.clinicId,
        isVisibleToClinic: true,
      },
      orderBy: { meetingDate: "desc" },
      select: {
        id: true,
        meetingDate: true,
        title: true,
        content: true,
        summary: true,
        ourStaff: true,
        clinicAttendees: true,
        zoomUrl: true,
        recordingUrl: true,
        nextActions: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ meetings });
  } catch (error) {
    console.error("Get client meetings error:", error);
    return NextResponse.json({ error: "議事録の取得に失敗しました" }, { status: 500 });
  }
}
