import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { checkSubscription, canTrackSession } from "@/lib/subscription";
import { getClientIP } from "@/lib/geolocation";
import { setQrScanCookie } from "@/lib/qr-scan-link";

// ベースURLを取得（環境変数優先、フォールバックはrequest.url）
function getBaseUrl(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
}

// bot/プリフェッチ判定（簡易版）
// → スキャンしていない裏のリクエストを反応率にカウントしないためのフィルタ
function isBotOrPrefetch(request: NextRequest): boolean {
  const ua = (request.headers.get("user-agent") || "").toLowerCase();
  if (!ua) return true; // UA無しは安全側でbot扱い
  const botPatterns = [
    "bot",
    "crawler",
    "spider",
    "slurp",
    "preview",
    "fetch",
    "monitor",
    "pingdom",
    "sentry",
    "headlesschrome",
    "lighthouse",
    "embedly",
  ];
  if (botPatterns.some((p) => ua.includes(p))) return true;

  // ブラウザのリンクプリフェッチ系ヘッダ
  const purpose = (
    request.headers.get("purpose") ||
    request.headers.get("sec-purpose") ||
    request.headers.get("x-purpose") ||
    ""
  ).toLowerCase();
  if (purpose.includes("prefetch") || purpose.includes("prerender")) return true;

  return false;
}

// QRスキャン1件を記録（失敗してもリダイレクトは妨げない）
// 作成したログのIDを返す。あとで診断/入力の完了セッションと結び付けるために使う。
async function recordQrScan(
  request: NextRequest,
  channelId: string,
  clinicId: string
): Promise<string | null> {
  try {
    const ip = getClientIP(request);
    const log = await prisma.accessLog.create({
      data: {
        clinicId,
        channelId,
        eventType: "qr_scan",
        userAgent: request.headers.get("user-agent")?.slice(0, 500) || null,
        referer: request.headers.get("referer")?.slice(0, 500) || null,
        ipAddress: ip !== "unknown" ? ip : null,
        // 位置情報（country/region/city）は後段の page_view 側で記録される
        // QRスキャン時は外部API呼び出しを避けてリダイレクトを高速化
      },
      select: { id: true },
    });
    return log.id;
  } catch (error) {
    // トラッキング失敗はユーザー体験を絶対に壊さない
    console.error("QR scan tracking error:", error);
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const baseUrl = getBaseUrl(request);

  try {
    // チャンネルを取得
    const channel = await prisma.channel.findUnique({
      where: { code },
    });

    if (!channel || !channel.isActive) {
      return NextResponse.redirect(`${baseUrl}/`);
    }

    // サブスクリプション状態をチェック
    const subscriptionCheck = await checkSubscription(channel.clinicId);
    if (!subscriptionCheck.isActive) {
      return NextResponse.redirect(`${baseUrl}/`);
    }

    // 有効期限チェック
    if (channel.expiresAt && new Date() > new Date(channel.expiresAt)) {
      // 期限切れの場合は期限切れページへ
      return NextResponse.redirect(`${baseUrl}/c/${code}/expired`);
    }

    // ★ QRスキャンを記録（bot/プリフェッチは除外、契約状態が計測可能な場合のみ）
    // diagnosis/link 両方のタイプで「スキャンされた瞬間」をここで1件カウントする
    // → これまでは診断ページ到達時にしかカウントされず、プロフィール入力前で
    //   離脱したユーザーが分母に入っていなかった（反応率が実態より低く出ていた）
    // canTrackSession は checkSubscription より厳しく、grace_period では false を返す。
    // ユーザーの遷移自体は止めず（リダイレクトは継続）、AccessLog のみスキップする。
    let scanLogId: string | null = null;
    if (!isBotOrPrefetch(request)) {
      const canTrack = await canTrackSession(channel.clinicId);
      if (canTrack) {
        scanLogId = await recordQrScan(request, channel.id, channel.clinicId);
      }
    }

    // 遷移先を決めてリダイレクトを作る。
    // 記録できた読み込みログのIDはCookieに載せて次のページへ運び、
    // 診断/入力の完了時に「この読み込みの続き」として紐付ける。
    // → 集計時に「読み込み1件 + 完了1件 = 2件」と二重に数えるのを防ぐ
    let destination = `${baseUrl}/`;
    if (channel.channelType === "diagnosis" && channel.diagnosisTypeSlug) {
      // diagnosisタイプの場合 → プロファイル入力ページへ
      destination = `${baseUrl}/c/${code}/profile`;
    } else if (channel.channelType === "link" && channel.redirectUrl) {
      // linkタイプの場合 → プロファイル入力ページへ
      destination = `${baseUrl}/c/${code}/link`;
    }

    const response = NextResponse.redirect(destination);
    if (scanLogId) {
      setQrScanCookie(response, channel.id, scanLogId);
    }
    return response;
  } catch (error) {
    console.error("Channel redirect error:", error);
    return NextResponse.redirect(`${baseUrl}/`);
  }
}
