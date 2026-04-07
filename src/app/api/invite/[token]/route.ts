import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, createToken } from "@/lib/auth";
import { validatePassword } from "@/lib/password-validation";

// トークンの有効性を確認
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const invitation = await prisma.invitationToken.findUnique({
      where: { token },
      include: {
        clinic: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "無効なURLです" }, { status: 404 });
    }

    // パスワードリセットは1回限り、招待URLは何度でも使える
    if (invitation.usedAt && invitation.type === "password_reset") {
      return NextResponse.json({ error: "このURLは既に使用済みです" }, { status: 400 });
    }

    // パスワードリセットのみ有効期限チェック
    if (invitation.type === "password_reset" && new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "このURLの有効期限が切れています" }, { status: 400 });
    }

    const needsEmail = invitation.clinic.email.endsWith("@placeholder.internal");

    return NextResponse.json({
      valid: true,
      type: invitation.type,
      clinicName: invitation.clinic.name,
      clinicEmail: needsEmail ? null : invitation.clinic.email,
      needsEmail,
    });
  } catch (error) {
    console.error("Verify invitation error:", error);
    return NextResponse.json(
      { error: "確認に失敗しました" },
      { status: 500 }
    );
  }
}

// パスワードを設定
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const body = await request.json();
    const { password, email } = body;

    // A3: パスワード強度チェック
    const passwordCheck = validatePassword(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error },
        { status: 400 }
      );
    }

    const invitation = await prisma.invitationToken.findUnique({
      where: { token },
      include: {
        clinic: {
          select: { id: true, email: true, status: true },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json({ error: "無効なURLです" }, { status: 404 });
    }

    // パスワードリセットは1回限り、招待URLは何度でも使える
    if (invitation.usedAt && invitation.type === "password_reset") {
      return NextResponse.json({ error: "このURLは既に使用済みです" }, { status: 400 });
    }

    // パスワードリセットのみ有効期限チェック
    if (invitation.type === "password_reset" && new Date() > invitation.expiresAt) {
      return NextResponse.json({ error: "このURLの有効期限が切れています" }, { status: 400 });
    }

    // メールアドレスがプレースホルダーの場合、新しいメールが必須
    const needsEmail = invitation.clinic.email.endsWith("@placeholder.internal");
    let finalEmail = invitation.clinic.email;

    if (needsEmail) {
      if (!email || !email.includes("@")) {
        return NextResponse.json(
          { error: "メールアドレスを入力してください" },
          { status: 400 }
        );
      }
      // 新しいメールアドレスの重複チェック
      const existing = await prisma.clinic.findUnique({
        where: { email },
      });
      if (existing) {
        return NextResponse.json(
          { error: "このメールアドレスは既に使用されています" },
          { status: 400 }
        );
      }
      finalEmail = email;
    }

    // パスワードをハッシュ化して更新
    const passwordHash = await hashPassword(password);

    // 招待URLは何度でも使えるようにするため、パスワードリセットのみ使用済みにする
    const dbOperations = [
      // パスワードを設定 & ステータス・メールを更新
      prisma.clinic.update({
        where: { id: invitation.clinic.id },
        data: {
          passwordHash,
          ...(needsEmail ? { email: finalEmail } : {}),
          ...(invitation.clinic.status === "pending" ? { status: "active" } : {}),
        },
      }),
    ];

    // パスワードリセットの場合のみトークンを使用済みにする
    if (invitation.type === "password_reset") {
      dbOperations.push(
        prisma.invitationToken.update({
          where: { id: invitation.id },
          data: { usedAt: new Date() },
        }),
      );
    }

    await prisma.$transaction(dbOperations);

    // 自動ログイン用トークンを発行
    const authToken = await createToken({
      clinicId: invitation.clinic.id,
      email: finalEmail,
    });

    const response = NextResponse.json({
      success: true,
      message: invitation.type === "invitation"
        ? "アカウントの設定が完了しました"
        : "パスワードを変更しました",
    });

    // Cookieにトークンを設定（自動ログイン）
    response.cookies.set("auth_token", authToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Set password error:", error);
    return NextResponse.json(
      { error: "パスワードの設定に失敗しました" },
      { status: 500 }
    );
  }
}
