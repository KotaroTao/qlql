"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft, Download, Copy, ExternalLink, Image as ImageIcon, X,
  Calendar, Link2, Upload, Loader2, Check,
  FileText, Trash2, Paperclip, QrCode, BarChart3,
} from "lucide-react";

// フォーム内のセクション見出し（基本情報/効果分析設定/補足設定）
function FormSection({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 pb-2 border-b">
        <span className="text-blue-600">{icon}</span>
        <h3 className="font-semibold text-gray-800">{title}</h3>
        {hint && <span className="text-xs text-gray-500 ml-auto">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
import { useDemoGuard } from "@/components/dashboard/demo-guard";

// 診断タイプの表示名
const DIAGNOSIS_TYPE_NAMES: Record<string, string> = {
  "oral-age": "お口年齢診断",
  "child-orthodontics": "子供の矯正タイミングチェック",
  "periodontal-risk": "歯周病リスク診断",
  "cavity-risk": "虫歯リスク診断",
  "whitening-check": "ホワイトニング適正診断",
  "teeth-yellowing": "歯の黄ばみ診断",
  "visit-timing": "受診タイミング診断",
  "bad-breath-risk": "口臭リスク診断",
  "bruxism-risk": "歯ぎしりリスク診断",
  "denture-risk": "入れ歯危険度診断",
};

interface DocumentItem {
  url: string;
  name: string;
  size: number;
  uploadedAt: string;
}

interface Channel {
  id: string;
  code: string;
  name: string;
  displayName: string | null;
  description: string | null;
  imageUrl: string | null;
  imageUrl2: string | null;
  channelType: "diagnosis" | "link";
  diagnosisTypeSlug: string | null;
  redirectUrl: string | null;
  isActive: boolean;
  expiresAt: string | null;
  scanCount: number;
  budget: number | null;
  distributionMethod: string | null;
  distributionQuantity: number | null;
  distributionPeriod: string | null;
  documents: DocumentItem[];
  flyerId: string | null;
}

interface SubscriptionInfo {
  isDemo?: boolean;
}

// チラシ選択用に最小限の情報だけ持つ型（フェッチ結果を保持）
interface FlyerOption {
  id: string;
  name: string;
}

export default function ChannelDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [channel, setChannel] = useState<Channel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  // showImageModal は Phase 2 で QR個別の画像プレビュー廃止に伴い削除
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  // 「このQRを掲載するチラシ」セレクトのための選択肢
  const [flyerOptions, setFlyerOptions] = useState<FlyerOption[]>([]);
  const { DemoModal } = useDemoGuard();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    displayName: "",
    description: "",
    isActive: true,
    imageUrl: "" as string | null,
    imageUrl2: "" as string | null,
    redirectUrl: "",
    expiresAt: "",
    budget: "",
    distributionMethod: "",
    distributionQuantity: "",
    distributionPeriod: "",
    documents: [] as DocumentItem[],
    flyerId: "",
  });
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 自動保存用: 初回データ読み込みフラグとデバウンスタイマー
  const isInitialLoad = useRef(true);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // saveData が channel を依存に含めると、保存成功→setChannel→saveData 再生成→
  // 自動保存 useEffect が再実行→無限保存ループとなり、入力途中の値が
  // API レスポンスで上書きされて空欄になる不具合の原因になる。
  // channel は ref 経由で参照し、依存からは外す。
  const channelRef = useRef<Channel | null>(null);

  const isDemo = subscription?.isDemo;

  const baseUrl = typeof window !== "undefined"
    ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
    : "";
  const qrUrl = channel
    ? channel.channelType === "diagnosis"
      ? `${baseUrl}/c/${channel.code}/${channel.diagnosisTypeSlug}`
      : `${baseUrl}/c/${channel.code}`
    : "";

  useEffect(() => {
    const fetchChannel = async () => {
      try {
        const response = await fetch(`/api/channels/${id}`);
        if (response.ok) {
          const data = await response.json();
          setChannel(data.channel);

          let expiresAtValue = "";
          if (data.channel.expiresAt) {
            const date = new Date(data.channel.expiresAt);
            expiresAtValue = date.toISOString().slice(0, 16);
          }

          setFormData({
            name: data.channel.name,
            displayName: data.channel.displayName || "",
            description: data.channel.description || "",
            isActive: data.channel.isActive,
            imageUrl: data.channel.imageUrl || null,
            imageUrl2: data.channel.imageUrl2 || null,
            redirectUrl: data.channel.redirectUrl || "",
            expiresAt: expiresAtValue,
            budget: data.channel.budget !== null ? String(data.channel.budget) : "",
            distributionMethod: data.channel.distributionMethod || "",
            distributionQuantity: data.channel.distributionQuantity !== null ? String(data.channel.distributionQuantity) : "",
            distributionPeriod: data.channel.distributionPeriod || "",
            documents: data.channel.documents || [],
            flyerId: data.channel.flyerId || "",
          });
          // 初回読み込み完了 → 以降の変更で自動保存を有効化
          setTimeout(() => { isInitialLoad.current = false; }, 100);
        }
      } catch (error) {
        console.error("Failed to fetch channel:", error);
      } finally {
        setIsLoading(false);
      }
    };

    const fetchSubscription = async () => {
      try {
        const response = await fetch("/api/billing/subscription");
        if (response.ok) {
          const data = await response.json();
          setSubscription(data.subscription);
        }
      } catch (error) {
        console.error("Failed to fetch subscription:", error);
      }
    };

    // チラシセレクト用に医院の全チラシを取得
    const fetchFlyers = async () => {
      try {
        const response = await fetch("/api/flyers");
        if (response.ok) {
          const data = await response.json();
          setFlyerOptions(
            (data.flyers || []).map((f: { id: string; name: string }) => ({
              id: f.id,
              name: f.name,
            }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch flyers:", error);
      }
    };

    if (id) {
      fetchChannel();
      fetchSubscription();
      fetchFlyers();
    }
  }, [id]);

  // QR code rendering
  useEffect(() => {
    if (channel && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 256,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    }
  }, [channel, qrUrl]);

  // Hash scroll
  useEffect(() => {
    if (!isLoading && channel && typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash) {
        setTimeout(() => {
          const element = document.querySelector(hash);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        }, 100);
      }
    }
  }, [isLoading, channel]);

  // QR download handlers
  const handleDownloadPNG = () => {
    if (!canvasRef.current || !channel) return;
    const link = document.createElement("a");
    link.download = `qr-${channel.name}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const handleDownloadSVG = async () => {
    if (!channel) return;
    try {
      const svgString = await QRCode.toString(qrUrl, {
        type: "svg",
        width: 256,
        margin: 2,
      });
      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `qr-${channel.name}.svg`;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("SVG download error:", error);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // channel state を ref にミラーして saveData が常に最新値を参照できるようにする。
  // これで saveData の依存配列から channel を外せる（無限保存ループ防止）。
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  // 自動保存の実行関数（デバウンスなし、直接保存する）
  const saveData = useCallback(async (dataToSave: typeof formData) => {
    const ch = channelRef.current;
    if (!ch || isDemo) return;
    if (!dataToSave.name.trim()) return; // 名前が空の場合は保存しない

    if (ch.channelType === "link" && dataToSave.redirectUrl.trim()) {
      try {
        new URL(dataToSave.redirectUrl);
      } catch {
        return; // 無効なURLの場合は保存しない
      }
    }

    setIsSaving(true);
    setError("");
    setSaveSuccess(false);

    try {
      // QR掲載方法は必須項目だが、未設定（空文字）の場合はフィールド自体を
      // 送らないことで、既存データの上書きと自動保存エラーを回避する
      // （ユーザーがプルダウンで選んだ時のみ更新される。UI側でも警告表示済み）
      const patchBody: Record<string, unknown> = {
        name: dataToSave.name,
        displayName: dataToSave.displayName || null,
        description: dataToSave.description,
        isActive: dataToSave.isActive,
        imageUrl: dataToSave.imageUrl,
        imageUrl2: dataToSave.imageUrl2,
        expiresAt: dataToSave.expiresAt || null,
        redirectUrl: ch.channelType === "link" ? dataToSave.redirectUrl : null,
        budget: dataToSave.budget || null,
        distributionQuantity: dataToSave.distributionQuantity || null,
        distributionPeriod: dataToSave.distributionPeriod || null,
        documents: dataToSave.documents,
        // flyerId: 空文字 → null（チラシ紐付け解除）、値あり → そのIDに紐付け
        flyerId: dataToSave.flyerId || null,
      };
      if (dataToSave.distributionMethod) {
        patchBody.distributionMethod = dataToSave.distributionMethod;
      }

      const response = await fetch(`/api/channels/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "保存に失敗しました");
        return;
      }

      setChannel((prev) => prev ? { ...prev, ...data.channel } : data.channel);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsSaving(false);
    }
  // channel は channelRef 経由で参照するため依存から外す（無限保存ループ防止）
  }, [id, isDemo]);

  // formData が変わるたびにデバウンス付き自動保存
  useEffect(() => {
    // 初回読み込み時は保存しない
    if (isInitialLoad.current) return;
    if (isDemo) return;

    // 前のタイマーをクリア
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // 1秒後に保存
    debounceTimer.current = setTimeout(() => {
      saveData(formData);
    }, 1000);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [formData, saveData, isDemo]);

  // Form handlers
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      setFormData({ ...formData, [name]: (e.target as HTMLInputElement).checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  // Phase 2 で QR個別の画像アップロード機能は廃止。チラシ画像はチラシ側で管理する。

  if (isLoading) {
    return <div className="text-gray-500">読み込み中...</div>;
  }

  if (!channel) {
    return (
      <div className="max-w-2xl mx-auto">
        <Link href="/dashboard" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" />
          ダッシュボードに戻る
        </Link>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <p className="text-red-600">{error || "QRコードが見つかりません"}</p>
        </div>
      </div>
    );
  }

  const diagnosisTypeName = channel.diagnosisTypeSlug
    ? DIAGNOSIS_TYPE_NAMES[channel.diagnosisTypeSlug] || channel.diagnosisTypeSlug
    : null;

  return (
    <div className="max-w-3xl mx-auto pb-28">
      <Link href="/dashboard" className="inline-flex items-center text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="w-4 h-4 mr-1" />
        ダッシュボードに戻る
      </Link>

      {/* QR Code Section */}
      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 mb-6">
        <div className="flex flex-col items-center">
          <div className="bg-white p-4 rounded-lg border mb-4">
            <canvas ref={canvasRef} />
          </div>

          <p className="text-sm text-gray-600 mb-4">
            {channel.channelType === "diagnosis"
              ? `このQRコードをスキャンすると「${diagnosisTypeName}」が開始されます`
              : "このQRコードをスキャンするとリダイレクト先URLに遷移します"}
          </p>

          <div className="flex flex-wrap gap-3 mb-6 justify-center">
            <Button onClick={handleDownloadPNG} className="gap-2">
              <Download className="w-4 h-4" />
              PNG
            </Button>
            <Button onClick={handleDownloadSVG} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              SVG
            </Button>
            <Button variant="outline" onClick={handleCopy} className="gap-2">
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  コピーしました
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  URLをコピー
                </>
              )}
            </Button>
          </div>

          <div className="w-full bg-gray-50 rounded-lg p-4">
            <div className="text-sm text-gray-500 mb-1">
              {channel.channelType === "diagnosis" ? "診断URL" : "QRコードURL"}
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-white px-3 py-2 rounded border text-sm break-all">
                {qrUrl}
              </code>
              <a href={qrUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="ghost" size="sm">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Form Section */}
      <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold">設定</h2>
          <span className="text-xs text-gray-500">自動保存されます</span>
        </div>

        <div className="space-y-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>
          )}

          {/* セクション1: 基本情報 */}
          <FormSection
            icon={<QrCode className="w-4 h-4" />}
            title="基本情報"
            hint="QRコードの名前と種類"
          >
          {/* Phase 2: チラシ画像はチラシ側で管理するため、QR個別の画像アップロード欄は廃止 */}

          {/* 2-3. QRコード名 (PCで2カラム) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">
              QRコード名（管理用） <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              name="name"
              type="text"
              placeholder="例: チラシ①（駅前配布）"
              value={formData.name}
              onChange={handleChange}
              disabled={!!isDemo}
            />
            <p className="text-xs text-gray-500">管理画面で表示される名前です</p>
          </div>

          {/* 3. QRコード名（一般表示用） */}
          <div className="space-y-2">
            <Label htmlFor="displayName">
              QRコード名（一般表示用）
            </Label>
            <Input
              id="displayName"
              name="displayName"
              type="text"
              placeholder="例: お口の健康チェック"
              value={formData.displayName}
              onChange={handleChange}
              disabled={!!isDemo}
            />
            <p className="text-xs text-gray-500">QRコードを読み込んだ際のアンケートページに表示される名前です</p>
          </div>
          </div>

          {/* Diagnosis type (read-only) */}
          {channel.channelType === "diagnosis" && channel.diagnosisTypeSlug && (
            <div className="space-y-2">
              <Label>診断タイプ</Label>
              <div className="px-3 py-2 bg-gray-50 rounded-md text-sm text-gray-600">
                {DIAGNOSIS_TYPE_NAMES[channel.diagnosisTypeSlug] || channel.diagnosisTypeSlug}
              </div>
              <p className="text-xs text-gray-500">診断タイプは変更できません</p>
            </div>
          )}

          {/* Redirect URL (link type) */}
          {channel.channelType === "link" && (
            <div className="space-y-2">
              <Label htmlFor="redirectUrl" className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-gray-500" />
                リダイレクト先URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="redirectUrl"
                name="redirectUrl"
                type="url"
                placeholder="https://example.com/page"
                value={formData.redirectUrl}
                onChange={handleChange}
                disabled={!!isDemo}
              />
              <p className="text-xs text-gray-500">QRコードをスキャンした際のリダイレクト先URL</p>
            </div>
          )}

          </FormSection>

          {/* セクション2: チラシ紐付け
              Phase 2 で配布情報（配布方法・配布枚数・予算・配布期間・チラシ画像）は
              すべてチラシ側に移管。このセクションでは紐付くチラシの選択と有効期限のみ管理する。 */}
          <FormSection
            icon={<BarChart3 className="w-4 h-4" />}
            title="チラシ紐付け / 有効期限"
            hint="配布方法・配布枚数・予算はチラシ側で設定します"
          >
          <div className="space-y-2">
            <Label htmlFor="flyerId" className="flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-gray-500" />
              このQRを掲載するチラシ
              <span className="text-rose-600 text-xs font-medium">必須</span>
            </Label>
            <select
              id="flyerId"
              name="flyerId"
              value={formData.flyerId}
              onChange={handleChange}
              disabled={!!isDemo}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">選択してください</option>
              {flyerOptions.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            {formData.flyerId ? (
              <div className="text-xs bg-blue-50 border border-blue-100 rounded px-3 py-2 text-blue-700">
                ℹ️ 配布枚数・予算・配布方法・配布期間・チラシ画像は
                <span className="font-medium">
                  「{flyerOptions.find((f) => f.id === formData.flyerId)?.name || "選択中のチラシ"}」
                </span>
                の設定が使われます。
                <br />
                <Link
                  href={`/dashboard/flyers/${formData.flyerId}`}
                  className="text-blue-600 hover:underline mt-1 inline-block"
                >
                  → チラシ編集ページを開く
                </Link>
              </div>
            ) : (
              <p className="text-xs text-rose-600">
                ⚠️ チラシが選択されていません。
                <Link href="/dashboard/flyers" className="ml-1 text-blue-600 hover:underline">
                  チラシ管理
                </Link>
                でチラシを作成または選択してください。
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="expiresAt" className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              有効期限（任意）
            </Label>
            <div className="flex gap-2">
              <Input
                id="expiresAt"
                name="expiresAt"
                type="datetime-local"
                value={formData.expiresAt}
                onChange={handleChange}
                disabled={!!isDemo}
                className="flex-1"
              />
              {formData.expiresAt && !isDemo && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormData((prev) => ({ ...prev, expiresAt: "" }))}
                  disabled={isSaving}
                  className="shrink-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
            </div>
            <p className="text-xs text-gray-500">
              期限を過ぎるとQRコードは無効。空欄なら無期限
            </p>
          </div>
          </FormSection>

          {/* セクション3: 補足設定 */}
          <FormSection
            icon={<FileText className="w-4 h-4" />}
            title="補足設定"
            hint="任意"
          >
          {/* 備考 */}
          <div className="space-y-2">
            <Label htmlFor="description">備考</Label>
            <textarea
              id="description"
              name="description"
              rows={10}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="メモや備考を自由に記入できます"
              value={formData.description}
              onChange={handleChange}
              disabled={!!isDemo}
            />
          </div>

          {/* 10. 資料アップロード */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-gray-500" />
              資料アップロード（1ファイル10MBまで）
            </Label>

            {/* アップロード済みファイル一覧 */}
            {formData.documents.length > 0 && (
              <div className="space-y-2">
                {formData.documents.map((doc, index) => (
                  <div key={index} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline truncate block"
                      >
                        {doc.name}
                      </a>
                      <span className="text-xs text-gray-400">
                        {(doc.size / 1024 / 1024).toFixed(1)}MB
                      </span>
                    </div>
                    {!isDemo && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFormData((prev) => ({
                            ...prev,
                            documents: prev.documents.filter((_, i) => i !== index),
                          }));
                        }}
                        disabled={isSaving}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 w-7 p-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* アップロードボタン */}
            {!isDemo && (
              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("doc-input")?.click()}
                  disabled={isUploadingDoc || isSaving}
                  className="gap-2"
                >
                  {isUploadingDoc ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      アップロード中...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      ファイルを追加
                    </>
                  )}
                </Button>
                <input
                  id="doc-input"
                  type="file"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 10 * 1024 * 1024) {
                      setError("ファイルサイズは10MB以下にしてください");
                      return;
                    }
                    setIsUploadingDoc(true);
                    setError("");
                    try {
                      const uploadFormData = new FormData();
                      uploadFormData.append("file", file);
                      uploadFormData.append("folder", "documents");
                      const response = await fetch("/api/upload", {
                        method: "POST",
                        body: uploadFormData,
                      });
                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || "アップロードに失敗しました");
                      }
                      const { url } = await response.json();
                      setFormData((prev) => ({
                        ...prev,
                        documents: [
                          ...prev.documents,
                          { url, name: file.name, size: file.size, uploadedAt: new Date().toISOString() },
                        ],
                      }));
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
                    } finally {
                      setIsUploadingDoc(false);
                      e.target.value = "";
                    }
                  }}
                  className="hidden"
                  disabled={isUploadingDoc || isSaving}
                />
              </div>
            )}
            <p className="text-xs text-gray-400">PDF、画像、Word、Excel など（1ファイル10MBまで、アップロード数無制限）</p>
          </div>
          </FormSection>

          {/* セクション4: ステータス（公開/非公開の切り替え） */}
          <FormSection
            icon={<Check className="w-4 h-4" />}
            title="ステータス"
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                name="isActive"
                checked={formData.isActive}
                onChange={handleChange}
                disabled={!!isDemo}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                このQRコードを有効にする
              </Label>
            </div>
          </FormSection>

        </div>
      </div>

      {/* Phase 2 で QR個別の画像プレビューモーダルは廃止。チラシ画像はチラシ側で確認する。 */}

      {/* D5: デモアカウント制限モーダル（共通コンポーネント） */}
      <DemoModal />

      {/* スティッキー自動保存ステータスバー: 長いフォームでも常に保存状態が見える */}
      {!isDemo && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-30">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1">
              <ArrowLeft className="w-4 h-4" />
              ダッシュボードへ
            </Link>
            <div className="text-sm">
              {isSaving ? (
                <span className="text-gray-500 flex items-center gap-1">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  保存中...
                </span>
              ) : saveSuccess ? (
                <span className="text-green-600 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  保存しました
                </span>
              ) : (
                <span className="text-gray-400">変更すると自動保存されます</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
