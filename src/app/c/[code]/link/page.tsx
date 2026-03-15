import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { checkSubscription } from "@/lib/subscription";
import { LinkProfileForm } from "@/components/link/link-profile-form";
import { ExpiredPage } from "@/components/channel/expired-page";
import { getChannelPublicName } from "@/lib/channel-display";
import type { Channel, Clinic } from "@/types/clinic";

interface Props {
  params: Promise<{
    code: string;
  }>;
}

interface ChannelResult {
  channel: Channel & { redirectUrl: string };
  clinic: Clinic;
  isExpired: boolean;
}

async function getChannelAndClinic(code: string): Promise<ChannelResult | null> {
  // チャンネルを取得
  const channel = await prisma.channel.findUnique({
    where: { code },
  });

  if (!channel || !channel.isActive) {
    return null;
  }

  // linkタイプでない場合はnull
  if (channel.channelType !== "link" || !channel.redirectUrl) {
    return null;
  }

  // 医院情報を取得
  const clinic = await prisma.clinic.findUnique({
    where: { id: channel.clinicId },
  });

  if (!clinic) {
    return null;
  }

  // サブスクリプション状態をチェック
  const subscriptionCheck = await checkSubscription(clinic.id);
  if (!subscriptionCheck.isActive) {
    return null;
  }

  // 有効期限チェック
  const isExpired = channel.expiresAt ? new Date() > new Date(channel.expiresAt) : false;

  return {
    channel: channel as Channel & { redirectUrl: string },
    clinic: clinic as Clinic,
    isExpired,
  };
}

export default async function LinkProfilePage({ params }: Props) {
  const { code } = await params;

  // チャンネルと医院情報を取得
  const data = await getChannelAndClinic(code);
  if (!data) {
    notFound();
  }

  const { channel, clinic, isExpired } = data;

  // 有効期限切れの場合
  if (isExpired) {
    return <ExpiredPage clinicName={clinic.name} logoUrl={clinic.logoUrl} />;
  }

  return (
    <main
      className="min-h-screen"
      style={{ backgroundColor: clinic.mainColor + "10" }}
    >
      {/* 医院ヘッダー */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            {clinic.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clinic.logoUrl}
                alt={clinic.name}
                className="h-8 w-auto"
              />
            )}
            <span className="font-medium text-gray-800">{clinic.name}</span>
          </div>
        </div>
      </header>

      {/* プロファイル入力フォーム */}
      <div className="container mx-auto px-4 py-8 max-w-md">
        <LinkProfileForm
          channelId={channel.id}
          channelPublicName={getChannelPublicName(channel)}
          redirectUrl={channel.redirectUrl}
          mainColor={clinic.mainColor}
        />
      </div>
    </main>
  );
}

// 静的生成を無効化（動的ルート）
export const dynamic = "force-dynamic";
