// QR読み込み（AccessLog の qr_scan）と、その後に完了した診断/入力セッションを
// 結び付けるための仕組み。
//
// なぜ必要か:
//   1人がQRを読み込んで診断まで終えると、DBには「読み込みログ」と「完了セッション」の
//   2レコードが残る。両者を結ぶ情報が無いと、集計時に同じ1人の行動を2回数えてしまう。
//   そこで、読み込んだ瞬間に発行したログのIDをCookie（ブラウザに一時的に持たせるメモ）で
//   診断ページまで運び、完了時にセッションへ書き込んで「同じ行動」だと分かるようにする。
//
// Cookie の中身は `チャネルID:ログID` の形。チャネルIDも入れておくことで、
// 別のQRを読み込んだ直後に古いCookieが誤って使われるのを防ぐ。
import type { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const QR_SCAN_COOKIE = "qr_scan_ref";

// Cookie の有効期間（秒）。診断は数分で終わる想定だが、
// 途中で中断して戻ってくるケースも拾えるよう少し長めに 2 時間。
const QR_SCAN_COOKIE_MAX_AGE = 2 * 60 * 60;

/**
 * QR読み込み直後のレスポンス（リダイレクト）に、読み込みログのIDをCookieとして載せる。
 * httpOnly にしているのでブラウザのJavaScriptからは読めず、
 * 同一サイトへのリクエスト時にサーバーだけが受け取れる。
 */
export function setQrScanCookie(
  response: NextResponse,
  channelId: string,
  accessLogId: string
): void {
  response.cookies.set(QR_SCAN_COOKIE, `${channelId}:${accessLogId}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: QR_SCAN_COOKIE_MAX_AGE,
  });
}

/**
 * 完了レスポンスでCookieを消す。
 * 1回の読み込みが2件のセッションに紐付かないよう、使い切ったら捨てる。
 */
export function clearQrScanCookie(response: NextResponse): void {
  response.cookies.set(QR_SCAN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * リクエストのCookieから「このチャネルの読み込みログID」を取り出す。
 *
 * 次の場合は null を返す（＝紐付けなしでセッションを作る）:
 *   - Cookie が無い / 形式が壊れている
 *   - 別チャネルのQRを読み込んだときのCookieが残っている
 *   - ログが実在しない、別チャネルのログ、削除済み、qr_scan 以外
 *   - すでに別のセッションに紐付いている（1読み込み=1セッション）
 */
export async function resolveScanLogId(
  request: NextRequest,
  channelId: string
): Promise<string | null> {
  const raw = request.cookies.get(QR_SCAN_COOKIE)?.value;
  if (!raw) return null;

  const separatorIndex = raw.indexOf(":");
  if (separatorIndex <= 0) return null;

  const cookieChannelId = raw.slice(0, separatorIndex);
  const accessLogId = raw.slice(separatorIndex + 1);
  if (!accessLogId || cookieChannelId !== channelId) return null;

  try {
    const log = await prisma.accessLog.findFirst({
      where: {
        id: accessLogId,
        channelId,
        eventType: "qr_scan",
        isDeleted: false,
        // 既に別セッションに使われていれば紐付けない
        session: { is: null },
      },
      select: { id: true },
    });
    return log?.id ?? null;
  } catch (error) {
    // 紐付けはあくまで集計精度の向上が目的。失敗してもセッション記録は続行する
    console.error("Failed to resolve QR scan link:", error);
    return null;
  }
}

// Prisma のユニーク制約違反（同じ読み込みIDが二重に使われた）かどうか
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/**
 * 診断/入力セッションを作成する。読み込みログIDが取れていれば紐付ける。
 *
 * ごく稀に、同じCookieを持った2つのタブがほぼ同時に完了して
 * 同じ読み込みIDを取り合うことがある。その場合は紐付けを諦めて
 * 「紐付けなしのセッション」として作り直す（記録自体は必ず残す）。
 */
export async function createSessionWithScanLink(
  accessLogId: string | null,
  data: Omit<Prisma.DiagnosisSessionUncheckedCreateInput, "accessLogId">
) {
  if (!accessLogId) {
    return prisma.diagnosisSession.create({ data });
  }
  try {
    return await prisma.diagnosisSession.create({
      data: { ...data, accessLogId },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return prisma.diagnosisSession.create({ data });
    }
    throw error;
  }
}
