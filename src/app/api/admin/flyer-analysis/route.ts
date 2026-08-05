import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getQrAccessCountsByChannel } from "@/lib/qr-access";

interface ChannelWithRels {
  id: string;
  name: string;
  channelType: string;
  imageUrl: string | null;
  imageUrl2: string | null;
  distributionMethod: string | null;
  distributionQuantity: number | null;
  distributionPeriod: string | null;
  budget: number | null;
  flyerId: string | null;
  createdAt: Date;
  clinicId: string;
  clinic: { id: string; name: string; slug: string };
}

interface FlyerWithClinic {
  id: string;
  clinicId: string;
  name: string;
  distributionMethod: string | null;
  distributionQuantity: number | null;
  distributionPeriod: string | null;
  budget: number | null;
  imageUrl: string | null;
  imageUrl2: string | null;
  createdAt: Date;
  clinic: { id: string; name: string; slug: string };
}

// パーセント(小数点2位)に丸めるヘルパ
const pct = (num: number, denom: number | null | undefined) =>
  denom && denom > 0 ? Math.round((num / denom) * 10000) / 100 : null;

// 単価(整数¥)に丸めるヘルパ
const cost = (budget: number | null | undefined, scans: number) =>
  budget && budget > 0 && scans > 0 ? Math.round(budget / scans) : null;

