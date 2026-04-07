import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

interface NapInfo {
  officialName?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  address?: string;
  building?: string;
  phone?: string;
  fax?: string;
  url?: string;
}

// 媒体別のメッセージ生成
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; platformId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: clinicId, platformId } = await params;
    const { searchParams } = new URL(request.url);
    const messageType = searchParams.get("type") || "request";

    const platform = await prisma.napPlatform.findFirst({
      where: { id: platformId, clinicId },
      include: {
        clinic: { select: { name: true, napInfo: true } },
      },
    });

    if (!platform) {
      return NextResponse.json({ error: "媒体が見つかりません" }, { status: 404 });
    }

    const clinicName = platform.clinic.name;
    const napInfo = platform.clinic.napInfo as NapInfo;
    const message = generateMessage(
      messageType,
      platform.platformName,
      clinicName,
      napInfo,
      platform.nameStatus,
      platform.addressStatus,
      platform.phoneStatus,
      platform.reminderCount
    );

    return NextResponse.json({ message, messageType });
  } catch (error) {
    console.error("Generate platform message error:", error);
    return NextResponse.json({ error: "メッセージ生成に失敗しました" }, { status: 500 });
  }
}

function generateMessage(
  messageType: string,
  platformName: string,
  clinicName: string,
  napInfo: NapInfo,
  nameStatus: string,
  addressStatus: string,
  phoneStatus: string,
  reminderCount: number
): string {
  switch (messageType) {
    case "request":
      return generateRequestMessage(platformName, clinicName, napInfo, nameStatus, addressStatus, phoneStatus);
    case "reminder":
      return generateReminderMessage(platformName, clinicName, reminderCount);
    case "thanks":
      return generateThanksMessage(platformName, clinicName);
    default:
      return generateRequestMessage(platformName, clinicName, napInfo, nameStatus, addressStatus, phoneStatus);
  }
}

function formatNapInfo(napInfo: NapInfo): string {
  const lines: string[] = [];
  if (napInfo.officialName) lines.push(`医院名: ${napInfo.officialName}`);
  const addr = [napInfo.postalCode ? `〒${napInfo.postalCode}` : "", napInfo.prefecture, napInfo.city, napInfo.address, napInfo.building].filter(Boolean).join(" ");
  if (addr.trim()) lines.push(`住所: ${addr.trim()}`);
  if (napInfo.phone) lines.push(`電話番号: ${napInfo.phone}`);
  return lines.join("\n");
}

function getMismatchItems(nameStatus: string, addressStatus: string, phoneStatus: string): string[] {
  const items: string[] = [];
  if (nameStatus === "mismatch") items.push("医院名");
  if (addressStatus === "mismatch") items.push("住所");
  if (phoneStatus === "mismatch") items.push("電話番号");
  return items;
}

function generateRequestMessage(
  platformName: string,
  clinicName: string,
  napInfo: NapInfo,
  nameStatus: string,
  addressStatus: string,
  phoneStatus: string
): string {
  const mismatchItems = getMismatchItems(nameStatus, addressStatus, phoneStatus);
  const mismatchText = mismatchItems.length > 0
    ? mismatchItems.join("・")
    : "医院名・住所・電話番号";

  const napText = formatNapInfo(napInfo);

  // 自分で修正できる媒体（GBP等）
  const selfServicePlatforms = ["Googleビジネスプロフィール", "Apple Maps"];
  const isSelfService = selfServicePlatforms.includes(platformName);

  if (isSelfService) {
    return `${clinicName}様

お世話になっております。

NAP（医院名・住所・電話番号）統一作業の一環として、「${platformName}」に登録されている情報の修正をお願いいたします。

■ 修正が必要な項目
${mismatchText}

■ 正しい情報
${napText || "（正式NAP情報を設定してください）"}

お手数ですが、管理画面にログインして上記の通り修正をお願いいたします。
ご対応いただけましたら、ご一報いただけますと幸いです。

よろしくお願いいたします。`;
  }

  // ポータルサイト等（運営に修正依頼が必要な場合）
  return `${clinicName}様

お世話になっております。

NAP（医院名・住所・電話番号）統一作業の一環として、「${platformName}」に掲載されている情報に相違がございましたのでご連絡いたします。

■ 修正が必要な項目
${mismatchText}

■ 正しい情報
${napText || "（正式NAP情報を設定してください）"}

${platformName}の運営へ情報修正の依頼をお願いいたします。
修正方法がご不明な場合はサポートいたしますので、お気軽にお申し付けください。

ご対応いただけましたら、ご一報いただけますと幸いです。

よろしくお願いいたします。`;
}

function generateReminderMessage(platformName: string, clinicName: string, reminderCount: number): string {
  const ordinal = reminderCount === 0 ? "" : `（${reminderCount + 1}回目）`;

  return `${clinicName}様

お世話になっております。
先日お願いしておりました「${platformName}」の情報修正の件${ordinal}について、進捗はいかがでしょうか。

NAP情報の統一は検索順位に影響する重要な作業となりますので、お手数ですがご確認いただけますと幸いです。

ご不明点やお困りのことがございましたら、お気軽にご相談ください。

よろしくお願いいたします。`;
}

function generateThanksMessage(platformName: string, clinicName: string): string {
  return `${clinicName}様

「${platformName}」の情報修正にご対応いただき、ありがとうございます。
確認いたしました。

引き続きよろしくお願いいたします。`;
}
