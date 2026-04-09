"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useDiagnosisStore } from "@/lib/diagnosis-store";
import { DiagnosisType } from "@/data/diagnosis-types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DemoCTA } from "./demo-cta";
import { Share2, Calendar, Phone, MessageCircle, Building2, Printer, CheckCircle } from "lucide-react";
import Link from "next/link";
import type { CTAConfig } from "@/types/clinic";

interface Props {
  diagnosis: DiagnosisType;
  isDemo: boolean;
  ctaConfig?: CTAConfig;
  clinicName?: string;
  mainColor?: string;
  channelId?: string;
}

export function ResultCard({ diagnosis, isDemo, ctaConfig, clinicName, mainColor, channelId }: Props) {
  const { userAge, userGender, answers, totalScore, resultPattern, oralAge, latitude, longitude, reset, _hasHydrated } =
    useDiagnosisStore();
  const hasTrackedRef = useRef(false);
  const [showCopied, setShowCopied] = useState(false);

  // sessionIdをPromiseで管理（CTAクリック時に完了を待てるようにする）
  const sessionIdPromiseRef = useRef<Promise<string | null> | null>(null);

  // 診断完了をトラッキング（非デモモードのみ、1回だけ）
  useEffect(() => {
    if (!_hasHydrated) return;
    if (isDemo || !channelId || !resultPattern || hasTrackedRef.current) return;
    hasTrackedRef.current = true;

    sessionIdPromiseRef.current = fetch("/api/track/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        channelId,
        diagnosisType: diagnosis.slug,
        userAge,
        userGender,
        answers,
        totalScore,
        resultCategory: resultPattern.category,
        latitude,
        longitude,
      }),
    })
      .then((res) => res.json())
      .then((data) => data.sessionId || null)
      .catch(() => null);
  }, [_hasHydrated, isDemo, channelId, diagnosis.slug, resultPattern, userAge, userGender, answers, totalScore, latitude, longitude]);

  if (!resultPattern) return null;

  const handleShare = async () => {
    const text =
      diagnosis.slug === "oral-age"
        ? `お口年齢診断の結果：${oralAge}歳でした！`
        : `子供の矯正タイミングチェックの結果：${resultPattern.title}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: diagnosis.name,
          text,
          url: window.location.href,
        });
      } catch {
        // ユーザーがキャンセルした場合
      }
    } else {
      // コピー
      navigator.clipboard.writeText(`${text}\n${window.location.href}`);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-hidden">
        <CardHeader className="text-center bg-gradient-to-b from-blue-50 to-white pb-8">
          <CardTitle className="text-lg text-gray-600 mb-4">
            {diagnosis.name} 結果
          </CardTitle>

          {diagnosis.slug === "oral-age" && oralAge !== null && (
            <div className="space-y-2">
              <p className="text-gray-600">あなたのお口年齢は</p>
              <p className="text-5xl font-bold text-primary">{oralAge}歳</p>
              {userAge && (
                <p className="text-sm text-gray-500">
                  （実年齢{userAge}歳より
                  {oralAge > userAge && (
                    <span className="text-red-500">
                      +{oralAge - userAge}歳
                    </span>
                  )}
                  {oralAge < userAge && (
                    <span className="text-green-500">
                      {oralAge - userAge}歳
                    </span>
                  )}
                  {oralAge === userAge && <span>同じ</span>}）
                </p>
              )}
            </div>
          )}

          {diagnosis.slug !== "oral-age" && (
            <div className="space-y-2">
              <p className="text-2xl font-bold text-primary">
                {resultPattern.title}
              </p>
            </div>
          )}
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium mb-2">アドバイス</h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              {resultPattern.message}
            </p>
          </div>

          {/* CTA エリア */}
          {isDemo ? (
            <DemoCTA />
          ) : (
            <ClinicCTA
              ctaConfig={ctaConfig}
              clinicName={clinicName}
              mainColor={mainColor}
              channelId={channelId}
              sessionIdPromise={sessionIdPromiseRef.current}
            />
          )}

          {/* シェア・印刷ボタン */}
          <div className="flex flex-col items-center gap-2 pt-4 border-t print:hidden">
            <div className="flex justify-center gap-4">
              <Button variant="outline" onClick={handleShare} className="gap-2">
                <Share2 className="w-4 h-4" />
                結果をシェア
              </Button>
              <Button variant="outline" onClick={handlePrint} className="gap-2">
                <Printer className="w-4 h-4" />
                印刷
              </Button>
            </div>
            {showCopied && (
              <div className="flex items-center gap-1.5 text-green-600 text-sm animate-in fade-in duration-200">
                <CheckCircle className="w-4 h-4" />
                URLをコピーしました
              </div>
            )}
          </div>

          {/* もう一度診断 */}
          {isDemo && (
            <div className="text-center pt-2">
              <Link href="/demo">
                <Button variant="ghost" onClick={reset}>
                  別の診断を試す
                </Button>
              </Link>
            </div>
          )}

          {/* 免責事項 */}
          <p className="text-xs text-center text-gray-400 pt-4 border-t">
            ※この診断は医療行為ではありません。
            <br />
            実際の診断・治療については、必ず歯科医師にご相談ください。
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// 医院カスタマイズCTAコンポーネント
function ClinicCTA({
  ctaConfig,
  clinicName,
  mainColor,
  channelId,
  sessionIdPromise,
}: {
  ctaConfig?: CTAConfig;
  clinicName?: string;
  mainColor?: string;
  channelId?: string;
  sessionIdPromise?: Promise<string | null> | null;
}) {
  const buttonStyle = mainColor
    ? { backgroundColor: mainColor, borderColor: mainColor }
    : {};

  // CTA計測（sessionId完了待ち + sendBeaconフォールバック付き）
  const trackClick = (ctaType: string) => {
    if (!channelId) return;

    // 非同期処理を即座に発火（onClick内で安全に呼べるようvoid化）
    void (async () => {
      // sessionIdの完了を最大2秒待つ（まだ未取得の場合）
      let sessionId: string | null = null;
      if (sessionIdPromise) {
        try {
          const timeout = new Promise<null>((resolve) => {
            const id = setTimeout(() => resolve(null), 2000);
            // sessionIdPromiseが先に解決したらタイムアウトをクリア
            sessionIdPromise.finally(() => clearTimeout(id));
          });
          sessionId = await Promise.race([sessionIdPromise, timeout]);
        } catch {
          // 失敗時はnullのまま
        }
      }

      const payload = JSON.stringify({ channelId, ctaType, sessionId });

      // fetch で送信を試み、失敗したら sendBeacon にフォールバック
      try {
        const res = await fetch("/api/track/cta", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
        });
        if (!res.ok) throw new Error("fetch failed");
      } catch {
        // フォールバック: sendBeacon（ページ遷移時でも確実に送信）
        if (typeof navigator.sendBeacon === "function") {
          navigator.sendBeacon(
            "/api/track/cta",
            new Blob([payload], { type: "application/json" })
          );
        }
      }
    })();
  };

  const hasAnyCTA =
    ctaConfig?.bookingUrl ||
    ctaConfig?.lineUrl ||
    ctaConfig?.instagramUrl ||
    ctaConfig?.youtubeUrl ||
    ctaConfig?.facebookUrl ||
    ctaConfig?.tiktokUrl ||
    ctaConfig?.threadsUrl ||
    ctaConfig?.xUrl ||
    ctaConfig?.googleMapsUrl ||
    ctaConfig?.phone ||
    (ctaConfig?.customCTAs && ctaConfig.customCTAs.length > 0);

  if (!hasAnyCTA) {
    return (
      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-center text-gray-600">
          詳しくは{clinicName || "歯科医院"}にご相談ください
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 院長メッセージ */}
      {ctaConfig?.directorMessage && (
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-700 leading-relaxed">
            {ctaConfig.directorMessage}
          </p>
          {clinicName && (
            <p className="text-sm text-gray-500 mt-2 text-right">
              - {clinicName}
            </p>
          )}
        </div>
      )}

      {/* CTAボタン */}
      <div className="space-y-3">
        {/* 予約ボタン */}
        {ctaConfig?.bookingUrl && (
          <a
            href={ctaConfig.bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            onClick={() => trackClick("booking")}
          >
            <Button
              className="w-full gap-2 text-white"
              size="lg"
              style={buttonStyle}
            >
              <Calendar className="w-5 h-5" />
              Web予約はこちら
            </Button>
          </a>
        )}

        {/* 電話ボタン */}
        {ctaConfig?.phone && (
          <a
            href={`tel:${ctaConfig.phone.replace(/-/g, "")}`}
            onClick={() => trackClick("phone")}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-lg font-medium border-2 transition-all duration-200 hover:scale-[1.02] hover:shadow-md active:scale-[0.98]"
            style={mainColor ? { borderColor: mainColor, color: mainColor } : { borderColor: "#2563eb", color: "#2563eb" }}
          >
            <Phone className="w-5 h-5" />
            電話で相談 ({ctaConfig.phone})
          </a>
        )}

        {/* SNSボタン */}
        <div className="grid grid-cols-2 gap-3">
          {ctaConfig?.lineUrl && (
            <a
              href={ctaConfig.lineUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("line")}
            >
              <Button
                variant="outline"
                className="w-full gap-2"
                style={{ borderColor: "#06C755", color: "#06C755" }}
              >
                <MessageCircle className="w-4 h-4" />
                LINE
              </Button>
            </a>
          )}
          {ctaConfig?.instagramUrl && (
            <a
              href={ctaConfig.instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("instagram")}
            >
              <Button
                variant="outline"
                className="w-full gap-2"
                style={{ borderColor: "#E4405F", color: "#E4405F" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                </svg>
                Instagram
              </Button>
            </a>
          )}
          {ctaConfig?.youtubeUrl && (
            <a
              href={ctaConfig.youtubeUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("youtube")}
            >
              <Button
                variant="outline"
                className="w-full gap-2"
                style={{ borderColor: "#FF0000", color: "#FF0000" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                </svg>
                YouTube
              </Button>
            </a>
          )}
          {ctaConfig?.facebookUrl && (
            <a
              href={ctaConfig.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("facebook")}
            >
              <Button
                variant="outline"
                className="w-full gap-2"
                style={{ borderColor: "#1877F2", color: "#1877F2" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                </svg>
                Facebook
              </Button>
            </a>
          )}
          {ctaConfig?.tiktokUrl && (
            <a
              href={ctaConfig.tiktokUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("tiktok")}
            >
              <Button
                variant="outline"
                className="w-full gap-2"
                style={{ borderColor: "#000000", color: "#000000" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/>
                </svg>
                TikTok
              </Button>
            </a>
          )}
          {ctaConfig?.threadsUrl && (
            <a
              href={ctaConfig.threadsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("threads")}
            >
              <Button
                variant="outline"
                className="w-full gap-2"
                style={{ borderColor: "#000000", color: "#000000" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.17.408-2.243 1.33-3.023.88-.744 2.121-1.158 3.476-1.155l-.001.002c.453.003.876.033 1.27.085a8.594 8.594 0 0 0-.016-1.846c-.078-.927-.307-2.016-1.078-2.942-.894-1.074-2.357-1.62-4.349-1.62-.953 0-1.763.157-2.408.467-.649.312-1.127.707-1.42 1.176-.49.784-.627 1.676-.685 2.249l-2.032-.264c.083-.79.292-1.856.864-2.77.438-.7 1.098-1.29 1.962-1.757.96-.52 2.14-.78 3.505-.78h.016c2.502 0 4.443.724 5.77 2.153.983 1.058 1.475 2.363 1.574 3.644.038.495.033.964 0 1.406.376.182.72.39 1.03.628.887.684 1.514 1.548 1.867 2.57.46 1.332.457 2.86-.008 4.298-.55 1.703-1.659 3.089-3.209 4.012-1.478.88-3.327 1.343-5.503 1.377h-.014l.001.001zM10.075 13.479c-.882.018-1.614.247-2.12.665-.524.433-.764.972-.733 1.648.034.74.396 1.31 1.046 1.65.59.31 1.403.453 2.264.398 1.089-.058 1.9-.455 2.41-1.181.475-.673.715-1.607.715-2.775 0-.093 0-.186-.003-.28a8.829 8.829 0 0 0-1.422-.125h-.004c-.718 0-1.434.059-2.154 0h.001z"/>
                </svg>
                Threads
              </Button>
            </a>
          )}
          {ctaConfig?.xUrl && (
            <a
              href={ctaConfig.xUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("x")}
            >
              <Button
                variant="outline"
                className="w-full gap-2"
                style={{ borderColor: "#000000", color: "#000000" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                X
              </Button>
            </a>
          )}
          {ctaConfig?.googleMapsUrl && (
            <a
              href={ctaConfig.googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackClick("google_maps")}
            >
              <Button
                variant="outline"
                className="w-full gap-2"
                style={{ borderColor: "#4285F4", color: "#4285F4" }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                マップ
              </Button>
            </a>
          )}
        </div>

        {/* カスタムCTAボタン */}
        {ctaConfig?.customCTAs && ctaConfig.customCTAs.length > 0 && (
          <div className="space-y-2">
            {ctaConfig.customCTAs.map((cta) => (
              <a
                key={cta.id}
                href={cta.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackClick(`custom_${cta.id}`)}
              >
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  style={{ borderColor: cta.color || mainColor, color: cta.color || mainColor }}
                >
                  {cta.label}
                </Button>
              </a>
            ))}
          </div>
        )}

        {/* 医院ホームページへのリンク */}
        {ctaConfig?.clinicHomepageUrl && (
          <a
            href={ctaConfig.clinicHomepageUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick("clinic_homepage")}
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-lg font-medium text-white transition-all duration-200 hover:opacity-90 hover:shadow-lg active:scale-[0.98]"
            style={{ backgroundColor: mainColor || "#2563eb" }}
          >
            <Building2 className="w-5 h-5" />
            医院について詳しく見る
          </a>
        )}
      </div>
    </div>
  );
}
