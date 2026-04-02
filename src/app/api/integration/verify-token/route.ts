import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";

// CORSプリフライト対応（SLPからのリクエストに必要）
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": process.env.SLP_DOMAIN || "",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function POST(request: NextRequest) {
  // レートリミット: 同一IPに対して1分10回まで
  const rateLimitResult = checkRateLimit(
    request,
    "slp-verify",
    10,
    60 * 1000
  );
  if (rateLimitResult) {
    return NextResponse.json(
      { success: false, error: "RATE_LIMIT_EXCEEDED" },
      { status: 429 }
    );
  }

  // リクエストボディからtokenを取得
  let token: string;
  try {
    const body = await request.json();
    token = body.token;
  } catch {
    return NextResponse.json(
      { success: false, error: "INVALID_REQUEST" },
      { status: 400 }
    );
  }

  if (!token || typeof token !== "string") {
    return NextResponse.json(
      { success: false, error: "TOKEN_INVALID" },
      { status: 400 }
    );
  }

  // ① DBでtoken検索
  const integrationToken = await prisma.slpIntegrationToken.findUnique({
    where: { token },
    include: {
      clinic: {
        select: { shareToken: true },
      },
    },
  });

  if (!integrationToken) {
    return NextResponse.json(
      { success: false, error: "TOKEN_INVALID" },
      { status: 400 }
    );
  }

  // ② usedAt確認（使用済みチェック）
  if (integrationToken.usedAt) {
    return NextResponse.json(
      { success: false, error: "TOKEN_USED" },
      { status: 400 }
    );
  }

  // ③ expiresAt確認（有効期限チェック）
  if (new Date() > integrationToken.expiresAt) {
    return NextResponse.json(
      { success: false, error: "TOKEN_EXPIRED" },
      { status: 400 }
    );
  }

  // ④ clinicのshare_tokenを取得
  const shareToken = integrationToken.clinic.shareToken;
  if (!shareToken) {
    return NextResponse.json(
      { success: false, error: "SHARE_TOKEN_NOT_SET" },
      { status: 400 }
    );
  }

  // ⑤ usedAt = now で無効化（ワンタイム使い切り）
  await prisma.slpIntegrationToken.update({
    where: { id: integrationToken.id },
    data: { usedAt: new Date() },
  });

  // ⑥ shareTokenを返す
  return NextResponse.json({
    success: true,
    shareToken,
  });
}
