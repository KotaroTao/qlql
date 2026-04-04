import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { validatePassword } from "@/lib/password-validation";
import crypto from "crypto";
import type { Clinic } from "@/types/clinic";

export async function POST(request: NextRequest) {
  // A1: レート制限（1つのIPから15分間に10回まで）
  const rateLimitResponse = checkRateLimit(request, "auth-signup", 10, 15 * 60 * 1000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { name, email, password, phone } = body;

    // バリデーション
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "医院名、メールアドレス、パスワードは必須です" },
        { status: 400 }
      );
    }

    // A3: パスワード強度チェック
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      );
    }

    // メールアドレスの重複チェック
    const existingClinic = await prisma.clinic.findUnique({
      where: { email },
    });

    if (existingClinic) {
      return NextResponse.json(
        { error: "このメールアドレスは既に登録されています" },
        { status: 400 }
      );
    }

    // スラッグを生成（暗号学的に安全なランダム文字列）
    const slug = generateSlug();

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(password);

    // share_token を生成（SLP連携やダッシュボード共有で使うトークン）
    const shareToken = crypto.randomBytes(32).toString("base64url");

    // 医院を作成
    const clinic = (await prisma.clinic.create({
      data: {
        name,
        email,
        passwordHash,
        phone: phone || null,
        slug,
        status: "trial",
        shareToken,
      },
    })) as Clinic;

    // トライアル期間を設定（14日間）
    const trialEnd = new Date();
    trialEnd.setDate(trialEnd.getDate() + 14);

    await prisma.subscription.create({
      data: {
        clinicId: clinic.id,
        status: "trial",
        trialEnd,
      },
    });

    // JWTトークンを生成
    const token = await createToken({
      clinicId: clinic.id,
      email: clinic.email,
    });

    // レスポンスを作成
    const response = NextResponse.json(
      {
        message: "登録が完了しました",
        clinic: {
          id: clinic.id,
          name: clinic.name,
          email: clinic.email,
          slug: clinic.slug,
        },
      },
      { status: 201 }
    );

    // Cookieにトークンを設定
    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7日間
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Signup error:", error);
    return NextResponse.json(
      { error: "登録に失敗しました。しばらく経ってから再度お試しください" },
      { status: 500 }
    );
  }
}

/** 暗号学的に安全なランダム文字列を生成 */
function generateSlug(): string {
  return crypto.randomBytes(4).toString("hex"); // 8文字の16進数
}
