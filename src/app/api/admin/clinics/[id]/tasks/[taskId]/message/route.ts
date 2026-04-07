import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

// メッセージテンプレート生成
// messageType: "request"(依頼), "reminder"(催促), "thanks"(お礼)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId, taskId } = await params;
    const { searchParams } = new URL(request.url);
    const messageType = searchParams.get("type") || "request";

    const task = await prisma.clinicTask.findFirst({
      where: { id: taskId, clinicId },
      include: {
        clinic: { select: { name: true } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
    }

    const clinicName = task.clinic.name;
    const message = generateMessage(messageType, task.taskType, task.title, clinicName, task.reminderCount);

    return NextResponse.json({ message, messageType });
  } catch (error) {
    console.error("Generate message error:", error);
    return NextResponse.json({ error: "メッセージ生成に失敗しました" }, { status: 500 });
  }
}

function generateMessage(
  messageType: string,
  taskType: string,
  taskTitle: string,
  clinicName: string,
  reminderCount: number
): string {
  switch (messageType) {
    case "request":
      return generateRequestMessage(taskType, taskTitle, clinicName);
    case "reminder":
      return generateReminderMessage(taskType, taskTitle, clinicName, reminderCount);
    case "thanks":
      return generateThanksMessage(taskType, taskTitle, clinicName);
    default:
      return generateRequestMessage(taskType, taskTitle, clinicName);
  }
}

function generateRequestMessage(taskType: string, taskTitle: string, clinicName: string): string {
  if (taskType === "hp_name_change") {
    return `${clinicName}様

お世話になっております。

NAP（医院名・住所・電話番号）統一作業を進めるにあたり、まずホームページに記載されている医院名の変更をお願いしたくご連絡いたしました。

■ ご対応いただきたいこと
ホームページ内に記載されている医院名を、正式名称に統一してください。
（ヘッダー、フッター、タイトルタグ、お問い合わせページなど、すべての箇所が対象です）

■ なぜ必要なのか
各媒体で医院名が異なっていると、Googleなどの検索エンジンが「別の医院」と認識してしまい、検索順位が下がる原因になります。まずホームページの医院名を正しくすることが、NAP統一の第一歩です。

ホームページの管理会社にご依頼いただく形で問題ございません。
ご対応いただけましたら、ご一報いただけますと幸いです。

よろしくお願いいたします。`;
  }

  if (taskType === "gbp_name_change") {
    return `${clinicName}様

お世話になっております。

NAP統一作業の一環として、Googleビジネスプロフィール（旧Googleマイビジネス）の医院名変更をお願いしたくご連絡いたしました。

■ ご対応いただきたいこと
Googleビジネスプロフィールにログインし、医院名を正式名称に変更してください。

■ 変更手順
1. Google検索で「Googleビジネスプロフィール」と検索し、管理画面にログイン
2. 「ビジネス情報の編集」→「ビジネス名」をクリック
3. 正式な医院名に変更して保存

※ 変更が反映されるまで数日かかる場合があります。
※ ご不明な点があればお気軽にお聞きください。

ご対応いただけましたら、ご一報いただけますと幸いです。

よろしくお願いいたします。`;
  }

  // その他のタスク
  return `${clinicName}様

お世話になっております。

以下の件についてご対応をお願いしたくご連絡いたしました。

■ ご対応いただきたいこと
${taskTitle}

ご対応いただけましたら、ご一報いただけますと幸いです。

よろしくお願いいたします。`;
}

function generateReminderMessage(taskType: string, taskTitle: string, clinicName: string, reminderCount: number): string {
  const ordinal = reminderCount === 0 ? "" : `（${reminderCount + 1}回目）`;

  if (taskType === "hp_name_change") {
    return `${clinicName}様

お世話になっております。
先日お願いしておりました、ホームページ内の医院名変更の件${ordinal}について、進捗はいかがでしょうか。

NAP統一作業を進めるために必要なステップとなりますので、お手数ですがご確認いただけますと幸いです。

ホームページの管理会社へのご依頼がまだの場合は、お早めにご連絡いただければと思います。
ご不明点などございましたら、お気軽にご相談ください。

よろしくお願いいたします。`;
  }

  if (taskType === "gbp_name_change") {
    return `${clinicName}様

お世話になっております。
先日お願いしておりました、Googleビジネスプロフィールの医院名変更の件${ordinal}について、進捗はいかがでしょうか。

操作方法がご不明でしたら、画面共有でのサポートも可能ですので、お気軽にお申し付けください。

よろしくお願いいたします。`;
  }

  return `${clinicName}様

お世話になっております。
先日お願いしておりました「${taskTitle}」の件${ordinal}について、進捗はいかがでしょうか。

お手数ですが、ご確認いただけますと幸いです。
ご不明点がございましたら、お気軽にご相談ください。

よろしくお願いいたします。`;
}

function generateThanksMessage(taskType: string, taskTitle: string, clinicName: string): string {
  if (taskType === "hp_name_change") {
    return `${clinicName}様

ホームページの医院名変更にご対応いただき、ありがとうございます。
確認いたしました。

これでNAP統一作業の次のステップに進めます。
引き続きよろしくお願いいたします。`;
  }

  if (taskType === "gbp_name_change") {
    return `${clinicName}様

Googleビジネスプロフィールの医院名変更にご対応いただき、ありがとうございます。
反映まで数日かかる場合がありますが、こちらでも確認してまいります。

引き続きよろしくお願いいたします。`;
  }

  return `${clinicName}様

「${taskTitle}」にご対応いただき、ありがとうございます。
確認いたしました。

引き続きよろしくお願いいたします。`;
}
