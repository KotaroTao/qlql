"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BarChart3,
  QrCode,
  Settings,
  FileText,
  Users,
  MousePointerClick,
  Eye,
  EyeOff,
  ExternalLink,
  CheckCircle,
  XCircle,
  Copy,
  ClipboardList,
  BookOpen,
} from "lucide-react";
import NapManagement from "@/components/admin/nap-management";
import MeetingMinutesAdmin from "@/components/admin/meeting-minutes";

interface ClinicStats {
  accessCount: number;
  completedCount: number;
  completionRate: number;
  ctaClickCount: number;
  ctaRate: number;
  clinicPageViews: number;
  genderByType: Record<string, number>;
  ageRanges: Record<string, number>;
}

interface Channel {
  id: string;
  code: string;
  name: string;
  description: string | null;
  channelType: string;
  diagnosisTypeSlug: string | null;
  diagnosisTypeName: string | null;
  redirectUrl: string | null;
  isActive: boolean;
  scanCount: number;
  createdAt: string;
}

interface ClinicSettings {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone: string | null;
  logoUrl: string | null;
  mainColor: string;
  ctaConfig: Record<string, unknown>;
  clinicPage: Record<string, unknown>;
  status: string;
  isHidden: boolean;
  excludeFromAnalysis: boolean;
  createdAt: string;
  subscription: {
    status: string;
    planType: string;
    trialEnd: string | null;
    currentPeriodEnd: string | null;
  } | null;
}

interface DiagnosisType {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  isEnabled?: boolean;
  isActive?: boolean;
  isSystem?: boolean;
}

type TabType = "dashboard" | "channels" | "settings" | "diagnosis" | "nap" | "meetings";

