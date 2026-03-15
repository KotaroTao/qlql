"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { MapPin, Loader2, ChevronRight, Gift } from "lucide-react";
import Link from "next/link";

interface Props {
  channelId: string;
  channelPublicName: string;
  redirectUrl: string;
  mainColor?: string;
}

export function LinkProfileForm({ channelId, channelPublicName, redirectUrl, mainColor = "#2563eb" }: Props) {
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [showLocationStep, setShowLocationStep] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);

  // フォーム送信 → 位置情報ステップへ
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValidForm()) {
      setShowLocationStep(true);
    }
  };

  const isValidForm = () => {
    const ageNum = parseInt(age, 10);
    return ageNum > 0 && ageNum < 120 && gender && agreed;
  };

  // セッション作成してリダイレクト
  const completeAndRedirect = async (latitude: number | null, longitude: number | null) => {
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/track/link-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          userAge: parseInt(age, 10) || null,
          userGender: gender,
          latitude,
          longitude,
        }),
      });

      const data = await response.json();

      // リダイレクト（APIからのURLを優先、フォールバックはpropsのURL）
      const targetUrl = (data.success && data.redirectUrl) ? data.redirectUrl : redirectUrl;

      // 安全なURLかチェック（http/httpsで始まる外部URL）
      if (targetUrl && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
        window.location.href = targetUrl;
      } else {
        console.error("Invalid redirect URL:", targetUrl);
        // フォールバック: propsのredirectUrlを使用
        window.location.href = redirectUrl;
      }
    } catch (err) {
      console.error("Link complete error:", err);
      // エラー時もリダイレクト
      window.location.href = redirectUrl;
    }
  };

  // 位置情報を許可してリダイレクト
  const handleAllowLocation = async () => {
    setIsRequestingLocation(true);
    let latitude: number | null = null;
    let longitude: number | null = null;

    if (typeof window !== "undefined" && navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 30000, // 30秒に延長
            maximumAge: 0,
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
      } catch (error) {
        // GPS拒否またはエラー
        const geoError = error as GeolocationPositionError;
        console.error("Geolocation error:", {
          code: geoError?.code,
          message: geoError?.message,
          // 1: PERMISSION_DENIED, 2: POSITION_UNAVAILABLE, 3: TIMEOUT
        });
      }
    } else {
      console.warn("Geolocation API not available");
    }

    setIsRequestingLocation(false);
    await completeAndRedirect(latitude, longitude);
  };

  // 位置情報をスキップしてリダイレクト
  const handleSkipLocation = async () => {
    await completeAndRedirect(null, null);
  };

  // 入力全体をスキップ
  const handleSkipAll = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/track/link-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          channelId,
          userAge: null,
          userGender: null,
          latitude: null,
          longitude: null,
        }),
      });

      const data = await response.json();
      const targetUrl = (data.success && data.redirectUrl) ? data.redirectUrl : redirectUrl;

      if (targetUrl && (targetUrl.startsWith("http://") || targetUrl.startsWith("https://"))) {
        window.location.href = targetUrl;
      } else {
        window.location.href = redirectUrl;
      }
    } catch (err) {
      console.error("Skip error:", err);
      window.location.href = redirectUrl;
    }
  };

  // 位置情報許可ステップ
  if (showLocationStep) {
    return (
      <Card>
        <CardHeader className="text-center pb-2">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ backgroundColor: mainColor + "20" }}
          >
            <MapPin className="w-10 h-10" style={{ color: mainColor }} />
          </div>
          <CardTitle className="text-xl">位置情報のご協力のお願い</CardTitle>
          <CardDescription className="mt-2">
            サービス向上のため、位置情報の提供にご協力ください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div
            className="rounded-lg p-4 text-sm text-gray-700"
            style={{ backgroundColor: mainColor + "10" }}
          >
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span style={{ color: mainColor }} className="mt-0.5">&#10003;</span>
                <span>市区町村レベルの統計データとして利用</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: mainColor }} className="mt-0.5">&#10003;</span>
                <span>正確な住所は保存されません</span>
              </li>
              <li className="flex items-start gap-2">
                <span style={{ color: mainColor }} className="mt-0.5">&#10003;</span>
                <span>サービス改善に貢献</span>
              </li>
            </ul>
          </div>

          <Button
            onClick={handleAllowLocation}
            size="xl"
            className="w-full gap-2 text-base"
            style={{ backgroundColor: mainColor }}
            disabled={isRequestingLocation || isSubmitting}
          >
            {isRequestingLocation ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                位置情報を取得中...
              </>
            ) : isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                移動中...
              </>
            ) : (
              <>
                <MapPin className="w-5 h-5" />
                位置情報を許可して進む
                <ChevronRight className="w-5 h-5" />
              </>
            )}
          </Button>

          <div className="text-center">
            <button
              onClick={handleSkipLocation}
              disabled={isRequestingLocation || isSubmitting}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              位置情報なしで進む &rarr;
            </button>
          </div>

          <p className="text-xs text-center text-gray-400">
            ※ ブラウザの許可ダイアログが表示されます
          </p>
        </CardContent>
      </Card>
    );
  }

  // プロフィール入力フォーム
  return (
    <Card>
      <CardHeader className="text-center">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: mainColor + "20" }}
        >
          <Gift className="w-8 h-8" style={{ color: mainColor }} />
        </div>
        <CardTitle className="text-xl">{channelPublicName}</CardTitle>
        <CardDescription className="space-y-1">
          <span>簡単なアンケートにご協力ください</span>
          <span className="block text-xs text-gray-400">※ 個人情報は収集されません</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="age">年齢</Label>
            <Input
              id="age"
              type="number"
              placeholder="例: 35"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              min={1}
              max={120}
              className="text-lg"
            />
          </div>

          <div className="space-y-2">
            <Label>性別</Label>
            <RadioGroup
              value={gender || ""}
              onValueChange={(value) => setGender(value || null)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="male" id="male" />
                <Label htmlFor="male" className="font-normal cursor-pointer">
                  男性
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="female" id="female" />
                <Label htmlFor="female" className="font-normal cursor-pointer">
                  女性
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="other" id="other" />
                <Label htmlFor="other" className="font-normal cursor-pointer">
                  回答しない
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* 利用規約同意 */}
          <div className="flex items-start space-x-2">
            <Checkbox
              id="terms"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
            />
            <Label htmlFor="terms" className="text-sm font-normal leading-relaxed cursor-pointer">
              <Link href="/terms" target="_blank" className="text-blue-600 hover:underline">
                利用規約
              </Link>
              ・
              <Link href="/privacy" target="_blank" className="text-blue-600 hover:underline">
                プライバシーポリシー
              </Link>
              に同意する <span className="text-red-500">*</span>
            </Label>
          </div>

          <Button
            type="submit"
            size="xl"
            className="w-full"
            style={{ backgroundColor: isValidForm() ? mainColor : undefined }}
            disabled={!isValidForm() || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                処理中...
              </>
            ) : (
              "次へ"
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={handleSkipAll}
              disabled={isSubmitting}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              スキップして進む &rarr;
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
