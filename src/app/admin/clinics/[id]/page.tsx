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
  Plus,
  Trash2,
  Send,
  Bell,
  Heart,
  MessageSquare,
  ChevronUp,
  Pencil,
} from "lucide-react";

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

interface ClinicTask {
  id: string;
  taskType: string;
  title: string;
  description: string | null;
  status: string;
  priority: number;
  note: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  reminderCount: number;
  lastRemindedAt: string | null;
  createdAt: string;
}

type TabType = "dashboard" | "channels" | "settings" | "diagnosis" | "tasks";

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

  // Tasks state（対応依頼）
  const [tasks, setTasks] = useState<ClinicTask[]>([]);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<string>("request");
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ taskType: "other", title: "", description: "" });
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState("");

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
        case "tasks":
          await loadTasks();
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

  // --- 対応依頼の関数群 ---
  const loadTasks = async () => {
    const response = await fetch(`/api/admin/clinics/${clinicId}/tasks`);
    if (response.ok) {
      const data = await response.json();
      setClinicName(data.clinicName);
      setTasks(data.tasks);
    }
  };

  const createDefaultTasks = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createDefaults: true }),
      });
      if (res.ok) {
        const data = await res.json();
        setMessage({ type: "success", text: data.message });
        loadTasks();
      } else {
        const data = await res.json();
        setMessage({ type: "error", text: data.error });
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const addCustomTask = async () => {
    if (!newTask.title.trim()) {
      setMessage({ type: "error", text: "タイトルを入力してください" });
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTask),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "タスクを追加しました" });
        setNewTask({ taskType: "other", title: "", description: "" });
        setShowAddTask(false);
        loadTasks();
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        loadTasks();
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const saveNote = async (taskId: string) => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: editingNote }),
      });
      if (res.ok) {
        setEditingNoteId(null);
        loadTasks();
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("このタスクを削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/tasks/${taskId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessage({ type: "success", text: "タスクを削除しました" });
        loadTasks();
      }
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    }
  };

  const generateMessageForTask = async (taskId: string, type: string) => {
    setIsGeneratingMessage(true);
    setMessageType(type);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/tasks/${taskId}/message?type=${type}`);
      if (res.ok) {
        const data = await res.json();
        setGeneratedMessage(data.message);
        setExpandedTaskId(taskId);
      }
    } catch {
      setMessage({ type: "error", text: "メッセージ生成に失敗しました" });
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const recordReminder = async (taskId: string) => {
    await fetch(`/api/admin/clinics/${clinicId}/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reminded: true }),
    });
    loadTasks();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return { label: "未依頼", className: "bg-gray-100 text-gray-700" };
      case "requested":
        return { label: "依頼済", className: "bg-yellow-100 text-yellow-700" };
      case "in_progress":
        return { label: "対応中", className: "bg-blue-100 text-blue-700" };
      case "completed":
        return { label: "完了", className: "bg-green-100 text-green-700" };
      default:
        return { label: status, className: "bg-gray-100 text-gray-700" };
    }
  };

  const getTaskTypeLabel = (taskType: string) => {
    switch (taskType) {
      case "hp_name_change": return "HP医院名変更";
      case "gbp_name_change": return "GBP医院名変更";
      case "nap_unification": return "NAP統一";
      default: return "その他";
    }
  };

  const tabs = [
    { id: "dashboard", label: "ダッシュボード", icon: BarChart3 },
    { id: "channels", label: "QRコード", icon: QrCode },
    { id: "settings", label: "設定", icon: Settings },
    { id: "diagnosis", label: "診断タイプ", icon: FileText },
    { id: "tasks", label: "対応依頼", icon: ClipboardList },
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

          {/* 対応依頼タブ */}
          {activeTab === "tasks" && (
            <div className="space-y-6">
              {/* アクションボタン */}
              <div className="flex gap-3 flex-wrap">
                <Button
                  onClick={createDefaultTasks}
                  disabled={isUpdating}
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  デフォルトタスクを作成
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddTask(!showAddTask)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  カスタムタスクを追加
                </Button>
              </div>

              {/* カスタムタスク追加フォーム */}
              {showAddTask && (
                <div className="bg-white rounded-xl shadow-sm border p-4 space-y-3">
                  <h3 className="font-bold text-sm">カスタムタスクを追加</h3>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">タスク種別</label>
                      <select
                        value={newTask.taskType}
                        onChange={(e) => setNewTask({ ...newTask, taskType: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="hp_name_change">HP医院名変更</option>
                        <option value="gbp_name_change">GBP医院名変更</option>
                        <option value="nap_unification">NAP統一</option>
                        <option value="other">その他</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">タイトル</label>
                      <input
                        type="text"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        placeholder="例: EPARKの医院名変更"
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">説明（任意）</label>
                    <textarea
                      value={newTask.description}
                      onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                      className="w-full border rounded px-3 py-2 text-sm"
                      rows={2}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addCustomTask} disabled={isUpdating}>
                      追加
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddTask(false)}>
                      キャンセル
                    </Button>
                  </div>
                </div>
              )}

              {/* タスク一覧 */}
              {tasks.length === 0 ? (
                <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-500">
                  対応依頼タスクがありません。「デフォルトタスクを作成」ボタンで一括作成できます。
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => {
                    const badge = getStatusBadge(task.status);
                    const isExpanded = expandedTaskId === task.id;
                    return (
                      <div key={task.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                        {/* タスクヘッダー */}
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                                  {badge.label}
                                </span>
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-50 text-gray-500">
                                  {getTaskTypeLabel(task.taskType)}
                                </span>
                                {task.reminderCount > 0 && (
                                  <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-600">
                                    催促 {task.reminderCount}回
                                  </span>
                                )}
                              </div>
                              <h3 className="font-bold">{task.title}</h3>
                              {task.description && (
                                <p className="text-sm text-gray-500 mt-1">{task.description}</p>
                              )}
                              <div className="flex gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                                {task.requestedAt && (
                                  <span>依頼日: {new Date(task.requestedAt).toLocaleDateString("ja-JP")}</span>
                                )}
                                {task.completedAt && (
                                  <span>完了日: {new Date(task.completedAt).toLocaleDateString("ja-JP")}</span>
                                )}
                                {task.lastRemindedAt && (
                                  <span>最終催促: {new Date(task.lastRemindedAt).toLocaleDateString("ja-JP")}</span>
                                )}
                              </div>
                            </div>

                            {/* ステータス変更 */}
                            <div className="flex-shrink-0">
                              <select
                                value={task.status}
                                onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                                disabled={isUpdating}
                                className="border rounded px-2 py-1 text-sm"
                              >
                                <option value="pending">未依頼</option>
                                <option value="requested">依頼済</option>
                                <option value="in_progress">対応中</option>
                                <option value="completed">完了</option>
                              </select>
                            </div>
                          </div>

                          {/* メモ表示・編集 */}
                          <div className="mt-3">
                            {editingNoteId === task.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={editingNote}
                                  onChange={(e) => setEditingNote(e.target.value)}
                                  placeholder="メモを入力..."
                                  className="flex-1 border rounded px-2 py-1 text-sm"
                                />
                                <Button size="sm" onClick={() => saveNote(task.id)} disabled={isUpdating}>
                                  保存
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => setEditingNoteId(null)}>
                                  取消
                                </Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => {
                                  setEditingNoteId(task.id);
                                  setEditingNote(task.note || "");
                                }}
                                className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
                              >
                                <Pencil className="w-3 h-3" />
                                {task.note ? (
                                  <span className="text-gray-600">{task.note}</span>
                                ) : (
                                  <span>メモを追加</span>
                                )}
                              </button>
                            )}
                          </div>

                          {/* アクションボタン */}
                          <div className="flex items-center gap-2 mt-3 pt-3 border-t flex-wrap">
                            <button
                              onClick={() => {
                                if (isExpanded && messageType === "request") {
                                  setExpandedTaskId(null);
                                } else {
                                  generateMessageForTask(task.id, "request");
                                }
                              }}
                              disabled={isGeneratingMessage}
                              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                            >
                              <Send className="w-3 h-3" />
                              依頼メッセージ
                            </button>
                            <button
                              onClick={() => {
                                if (isExpanded && messageType === "reminder") {
                                  setExpandedTaskId(null);
                                } else {
                                  generateMessageForTask(task.id, "reminder");
                                }
                              }}
                              disabled={isGeneratingMessage}
                              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
                            >
                              <Bell className="w-3 h-3" />
                              催促メッセージ
                            </button>
                            <button
                              onClick={() => {
                                if (isExpanded && messageType === "thanks") {
                                  setExpandedTaskId(null);
                                } else {
                                  generateMessageForTask(task.id, "thanks");
                                }
                              }}
                              disabled={isGeneratingMessage}
                              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
                            >
                              <Heart className="w-3 h-3" />
                              お礼メッセージ
                            </button>

                            <div className="flex-1" />

                            <button
                              onClick={() => deleteTask(task.id)}
                              className="flex items-center gap-1 px-2 py-1.5 rounded text-xs text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                              削除
                            </button>
                          </div>
                        </div>

                        {/* メッセージ表示エリア */}
                        {isExpanded && generatedMessage && (
                          <div className="border-t bg-gray-50 p-4">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-gray-500" />
                                <span className="text-sm font-medium text-gray-700">
                                  {messageType === "request" && "依頼メッセージ"}
                                  {messageType === "reminder" && "催促メッセージ"}
                                  {messageType === "thanks" && "お礼メッセージ"}
                                </span>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(generatedMessage);
                                    setMessage({ type: "success", text: "メッセージをコピーしました" });
                                    setTimeout(() => setMessage(null), 2000);
                                    // 催促の場合、カウントを記録
                                    if (messageType === "reminder") {
                                      recordReminder(task.id);
                                    }
                                    // 依頼の場合、ステータスを「依頼済」に更新
                                    if (messageType === "request" && task.status === "pending") {
                                      updateTaskStatus(task.id, "requested");
                                    }
                                    // お礼の場合、ステータスを「完了」に更新
                                    if (messageType === "thanks" && task.status !== "completed") {
                                      updateTaskStatus(task.id, "completed");
                                    }
                                  }}
                                  className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                >
                                  <Copy className="w-3 h-3" />
                                  コピー
                                </button>
                                <button
                                  onClick={() => setExpandedTaskId(null)}
                                  className="text-gray-400 hover:text-gray-600"
                                >
                                  <ChevronUp className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white rounded border p-3 max-h-80 overflow-y-auto">
                              {generatedMessage}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 進捗サマリー */}
              {tasks.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border p-4">
                  <h3 className="font-bold mb-3 text-sm">進捗サマリー</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-lg bg-gray-50">
                      <div className="text-2xl font-bold text-gray-600">
                        {tasks.filter((t) => t.status === "pending").length}
                      </div>
                      <div className="text-xs text-gray-500">未依頼</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-yellow-50">
                      <div className="text-2xl font-bold text-yellow-600">
                        {tasks.filter((t) => t.status === "requested").length}
                      </div>
                      <div className="text-xs text-gray-500">依頼済</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-50">
                      <div className="text-2xl font-bold text-blue-600">
                        {tasks.filter((t) => t.status === "in_progress").length}
                      </div>
                      <div className="text-xs text-gray-500">対応中</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50">
                      <div className="text-2xl font-bold text-green-600">
                        {tasks.filter((t) => t.status === "completed").length}
                      </div>
                      <div className="text-xs text-gray-500">完了</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