export default function AdminClinicDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: clinicId } = use(params);
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Dashboard state
  const [clinicName, setClinicName] = useState("");
  const [stats, setStats] = useState<ClinicStats | null>(null);
  const [period, setPeriod] = useState("month");

  // Channels state
  const [channels, setChannels] = useState<Channel[]>([]);

  // Settings state
  const [settings, setSettings] = useState<ClinicSettings | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Diagnosis types state
  const [systemDiagnosisTypes, setSystemDiagnosisTypes] = useState<DiagnosisType[]>([]);
  const [clinicDiagnosisTypes, setClinicDiagnosisTypes] = useState<DiagnosisType[]>([]);

  const loadTabData = async () => {
    setIsLoading(true);
    try {
      switch (activeTab) {
        case "dashboard":
          await loadStats();
          break;
        case "channels":
          await loadChannels();
          break;
        case "settings":
          await loadSettings();
          break;
        case "diagnosis":
          await loadDiagnosisTypes();
          break;
        case "nap":
        case "meetings":
          // コンポーネントが自身でデータを読み込む
          break;
      }
    } catch (error) {
      console.error("Failed to load data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    const response = await fetch(`/api/admin/clinics/${clinicId}/stats?period=${period}`);
    if (response.ok) {
      const data = await response.json();
      setClinicName(data.clinicName);
      setStats(data.stats);
    }
  };

  const loadChannels = async () => {
    const response = await fetch(`/api/admin/clinics/${clinicId}/channels`);
    if (response.ok) {
      const data = await response.json();
      setClinicName(data.clinicName);
      setChannels(data.channels);
    }
  };

  const loadSettings = async () => {
    const response = await fetch(`/api/admin/clinics/${clinicId}/settings`);
    if (response.ok) {
      const data = await response.json();
      setSettings(data.clinic);
      setClinicName(data.clinic.name);
    }
  };

  const loadDiagnosisTypes = async () => {
    const response = await fetch(`/api/admin/clinics/${clinicId}/diagnosis-types`);
    if (response.ok) {
      const data = await response.json();
      setClinicName(data.clinicName);
      setSystemDiagnosisTypes(data.systemDiagnosisTypes);
      setClinicDiagnosisTypes(data.clinicDiagnosisTypes);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    loadTabData();
  }, [activeTab, clinicId, period]);

  const handleToggleDiagnosis = async (diagnosisTypeId: string, currentEnabled: boolean) => {
    setIsUpdating(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/clinics/${clinicId}/diagnosis-types`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ diagnosisTypeId, isEnabled: !currentEnabled }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessage({ type: "success", text: data.message });
        loadDiagnosisTypes();
      } else {
        const data = await response.json();
        setMessage({ type: "error", text: data.error || "更新に失敗しました" });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage({ type: "success", text: "クリップボードにコピーしました" });
    setTimeout(() => setMessage(null), 2000);
  };

  const getQRUrl = (code: string) => {
    return `https://qrqr-dental.com/q/${code}`;
  };

  const tabs = [
    { id: "dashboard", label: "ダッシュボード", icon: BarChart3 },
    { id: "channels", label: "QRコード", icon: QrCode },
    { id: "settings", label: "設定", icon: Settings },
    { id: "diagnosis", label: "診断タイプ", icon: FileText },
    { id: "nap", label: "NAP", icon: ClipboardList },
    { id: "meetings", label: "議事録", icon: BookOpen },
  ];

  return (
    <div>
      {/* ヘッダー */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/admin/clinics">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">{clinicName || "医院詳細"}</h1>
      </div>

      {/* メッセージ */}
      {message && (
        <div
          className={`p-4 rounded-lg mb-6 ${
            message.type === "success"
              ? "bg-green-50 text-green-600"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* タブ */}
      <div className="flex gap-2 mb-6 border-b overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-gray-500">読み込み中...</div>
      ) : (
        <>
          {/* ダッシュボードタブ */}
          {activeTab === "dashboard" && stats && (
            <div>
              {/* 期間選択 */}
              <div className="flex gap-2 mb-6">
                {["today", "week", "month", "all"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded text-sm ${
                      period === p
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                    }`}
                  >
                    {p === "today" && "今日"}
                    {p === "week" && "週間"}
                    {p === "month" && "月間"}
                    {p === "all" && "全期間"}
                  </button>
                ))}
              </div>

              {/* 統計カード */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <Eye className="w-4 h-4" />
                    アクセス数
                  </div>
                  <div className="text-2xl font-bold">{stats.accessCount.toLocaleString()}</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <Users className="w-4 h-4" />
                    診断完了数
                  </div>
                  <div className="text-2xl font-bold">{stats.completedCount.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">完了率 {stats.completionRate}%</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <MousePointerClick className="w-4 h-4" />
                    CTAクリック
                  </div>
                  <div className="text-2xl font-bold">{stats.ctaClickCount.toLocaleString()}</div>
                  <div className="text-sm text-gray-500">CTA率 {stats.ctaRate}%</div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                    <FileText className="w-4 h-4" />
                    医院ページ閲覧
                  </div>
                  <div className="text-2xl font-bold">{stats.clinicPageViews.toLocaleString()}</div>
                </div>
              </div>

              {/* 性別・年齢統計 */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h3 className="font-bold mb-4">性別統計</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>男性</span>
                      <span className="font-bold">{stats.genderByType.male}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>女性</span>
                      <span className="font-bold">{stats.genderByType.female}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>その他</span>
                      <span className="font-bold">{stats.genderByType.other}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h3 className="font-bold mb-4">年齢層統計</h3>
                  <div className="space-y-1 text-sm">
                    {Object.entries(stats.ageRanges).map(([range, count]) => (
                      <div key={range} className="flex justify-between">
                        <span>{range}歳</span>
                        <span className="font-bold">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* QRコードタブ */}
          {activeTab === "channels" && (
            <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">名前</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">タイプ</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">コード</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">スキャン</th>
                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">状態</th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {channels.map((channel) => (
                    <tr key={channel.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium">{channel.name}</div>
                        {channel.description && (
                          <div className="text-sm text-gray-500">{channel.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-xs ${
                            channel.channelType === "diagnosis"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {channel.channelType === "diagnosis" ? "診断" : "リンク"}
                        </span>
                        {channel.diagnosisTypeName && (
                          <div className="text-xs text-gray-500 mt-1">{channel.diagnosisTypeName}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{channel.code}</code>
                          <button
                            onClick={() => copyToClipboard(getQRUrl(channel.code))}
                            className="text-gray-400 hover:text-gray-600"
                            title="URLをコピー"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">{channel.scanCount}</td>
                      <td className="px-4 py-3 text-center">
                        {channel.isActive ? (
                          <span className="inline-flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-gray-400">
                            <EyeOff className="w-4 h-4" />
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={getQRUrl(channel.code)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <ExternalLink className="w-4 h-4 inline" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {channels.length === 0 && (
                <div className="p-8 text-center text-gray-500">QRコードがありません</div>
              )}
            </div>
          )}

          {/* 設定タブ */}
          {activeTab === "settings" && settings && (
            <div className="bg-white rounded-xl shadow-sm border p-6">
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">医院名</label>
                    <div className="text-lg">{settings.name}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">スラッグ</label>
                    <code className="text-sm bg-gray-100 px-2 py-1 rounded">{settings.slug}</code>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メールアドレス</label>
                    <div>{settings.email}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">電話番号</label>
                    <div>{settings.phone || "-"}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">ステータス</label>
                    <div
                      className={`inline-flex px-2 py-0.5 rounded text-sm ${
                        settings.status === "active"
                          ? "bg-green-100 text-green-700"
                          : settings.status === "trial"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {settings.status}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">プラン</label>
                    <div>{settings.subscription?.planType || "-"}</div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">メインカラー</label>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border"
                        style={{ backgroundColor: settings.mainColor }}
                      />
                      <code className="text-sm">{settings.mainColor}</code>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">登録日</label>
                    <div>{new Date(settings.createdAt).toLocaleDateString("ja-JP")}</div>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-bold mb-4">分析設定</h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">チラシ分析から除外</div>
                      <div className="text-sm text-gray-500">ONにするとチラシ分析ページにこの医院のデータが表示されません</div>
                    </div>
                    <button
                      onClick={async () => {
                        setIsUpdating(true);
                        try {
                          const res = await fetch(`/api/admin/clinics/${clinicId}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ excludeFromAnalysis: !settings.excludeFromAnalysis }),
                          });
                          if (res.ok) {
                            const data = await res.json();
                            setSettings((prev) => prev ? { ...prev, excludeFromAnalysis: !prev.excludeFromAnalysis } : prev);
                            setMessage({ type: "success", text: data.message });
                          }
                        } catch {
                          setMessage({ type: "error", text: "更新に失敗しました" });
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      disabled={isUpdating}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        settings.excludeFromAnalysis ? "bg-blue-600" : "bg-gray-300"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          settings.excludeFromAnalysis ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-bold mb-4">リンク</h3>
                  <div className="space-y-2">
                    <a
                      href={`https://qrqr-dental.com/${settings.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                      医院トップページ
                    </a>
                    <a
                      href={`https://qrqr-dental.com/${settings.slug}/clinic`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
                    >
                      <ExternalLink className="w-4 h-4" />
                      医院紹介ページ
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 診断タイプタブ */}
          {activeTab === "diagnosis" && (
            <div className="space-y-6">
              {/* システム診断タイプ */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="font-bold">システム診断タイプ</h3>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">名前</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">スラッグ</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">状態</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {systemDiagnosisTypes.map((dt) => (
                      <tr key={dt.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{dt.name}</div>
                          {dt.description && (
                            <div className="text-sm text-gray-500">{dt.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{dt.slug}</code>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {dt.isEnabled ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" />
                              有効
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                              <XCircle className="w-3 h-3" />
                              無効
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleDiagnosis(dt.id, dt.isEnabled || false)}
                            disabled={isUpdating}
                          >
                            {dt.isEnabled ? "無効にする" : "有効にする"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* クリニック固有の診断タイプ */}
              <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b">
                  <h3 className="font-bold">クリニック固有の診断タイプ</h3>
                </div>
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">名前</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">スラッグ</th>
                      <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">状態</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {clinicDiagnosisTypes.map((dt) => (
                      <tr key={dt.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium">{dt.name}</div>
                          {dt.description && (
                            <div className="text-sm text-gray-500">{dt.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <code className="text-sm bg-gray-100 px-2 py-0.5 rounded">{dt.slug}</code>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {dt.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" />
                              有効
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                              <XCircle className="w-3 h-3" />
                              無効
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleDiagnosis(dt.id, dt.isActive || false)}
                            disabled={isUpdating}
                          >
                            {dt.isActive ? "無効にする" : "有効にする"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {clinicDiagnosisTypes.length === 0 && (
                  <div className="p-8 text-center text-gray-500">
                    クリニック固有の診断タイプはありません
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NAPタブ */}
          {activeTab === "nap" && (
            <NapManagement
              clinicId={clinicId}
              onMessage={(msg) => {
                setMessage(msg);
                if (msg.type === "success") setTimeout(() => setMessage(null), 3000);
              }}
            />
          )}

          {/* 議事録タブ */}
          {activeTab === "meetings" && (
            <MeetingMinutesAdmin
              clinicId={clinicId}
              onMessage={(msg) => {
                setMessage(msg);
                if (msg.type === "success") setTimeout(() => setMessage(null), 3000);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
