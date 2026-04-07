import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// デフォルトのタスクテンプレート（新規医院に一括作成するときに使う）
const DEFAULT_TASK_TEMPLATES = [
  {
    taskType: "hp_name_change",
    title: "ホームページ内の医院名変更",
    description: "ホームページに記載されている医院名を正式名称に統一してください。",
    priority: 0,
  },
  {
    taskType: "gbp_name_change",
    title: "Googleビジネスプロフィールの医院名変更",
    description: "Googleビジネスプロフィール（旧Googleマイビジネス）の医院名を正式名称に変更してください。",
    priority: 1,
  },
];

// タスク一覧取得
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

    const tasks = await prisma.clinicTask.findMany({
      where: { clinicId },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json({ clinicName: clinic.name, tasks });
  } catch (error) {
    console.error("Get clinic tasks error:", error);
    return NextResponse.json({ error: "タスク取得に失敗しました" }, { status: 500 });
  }
}

// タスク作成（単体 or デフォルト一括作成）
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

    // デフォルトタスクを一括作成
    if (body.createDefaults) {
      const existingTypes = await prisma.clinicTask.findMany({
        where: { clinicId },
        select: { taskType: true },
      });
      const existingTypeSet = new Set(existingTypes.map((t: { taskType: string }) => t.taskType));

      const newTasks = DEFAULT_TASK_TEMPLATES.filter(
        (t) => !existingTypeSet.has(t.taskType)
      );

      if (newTasks.length === 0) {
        return NextResponse.json({ message: "すべてのデフォルトタスクは既に存在します", tasks: [] });
      }

      const created = await prisma.$transaction(
        newTasks.map((t) =>
          prisma.clinicTask.create({
            data: { clinicId, ...t },
          })
        )
      );

      return NextResponse.json({ message: `${created.length}件のタスクを作成しました`, tasks: created });
    }

    // 単体タスク作成
    const { taskType, title, description, priority } = body;

    if (!taskType || !title) {
      return NextResponse.json({ error: "タスク種別とタイトルは必須です" }, { status: 400 });
    }

    const task = await prisma.clinicTask.create({
      data: {
        clinicId,
        taskType,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority ?? 99,
      },
    });

    return NextResponse.json({ message: "タスクを作成しました", task });
  } catch (error) {
    console.error("Create clinic task error:", error);
    return NextResponse.json({ error: "タスク作成に失敗しました" }, { status: 500 });
  }
}
