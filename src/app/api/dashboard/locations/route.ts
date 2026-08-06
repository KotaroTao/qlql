import { NextRequest, NextResponse } from "next/server";
import { resolveClinicContext } from "@/lib/dashboard-auth";
import { prisma } from "@/lib/prisma";
import { forwardGeocode } from "@/lib/geocoding";
import { QR_SCAN_EVENT_TYPE, getQrAccessTotal } from "@/lib/qr-access";
import type { ClinicPage } from "@/types/clinic";

interface LocationGroupResult {
  region: string | null;
  city: string | null;
  town: string | null;
  channelId: string | null;
  _count: { id: number };
  _avg: { latitude: number | null; longitude: number | null };
}

interface AccessLogGroupResult {
  region: string | null;
  city: string | null;
  channelId: string | null;
  _count: { id: number };
}

interface RegionGroupResult {
  region: string | null;
  _count: { id: number };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await resolveClinicContext(request);
    if (!ctx) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }
    const session = { clinicId: ctx.clinicId };

    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get("channelId");
    const channelIds = searchParams.get("channelIds");
    const period = searchParams.get("period") || "month";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // 期間の計算
    // period="all" の場合は日付フィルタを適用しない（全期間を対象）
    let dateFrom: Date | null = null;
    const dateTo: Date | null = period === "all" ? null : new Date();

    if (period === "all") {
      dateFrom = null;
    } else if (period === "custom" && startDate && endDate) {
      dateFrom = new Date(startDate);
      (dateTo as Date).setTime(new Date(endDate).getTime());
      (dateTo as Date).setHours(23, 59, 59, 999);
    } else {
      switch (period) {
        case "today":
          dateFrom = new Date();
          dateFrom.setHours(0, 0, 0, 0);
          break;
        case "week":
          dateFrom = new Date();
          dateFrom.setDate(dateFrom.getDate() - 7);
          dateFrom.setHours(0, 0, 0, 0);
          break;
        case "month":
        default:
          dateFrom = new Date();
          dateFrom.setMonth(dateFrom.getMonth() - 1);
          dateFrom.setHours(0, 0, 0, 0);
          break;
      }
    }
    // 期間フィルタ用ヘルパー: period="all" 時は空オブジェクトで where に展開
    const dateRangeFilter =
      dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {};

    // チャンネルフィルター条件を作成
    const channelFilter = channelIds
      ? { channelId: { in: channelIds.split(",").filter(Boolean) } }
      : channelId
      ? { channelId }
      : {};

    // DB側でGROUP BY集計（パフォーマンス改善）
    // 注意: 「市区町村だけ取れていて都道府県が無い」レコードも地図に出したいので、
    // region: { not: null } の要件は撤去。少なくとも city があれば緯度経度から
    // 地図にプロットできる（履歴では「📍 港区」のように表示される類のデータ）。
    // 地図は「完了セッション（全件）＋ 完了に至らなかった読み込みログ」で構成する。
    // 読み込みログは位置情報を持たない（リダイレクト高速化のため取得していない）のに対し、
    // 完了セッションはGPSベースの詳細な位置を持つ。そこで、読み込みに紐付いた分は
    // セッション側から拾うことで、件数を二重に数えずに位置の精度も保てる。
    // → 合計は「QRアクセス（= 実際に読み込まれた回数）」と一致する（qr-access.ts 参照）
    const locationData = await prisma.diagnosisSession.groupBy({
      by: ["region", "city", "town", "channelId"],
      where: {
        clinicId: session.clinicId,
        completedAt: { not: null },
        isDemo: false,
        isDeleted: false,
        ...dateRangeFilter,
        city: { not: null },
        ...channelFilter,
      },
      _count: {
        id: true,
      },
      _avg: {
        latitude: true,
        longitude: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 100, // 上位100件に制限
    });

    // レスポンス形式に変換（診断セッション）
    const diagnosisLocations = (locationData as LocationGroupResult[]).map((item) => ({
      region: item.region,
      city: item.city,
      town: item.town,
      latitude: item._avg.latitude,
      longitude: item._avg.longitude,
      count: item._count.id,
      channelId: item.channelId,
      type: "diagnosis" as const,
    }));

    // 完了に至らなかったQR読み込みのエリアデータ（session: null で絞る）
    // 完了しているものは上の locationData 側で数えているので、ここでは除外して二重計上を防ぐ。
    // 同上、region が無いレコードも city ベースで地図表示できるよう region 要件を撤去。
    const qrScanData = await prisma.accessLog.groupBy({
      by: ["region", "city", "channelId"],
      where: {
        clinicId: session.clinicId,
        eventType: QR_SCAN_EVENT_TYPE,
        isDeleted: false,
        session: { is: null },
        ...dateRangeFilter,
        city: { not: null },
        ...channelFilter,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
      take: 100,
    });

    // QRスキャンデータを統合形式に変換
    const qrScanLocations = (qrScanData as AccessLogGroupResult[]).map((item) => ({
      region: item.region,
      city: item.city,
      town: null,
      latitude: null,
      longitude: null,
      count: item._count.id,
      channelId: item.channelId,
      type: "qr_scan" as const,
    }));

    // 両方のデータを統合
    const locations = [...diagnosisLocations, ...qrScanLocations];

    // 都道府県別の集計（DB側で実行）
    const regionData = await prisma.diagnosisSession.groupBy({
      by: ["region"],
      where: {
        clinicId: session.clinicId,
        completedAt: { not: null },
        isDemo: false,
        isDeleted: false,
        ...dateRangeFilter,
        region: { not: null },
        ...channelFilter,
      },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: "desc",
        },
      },
    });

    // 完了に至らなかったQR読み込みの都道府県別集計（完了分はセッション側で計上済み）
    const qrScanRegionData = await prisma.accessLog.groupBy({
      by: ["region"],
      where: {
        clinicId: session.clinicId,
        eventType: QR_SCAN_EVENT_TYPE,
        isDeleted: false,
        session: { is: null },
        ...dateRangeFilter,
        region: { not: null },
        ...channelFilter,
      },
      _count: {
        id: true,
      },
    });

    // 都道府県別データを統合
    const regionMap: Record<string, number> = {};
    for (const item of regionData as RegionGroupResult[]) {
      if (item.region) {
        regionMap[item.region] = (regionMap[item.region] || 0) + item._count.id;
      }
    }
    for (const item of qrScanRegionData as RegionGroupResult[]) {
      if (item.region) {
        regionMap[item.region] = (regionMap[item.region] || 0) + item._count.id;
      }
    }
    const topRegions = Object.entries(regionMap)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);

    // 全体の件数 = QRアクセス（実際にQRが読み込まれた回数）。
    // 「◯件中 位置特定 △件」の分母になるので、履歴の件数・チラシのQRアクセスと一致する。
    const total = await getQrAccessTotal({
      clinicId: session.clinicId,
      channelFilter,
      dateRange: dateRangeFilter,
    });

    // クリニックの住所から座標を取得
    let clinicCenter: { latitude: number; longitude: number } | null = null;
    try {
      const clinic = await prisma.clinic.findUnique({
        where: { id: session.clinicId },
        select: { clinicPage: true },
      });

      if (clinic?.clinicPage) {
        const clinicPage = clinic.clinicPage as ClinicPage;
        const address = clinicPage.access?.address;
        if (address) {
          const coords = await forwardGeocode(address);
          if (coords) {
            clinicCenter = {
              latitude: coords.latitude,
              longitude: coords.longitude,
            };
          }
        }
      }
    } catch (error) {
      console.error("Failed to get clinic center:", error);
      // エラーがあってもnullのまま続行
    }

    // 最多読み込み地域（hotspot）を計算
    // locations は既に count 降順でソート済み
    let hotspot: {
      latitude: number;
      longitude: number;
      region: string;
      city: string;
      town: string | null;
      count: number;
    } | null = null;

    if (locations.length > 0) {
      // 最も読み込み回数が多い地域を探す
      const topLocation = locations.reduce((max, loc) =>
        loc.count > max.count ? loc : max
      , locations[0]);

      // region が空でも city があり GPS が取れていれば hotspot として扱う。
      // GPS が無い場合は都道府県中心にフォールバックするので region が必須。
      const hasGPS = topLocation.latitude !== null && topLocation.longitude !== null;
      const hasLocation = topLocation.region || topLocation.city;

      if (hasLocation) {
        // GPS座標があればそれを使用
        if (hasGPS) {
          hotspot = {
            latitude: topLocation.latitude!,
            longitude: topLocation.longitude!,
            region: topLocation.region || "",
            city: topLocation.city || "",
            town: topLocation.town,
            count: topLocation.count,
          };
        } else if (topLocation.region) {
          // GPS座標がない場合は都道府県中心座標を使用（region が必須）
          const { PREFECTURE_CENTERS, normalizePrefectureName } = await import("@/data/japan-prefectures");
          const prefName = normalizePrefectureName(topLocation.region);
          const prefCenter = PREFECTURE_CENTERS[prefName];
          if (prefCenter) {
            hotspot = {
              latitude: prefCenter[0],
              longitude: prefCenter[1],
              region: topLocation.region,
              city: topLocation.city || "",
              town: topLocation.town,
              count: topLocation.count,
            };
          }
        }
      }
    }

    return NextResponse.json({
      locations,
      topRegions,
      total,
      clinicCenter,
      hotspot,
      period: {
        // period="all" 時は dateFrom/dateTo が null（全期間）
        from: dateFrom ? dateFrom.toISOString() : null,
        to: dateTo ? dateTo.toISOString() : null,
      },
    });
  } catch (error) {
    console.error("Dashboard locations error:", error);
    return NextResponse.json(
      { error: "位置データの取得に失敗しました" },
      { status: 500 }
    );
  }
}
