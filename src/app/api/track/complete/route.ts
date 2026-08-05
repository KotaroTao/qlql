import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClientIP } from "@/lib/geolocation";
import { canTrackSession } from "@/lib/subscription";
import { reverseGeocode } from "@/lib/geocoding";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  clearQrScanCookie,
  createSessionWithScanLink,
  resolveScanLogId,
} from "@/lib/qr-scan-link";
import {
  sanitizeAge,
  sanitizeGender,
  sanitizeLatitude,
  sanitizeLongitude,
  sanitizeString,
} from "@/lib/track-validation";

export async function POST(request: NextRequest) {
  // レート制限: 1つのIPから1分間に20回まで
  const rateLimitResponse = checkRateLimit(request, "track-complete", 20, 60 * 1000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { channelId, diagnosisType } = body;

    if (!channelId || !diagnosisType) {
      return NextResponse.json(
        { error: "channelId and diagnosisType are required" },
        { status: 400 }
      );
    }

    // A6: 入力値をサニタイズ（不正な値は null に変換）
    const userAge = sanitizeAge(body.userAge);
    const userGender = sanitizeGender(body.userGender);
    const latitude = sanitizeLatitude(body.latitude);
    const longitude = sanitizeLongitude(body.longitude);
    const totalScore = typeof body.totalScore === "number" ? body.totalScore : null;
    const resultCategory = sanitizeString(body.resultCategory, 100);

    // チャンネルから医院IDを取得
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      select: { clinicId: true },
    });

    if (!channel) {
      return NextResponse.json(
        { error: "Channel not found" },
        { status: 404 }
      );
    }

    // 契約状態をチェック - 契約が無効な場合は計測をスキップ
    const canTrack = await canTrackSession(channel.clinicId);
    if (!canTrack) {
      // 診断自体は成功として返す（ユーザー体験を損なわないため）
      return NextResponse.json({ success: true, sessionId: null, tracked: false });
    }

    // 診断タイプを取得
    const diagnosisTypeRecord = await prisma.diagnosisType.findUnique({
      where: { slug: diagnosisType },
      select: { id: true },
    });

    if (!diagnosisTypeRecord) {
      return NextResponse.json(
        { error: "DiagnosisType not found" },
        { status: 404 }
      );
    }

    // IPアドレスを取得
    const ip = getClientIP(request);

    // 位置情報の逆ジオコーディング（緯度経度が両方有効な場合のみ）
    let location: { country: string; region: string; city: string; town: string } | null = null;
    let roundedLat: number | null = null;
    let roundedLng: number | null = null;

    if (latitude !== null && longitude !== null) {
      try {
        location = await reverseGeocode(latitude, longitude);
      } catch (e) {
        console.error("Reverse geocode failed:", e);
      }
      // 座標を小数点2桁に丸める（約1km精度、プライバシー保護）
      roundedLat = Math.round(latitude * 100) / 100;
      roundedLng = Math.round(longitude * 100) / 100;
    }

    // このセッションの起点になったQR読み込み（Cookie経由）を特定する。
    // 見つからなければ null（＝QRを介さない直接アクセス扱い）でセッションを作る。
    const scanLogId = await resolveScanLogId(request, channelId);

    // 診断セッションを作成
    const session = await createSessionWithScanLink(scanLogId, {
      clinicId: channel.clinicId,
      channelId,
      diagnosisTypeId: diagnosisTypeRecord.id,
      isDemo: false,
      userAge,
      userGender,
      answers: body.answers || null,
      totalScore,
      resultCategory,
      completedAt: new Date(),
      ipAddress: ip !== "unknown" ? ip : null,
      latitude: roundedLat,
      longitude: roundedLng,
      country: location?.country || null,
      region: location?.region || null,
      city: location?.city || null,
      town: location?.town || null,
    });

    // 使い切ったCookieは削除（同じ読み込みが2件のセッションに紐付かないように）
    const response = NextResponse.json({ success: true, sessionId: session.id });
    clearQrScanCookie(response);
    return response;
  } catch (error) {
    console.error("Track complete error:", error);
    return NextResponse.json({ success: false });
  }
}
