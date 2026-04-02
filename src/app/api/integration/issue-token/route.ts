import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getAdminSession } from "@/lib/admin-auth";
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
  // 管理者認証チェック
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  // リクエストボディからclinicIdを取得
  let clinicId: string;
  try {
    const body = await request.json();
    clinicId = body.clinicId;
  } catch {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  if (!clinicId) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }

  // レートリミット: 同一clinicIdに対して1分3回まで
  const rateLimitResult = checkRateLimit(
    request,
    `slp-issue:${clinicId}`,
    3,
    60 * 1000
  );
  if (rateLimitResult) {
    return NextResponse.json({ error: "RATE_LIMIT_EXCEEDED" }, { status: 429 });
  }

  // クリニックの存在確認
  const clinic = await prisma.clinic.findUnique({
    where: { id: clinicId },
    select: { id: true },
  });

  if (!clinic) {
    return NextResponse.json({ error: "CLINIC_NOT_FOUND" }, { status: 404 });
  }

  // 同じclinicIdの旧トークン（未使用のもの）を即時無効化
  await prisma.slpIntegrationToken.updateMany({
    where: {
      clinicId,
      usedAt: null,
    },
    data: {
      usedAt: new Date(),
    },
  });

  // 新しいトークンを生成（crypto.randomBytesで安全に生成）
  const token = crypto.randomBytes(32).toString("hex"); // 64文字のhex文字列
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10分後

  // DBに保存
  await prisma.slpIntegrationToken.create({
    data: {
      token,
      clinicId,
      expiresAt,
    },
  });

  return NextResponse.json({
    token,
    expiresAt: expiresAt.toISOString(),
  });
}
