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
 * 完了キーが一致する既存セッションを探す。
 * 同じチャネルのものだけを「同じ完了」とみなす（別チャネルのキーは無関係）。
 */
export async function findSessionByCompletionKey(
  clientKey: string,
  channelId: string
) {
  return prisma.diagnosisSession.findFirst({
    where: { clientKey, channelId },
    select: { id: true },
  });
}

/**
 * 診断/入力セッションを作成する。読み込みログIDが取れていれば紐付ける。
 *
 * 重複防止（完了キー）:
 *   data.clientKey が付いている場合、同じキーのセッションが既にあれば
 *   新しく作らずそれを返す。結果画面のリロード等で同じ完了が2回届いても1件で済む。
 *   ほぼ同時に2回届いてどちらも「既存なし」と判断した場合も、DBのユニーク制約が
 *   2件目を弾くので、そのときは改めて既存の1件を探して返す。
 *
 * 読み込みログの取り合い:
 *   ごく稀に、同じCookieを持った2つのタブがほぼ同時に完了して
 *   同じ読み込みIDを取り合うことがある。その場合は紐付けを諦めて
 *   「紐付けなしのセッション」として作り直す（記録自体は必ず残す）。
 */
export async function createSessionWithScanLink(
  accessLogId: string | null,
  data: Omit<Prisma.DiagnosisSessionUncheckedCreateInput, "accessLogId">
): Promise<{ id: string; deduplicated: boolean }> {
  const clientKey = typeof data.clientKey === "string" ? data.clientKey : null;
  const channelId = typeof data.channelId === "string" ? data.channelId : null;

  // 完了キーで既存セッションを探す（同じ完了の再送信なら既存を返す）
  if (clientKey && channelId) {
    const existing = await findSessionByCompletionKey(clientKey, channelId);
    if (existing) return { id: existing.id, deduplicated: true };
  }

  const createData = accessLogId ? { ...data, accessLogId } : data;

  try {
    const created = await prisma.diagnosisSession.create({ data: createData });
    return { id: created.id, deduplicated: false };
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    // ユニーク制約違反の原因が完了キーなら、先に作られた1件を返す
    if (clientKey && channelId) {
      const existing = await findSessionByCompletionKey(clientKey, channelId);
      if (existing) return { id: existing.id, deduplicated: true };
    }

    // 原因が読み込みIDの取り合いなら、紐付けなしで作り直す
    if (accessLogId) {
      const created = await prisma.diagnosisSession.create({ data });
      return { id: created.id, deduplicated: false };
    }

    throw error;
  }
}