export async function GET(request: Request) {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawDays = parseInt(searchParams.get("days") || "365");
    // days=0 は「全期間」を意味する特殊値
    const days =
      isNaN(rawDays) || rawDays < 0
        ? 365
        : rawDays === 0
        ? 0
        : Math.min(365, Math.max(1, rawDays));
    const methodFilter = searchParams.get("method") || "";

    const startDate = days === 0 ? null : new Date();
    if (startDate) {
      startDate.setDate(startDate.getDate() - days);
      startDate.setHours(0, 0, 0, 0);
    }
    const dateFilter = startDate ? { gte: startDate } : undefined;

    // 全 Channel（アクティブ・対象クリニックのみ）+ Flyer も一括取得
    const [channels, flyers] = await Promise.all([
      prisma.channel.findMany({
        where: {
          isActive: true,
          clinic: {
            excludeFromAnalysis: false,
            subscription: { planType: { not: "demo" } },
          },
        },
        include: { clinic: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      }),
      prisma.flyer.findMany({
        where: {
          clinic: {
            excludeFromAnalysis: false,
            subscription: { planType: { not: "demo" } },
          },
        },
        include: { clinic: { select: { id: true, name: true, slug: true } } },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const typedChannels = channels as ChannelWithRels[];
    const typedFlyers = flyers as FlyerWithClinic[];
    const channelIds = typedChannels.map((c) => c.id);

    // QRアクセス（実際にQRが読み込まれた回数）を共通ルールで集計。
    // 医院ダッシュボード・チラシ管理・共有ページと同じ数字になる。
    // 旧実装は qr_scan が無ければ page_view / CTAクリックで代替していたため、
    // 医院側の画面と数字が食い違っていた。
    const [scanCountMap, ctaCounts] = await Promise.all([
      getQrAccessCountsByChannel(
        channelIds,
        dateFilter ? { createdAt: { gte: dateFilter.gte, lte: new Date() } } : {}
      ),
      channelIds.length > 0
        ? prisma.cTAClick.groupBy({
            by: ["channelId"],
            where: {
              channelId: { in: channelIds },
              isDeleted: false,
              ...(dateFilter ? { createdAt: dateFilter } : {}),
            },
            _count: { id: true },
          })
        : [],
    ]);

    const ctaCountMap: Record<string, number> = {};
    for (const cc of ctaCounts) {
      if (cc.channelId) ctaCountMap[cc.channelId] = cc._count.id;
    }

    // チャネル1件あたりの読み込み回数
    const channelScans = typedChannels.map((ch) => {
      const scans = scanCountMap[ch.id] || 0;
      return { id: ch.id, qrScans: scans, scans };
    });
    const scanById = new Map(channelScans.map((s) => [s.id, s]));

    // チラシ別に紐付くチャネルを集計
    // - flyerId がセットされた Channel はチラシ側に分類
    // - flyerId が null の Channel は「単独QR」として別配列に
    const channelsByFlyer = new Map<string, ChannelWithRels[]>();
    const standaloneChannels: ChannelWithRels[] = [];
    for (const ch of typedChannels) {
      if (ch.flyerId) {
        const arr = channelsByFlyer.get(ch.flyerId) ?? [];
        arr.push(ch);
        channelsByFlyer.set(ch.flyerId, arr);
      } else {
        standaloneChannels.push(ch);
      }
    }

    // チラシ単位の集計データを構築
    const flyerAnalysis = typedFlyers
      .filter((f) => {
        // 配布方法フィルタ: 指定されていればチラシの配布方法で絞り込む
        if (!methodFilter) return true;
        return f.distributionMethod === methodFilter;
      })
      .map((f) => {
        const linkedChannels = channelsByFlyer.get(f.id) ?? [];
        // チラシに属する全チャネルのスキャン数を合算
        const totalQrScans = linkedChannels.reduce(
          (acc, ch) => acc + (scanById.get(ch.id)?.qrScans ?? 0),
          0
        );
        const totalScans = linkedChannels.reduce(
          (acc, ch) => acc + (scanById.get(ch.id)?.scans ?? 0),
          0
        );
        return {
          id: f.id,
          clinicId: f.clinic.id,
          clinicName: f.clinic.name,
          clinicSlug: f.clinic.slug,
          name: f.name,
          distributionMethod: f.distributionMethod,
          distributionQuantity: f.distributionQuantity,
          distributionPeriod: f.distributionPeriod,
          budget: f.budget,
          imageUrl: f.imageUrl,
          imageUrl2: f.imageUrl2,
          // チラシに紐付くQR一覧（折りたたみ表示用）
          channels: linkedChannels.map((ch) => ({
            id: ch.id,
            name: ch.name,
            channelType: ch.channelType,
            qrScans: scanById.get(ch.id)?.qrScans ?? 0,
            scans: scanById.get(ch.id)?.scans ?? 0,
          })),
          // 合算カウント・指標
          qrScans: totalQrScans,
          scans: totalScans,
          qrScanRate: pct(totalScans, f.distributionQuantity),
          qrScanCost: cost(f.budget, totalScans),
          channelCount: linkedChannels.length,
          createdAt: f.createdAt,
        };
      });

    // 単独QR（flyerId=null）の集計データ
    const standaloneAnalysis = standaloneChannels
      .filter((ch) => {
        if (!methodFilter) return true;
        return ch.distributionMethod === methodFilter;
      })
      .map((ch) => {
        const s = scanById.get(ch.id);
        const qrScans = s?.qrScans ?? 0;
        const scans = s?.scans ?? 0;
        return {
          id: ch.id,
          clinicId: ch.clinic.id,
          clinicName: ch.clinic.name,
          clinicSlug: ch.clinic.slug,
          name: ch.name,
          channelType: ch.channelType,
          imageUrl: ch.imageUrl,
          imageUrl2: ch.imageUrl2,
          distributionMethod: ch.distributionMethod,
          distributionQuantity: ch.distributionQuantity,
          distributionPeriod: ch.distributionPeriod,
          budget: ch.budget,
          qrScans,
          scans,
          qrScanRate: pct(scans, ch.distributionQuantity),
          qrScanCost: cost(ch.budget, scans),
          createdAt: ch.createdAt,
        };
      });

    // 配布方法別の集計（チラシ + 単独QR を統合してメソッドで合算）
    // 各「ユニット」は { method, quantity, budget, scans } を提供する
    type Unit = {
      method: string;
      quantity: number;
      budget: number;
      scans: number;
    };
    const units: Unit[] = [
      ...flyerAnalysis.map((f) => ({
        method: f.distributionMethod || "未設定",
        quantity: f.distributionQuantity ?? 0,
        budget: f.budget ?? 0,
        scans: f.scans,
      })),
      ...standaloneAnalysis.map((ch) => ({
        method: ch.distributionMethod || "未設定",
        quantity: ch.distributionQuantity ?? 0,
        budget: ch.budget ?? 0,
        scans: ch.scans,
      })),
    ];

    const methodSummary: Record<
      string,
      { count: number; totalScans: number; totalQuantity: number; totalBudget: number }
    > = {};
    for (const u of units) {
      if (!methodSummary[u.method]) {
        methodSummary[u.method] = {
          count: 0,
          totalScans: 0,
          totalQuantity: 0,
          totalBudget: 0,
        };
      }
      const m = methodSummary[u.method];
      m.count++;
      m.totalScans += u.scans;
      m.totalQuantity += u.quantity;
      m.totalBudget += u.budget;
    }

    const methodStats = Object.entries(methodSummary)
      .filter(([method]) => method !== "未設定")
      .map(([method, data]) => ({
        method,
        count: data.count,
        totalScans: data.totalScans,
        totalQuantity: data.totalQuantity,
        totalBudget: data.totalBudget,
        avgQrScanRate: pct(data.totalScans, data.totalQuantity),
        avgQrScanCost: cost(data.totalBudget, data.totalScans),
      }));

    return NextResponse.json({
      flyers: flyerAnalysis,
      standaloneChannels: standaloneAnalysis,
      methodStats,
      period: days,
    });
  } catch (error) {
    console.error("Get flyer analysis error:", error);
    return NextResponse.json(
      { error: "QR効果分析の取得に失敗しました" },
      { status: 500 }
    );
  }
}
