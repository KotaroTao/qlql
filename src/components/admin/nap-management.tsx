"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Send,
  Bell,
  Heart,
  Copy,
  ChevronUp,
  Pencil,
  MessageSquare,
  Save,
  CheckCircle,
  XCircle,
  HelpCircle,
  ExternalLink,
  ClipboardList,
} from "lucide-react";

// ========== 型定義 ==========

interface NapInfo {
  officialName?: string;
  postalCode?: string;
  prefecture?: string;
  city?: string;
  address?: string;
  building?: string;
  phone?: string;
  fax?: string;
  url?: string;
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
}

interface NapPlatform {
  id: string;
  platformName: string;
  platformUrl: string | null;
  nameStatus: string;
  addressStatus: string;
  phoneStatus: string;
  status: string;
  note: string | null;
  requestedAt: string | null;
  completedAt: string | null;
  reminderCount: number;
  lastRemindedAt: string | null;
}

interface Props {
  clinicId: string;
  onMessage: (msg: { type: "success" | "error"; text: string }) => void;
}

// ========== ヘルパー関数 ==========

const getTaskStatusBadge = (status: string) => {
  switch (status) {
    case "pending": return { label: "未依頼", className: "bg-gray-100 text-gray-700" };
    case "requested": return { label: "依頼済", className: "bg-yellow-100 text-yellow-700" };
    case "in_progress": return { label: "対応中", className: "bg-blue-100 text-blue-700" };
    case "completed": return { label: "完了", className: "bg-green-100 text-green-700" };
    default: return { label: status, className: "bg-gray-100 text-gray-700" };
  }
};

const getPlatformStatusBadge = (status: string) => {
  switch (status) {
    case "unchecked": return { label: "未確認", className: "bg-gray-100 text-gray-600" };
    case "ok": return { label: "問題なし", className: "bg-green-100 text-green-700" };
    case "requested": return { label: "修正依頼済", className: "bg-yellow-100 text-yellow-700" };
    case "completed": return { label: "修正完了", className: "bg-green-100 text-green-700" };
    default: return { label: status, className: "bg-gray-100 text-gray-600" };
  }
};

const NapStatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "match": return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "mismatch": return <XCircle className="w-4 h-4 text-red-500" />;
    default: return <HelpCircle className="w-4 h-4 text-gray-300" />;
  }
};

// ========== メインコンポーネント ==========

export default function NapManagement({ clinicId, onMessage }: Props) {
  // 状態
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [napInfo, setNapInfo] = useState<NapInfo>({});
  const [napForm, setNapForm] = useState<NapInfo>({});
  const [isEditingNap, setIsEditingNap] = useState(false);
  const [tasks, setTasks] = useState<ClinicTask[]>([]);
  const [platforms, setPlatforms] = useState<NapPlatform[]>([]);

  // メッセージ関連
  const [messageTarget, setMessageTarget] = useState<{ type: "task" | "platform"; id: string } | null>(null);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [messageType, setMessageType] = useState("request");
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);

  // タスク追加
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ taskType: "other", title: "", description: "" });

  // 媒体追加
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [newPlatform, setNewPlatform] = useState({ platformName: "", platformUrl: "" });

  // メモ編集
  const [editingNoteTarget, setEditingNoteTarget] = useState<{ type: "task" | "platform"; id: string } | null>(null);
  const [editingNote, setEditingNote] = useState("");

  // ========== データ読み込み ==========

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/nap`);
      if (res.ok) {
        const data = await res.json();
        const info = (data.napInfo || {}) as NapInfo;
        setNapInfo(info);
        setNapForm(info);
        setTasks(data.tasks);
        setPlatforms(data.platforms);
      }
    } catch {
      onMessage({ type: "error", text: "データの読み込みに失敗しました" });
    } finally {
      setIsLoading(false);
    }
  }, [clinicId, onMessage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ========== 正式NAP情報 ==========

  const saveNapInfo = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/nap`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(napForm),
      });
      if (res.ok) {
        const data = await res.json();
        setNapInfo(data.napInfo);
        setIsEditingNap(false);
        onMessage({ type: "success", text: "正式NAP情報を更新しました" });
      }
    } catch {
      onMessage({ type: "error", text: "更新に失敗しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  // ========== 対応依頼 ==========

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
        onMessage({ type: "success", text: data.message });
        loadData();
      }
    } catch {
      onMessage({ type: "error", text: "タスク作成に失敗しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const addCustomTask = async () => {
    if (!newTask.title.trim()) {
      onMessage({ type: "error", text: "タイトルを入力してください" });
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
        onMessage({ type: "success", text: "タスクを追加しました" });
        setNewTask({ taskType: "other", title: "", description: "" });
        setShowAddTask(false);
        loadData();
      }
    } catch {
      onMessage({ type: "error", text: "タスク追加に失敗しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const updateTaskStatus = async (taskId: string, status: string) => {
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) onMessage({ type: "error", text: "ステータス更新に失敗しました" });
    } catch {
      onMessage({ type: "error", text: "通信エラーが発生しました" });
    }
    loadData();
  };

  const deleteTask = async (taskId: string) => {
    if (!confirm("このタスクを削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/tasks/${taskId}`, { method: "DELETE" });
      if (res.ok) onMessage({ type: "success", text: "タスクを削除しました" });
      else onMessage({ type: "error", text: "削除に失敗しました" });
    } catch {
      onMessage({ type: "error", text: "通信エラーが発生しました" });
    }
    loadData();
  };

  // ========== 媒体管理 ==========

  const createDefaultPlatforms = async () => {
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/nap/platforms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createDefaults: true }),
      });
      if (res.ok) {
        const data = await res.json();
        onMessage({ type: "success", text: data.message });
        loadData();
      }
    } catch {
      onMessage({ type: "error", text: "媒体追加に失敗しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const addCustomPlatform = async () => {
    if (!newPlatform.platformName.trim()) {
      onMessage({ type: "error", text: "媒体名を入力してください" });
      return;
    }
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/nap/platforms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPlatform),
      });
      if (res.ok) {
        onMessage({ type: "success", text: "媒体を追加しました" });
        setNewPlatform({ platformName: "", platformUrl: "" });
        setShowAddPlatform(false);
        loadData();
      }
    } catch {
      onMessage({ type: "error", text: "媒体追加に失敗しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const updatePlatform = async (platformId: string, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/nap/platforms/${platformId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) onMessage({ type: "error", text: "更新に失敗しました" });
    } catch {
      onMessage({ type: "error", text: "通信エラーが発生しました" });
    }
    loadData();
  };

  const deletePlatform = async (platformId: string) => {
    if (!confirm("この媒体を削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/nap/platforms/${platformId}`, { method: "DELETE" });
      if (res.ok) onMessage({ type: "success", text: "媒体を削除しました" });
      else onMessage({ type: "error", text: "削除に失敗しました" });
    } catch {
      onMessage({ type: "error", text: "通信エラーが発生しました" });
    }
    loadData();
  };

  // ========== メッセージ生成 ==========

  const generateMessage = async (targetType: "task" | "platform", targetId: string, type: string) => {
    // 同じターゲット・同じタイプなら閉じる
    if (messageTarget?.type === targetType && messageTarget?.id === targetId && messageType === type) {
      setMessageTarget(null);
      return;
    }
    setIsGeneratingMessage(true);
    setMessageType(type);
    try {
      const url = targetType === "task"
        ? `/api/admin/clinics/${clinicId}/tasks/${targetId}/message?type=${type}`
        : `/api/admin/clinics/${clinicId}/nap/platforms/${targetId}/message?type=${type}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setGeneratedMessage(data.message);
        setMessageTarget({ type: targetType, id: targetId });
      }
    } catch {
      onMessage({ type: "error", text: "メッセージ生成に失敗しました" });
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const copyMessage = async (targetType: "task" | "platform", targetId: string) => {
    navigator.clipboard.writeText(generatedMessage);
    onMessage({ type: "success", text: "メッセージをコピーしました" });

    // ステータス自動更新のためのデータを決定（APIは1回だけ叩く）
    let patchData: Record<string, unknown> | null = null;

    if (targetType === "task") {
      const task = tasks.find((t) => t.id === targetId);
      if (messageType === "reminder") patchData = { reminded: true };
      else if (messageType === "request" && task?.status === "pending") patchData = { status: "requested" };
      else if (messageType === "thanks" && task?.status !== "completed") patchData = { status: "completed" };

      if (patchData) {
        await fetch(`/api/admin/clinics/${clinicId}/tasks/${targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchData),
        });
      }
    } else {
      const platform = platforms.find((p) => p.id === targetId);
      if (messageType === "reminder") patchData = { reminded: true };
      else if (messageType === "request" && platform?.status === "unchecked") patchData = { status: "requested" };
      else if (messageType === "thanks" && platform?.status !== "completed") patchData = { status: "completed" };

      if (patchData) {
        await fetch(`/api/admin/clinics/${clinicId}/nap/platforms/${targetId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchData),
        });
      }
    }

    if (patchData) loadData();
  };

  // ========== メモ保存 ==========

  const saveNote = async () => {
    if (!editingNoteTarget) return;
    const { type, id } = editingNoteTarget;
    const url = type === "task"
      ? `/api/admin/clinics/${clinicId}/tasks/${id}`
      : `/api/admin/clinics/${clinicId}/nap/platforms/${id}`;
    await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: editingNote }),
    });
    setEditingNoteTarget(null);
    loadData();
  };

  // ========== メッセージ表示パネル ==========

  const MessagePanel = ({ targetType, targetId }: { targetType: "task" | "platform"; targetId: string }) => {
    if (!messageTarget || messageTarget.type !== targetType || messageTarget.id !== targetId) return null;
    return (
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
              onClick={() => copyMessage(targetType, targetId)}
              className="flex items-center gap-1 px-3 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <Copy className="w-3 h-3" />
              コピー
            </button>
            <button onClick={() => setMessageTarget(null)} className="text-gray-400 hover:text-gray-600">
              <ChevronUp className="w-4 h-4" />
            </button>
          </div>
        </div>
        <pre className="whitespace-pre-wrap text-sm text-gray-700 bg-white rounded border p-3 max-h-80 overflow-y-auto">
          {generatedMessage}
        </pre>
      </div>
    );
  };

  // ========== メモ表示 ==========

  const NoteEditor = ({ targetType, targetId, currentNote }: { targetType: "task" | "platform"; targetId: string; currentNote: string | null }) => {
    const isEditing = editingNoteTarget?.type === targetType && editingNoteTarget?.id === targetId;
    if (isEditing) {
      return (
        <div className="flex gap-2 mt-2">
          <input
            type="text"
            value={editingNote}
            onChange={(e) => setEditingNote(e.target.value)}
            placeholder="メモを入力..."
            className="flex-1 border rounded px-2 py-1 text-sm"
          />
          <Button size="sm" onClick={saveNote} disabled={isUpdating}>保存</Button>
          <Button size="sm" variant="outline" onClick={() => setEditingNoteTarget(null)}>取消</Button>
        </div>
      );
    }
    return (
      <button
        onClick={() => {
          setEditingNoteTarget({ type: targetType, id: targetId });
          setEditingNote(currentNote || "");
        }}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 mt-2"
      >
        <Pencil className="w-3 h-3" />
        {currentNote ? <span className="text-gray-600">{currentNote}</span> : <span>メモを追加</span>}
      </button>
    );
  };

  // ========== メッセージボタン群 ==========

  const MessageButtons = ({ targetType, targetId }: { targetType: "task" | "platform"; targetId: string }) => (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => generateMessage(targetType, targetId, "request")}
        disabled={isGeneratingMessage}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
      >
        <Send className="w-3 h-3" />
        依頼
      </button>
      <button
        onClick={() => generateMessage(targetType, targetId, "reminder")}
        disabled={isGeneratingMessage}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-orange-50 text-orange-700 hover:bg-orange-100 transition-colors"
      >
        <Bell className="w-3 h-3" />
        催促
      </button>
      <button
        onClick={() => generateMessage(targetType, targetId, "thanks")}
        disabled={isGeneratingMessage}
        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors"
      >
        <Heart className="w-3 h-3" />
        お礼
      </button>
    </div>
  );

  if (isLoading) return <div className="text-gray-500">読み込み中...</div>;

  // ========== 統計計算 ==========

  const platformStats = useMemo(() => ({
    total: platforms.length,
    unchecked: platforms.filter((p) => p.status === "unchecked").length,
    ok: platforms.filter((p) => p.status === "ok").length,
    requested: platforms.filter((p) => p.status === "requested").length,
    completed: platforms.filter((p) => p.status === "completed").length,
  }), [platforms]);

  const taskStats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
  }), [tasks]);

  // ========== JSX ==========

  return (
    <div className="space-y-8">
      {/* ===== 進捗サマリー ===== */}
      {(platforms.length > 0 || tasks.length > 0) && (
        <div className="bg-white rounded-xl shadow-sm border p-4">
          <h3 className="font-bold mb-3 text-sm">全体の進捗</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="text-center p-3 rounded-lg bg-blue-50">
              <div className="text-2xl font-bold text-blue-600">
                {taskStats.completed}/{taskStats.total}
              </div>
              <div className="text-xs text-gray-500">対応依頼</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-gray-50">
              <div className="text-2xl font-bold text-gray-500">{platformStats.unchecked}</div>
              <div className="text-xs text-gray-500">未確認</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">{platformStats.ok}</div>
              <div className="text-xs text-gray-500">問題なし</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-yellow-50">
              <div className="text-2xl font-bold text-yellow-600">{platformStats.requested}</div>
              <div className="text-xs text-gray-500">修正依頼済</div>
            </div>
            <div className="text-center p-3 rounded-lg bg-green-50">
              <div className="text-2xl font-bold text-green-600">{platformStats.completed}</div>
              <div className="text-xs text-gray-500">修正完了</div>
            </div>
          </div>
        </div>
      )}

      {/* ===== セクション1: 正式NAP情報 ===== */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <h3 className="font-bold">正式NAP情報（マスターデータ）</h3>
          {!isEditingNap && (
            <Button size="sm" variant="outline" onClick={() => { setNapForm(napInfo); setIsEditingNap(true); }}>
              <Pencil className="w-3 h-3 mr-1" />
              編集
            </Button>
          )}
        </div>
        <div className="p-4">
          {isEditingNap ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">正式医院名</label>
                <input
                  type="text"
                  value={napForm.officialName || ""}
                  onChange={(e) => setNapForm({ ...napForm, officialName: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="例: 医療法人○○会 △△歯科医院"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">郵便番号</label>
                  <input
                    type="text"
                    value={napForm.postalCode || ""}
                    onChange={(e) => setNapForm({ ...napForm, postalCode: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例: 123-4567"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">都道府県</label>
                  <input
                    type="text"
                    value={napForm.prefecture || ""}
                    onChange={(e) => setNapForm({ ...napForm, prefecture: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例: 東京都"
                  />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">市区町村</label>
                  <input
                    type="text"
                    value={napForm.city || ""}
                    onChange={(e) => setNapForm({ ...napForm, city: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例: 渋谷区"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">番地</label>
                  <input
                    type="text"
                    value={napForm.address || ""}
                    onChange={(e) => setNapForm({ ...napForm, address: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例: 代々木4-32-1"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">建物名</label>
                <input
                  type="text"
                  value={napForm.building || ""}
                  onChange={(e) => setNapForm({ ...napForm, building: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="例: トーシンビルミレニアム 5F"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">電話番号</label>
                  <input
                    type="text"
                    value={napForm.phone || ""}
                    onChange={(e) => setNapForm({ ...napForm, phone: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例: 03-1234-5678"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">FAX番号</label>
                  <input
                    type="text"
                    value={napForm.fax || ""}
                    onChange={(e) => setNapForm({ ...napForm, fax: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例: 03-1234-5679"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">ホームページURL</label>
                  <input
                    type="text"
                    value={napForm.url || ""}
                    onChange={(e) => setNapForm({ ...napForm, url: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm"
                    placeholder="例: https://example-dental.com"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={saveNapInfo} disabled={isUpdating}>
                  <Save className="w-4 h-4 mr-1" />
                  保存
                </Button>
                <Button variant="outline" onClick={() => setIsEditingNap(false)}>キャンセル</Button>
              </div>
            </div>
          ) : (
            <div>
              {napInfo.officialName ? (
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">医院名:</span>
                    <span className="ml-2 font-medium">{napInfo.officialName}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">住所:</span>
                    <span className="ml-2">
                      {[napInfo.postalCode ? `〒${napInfo.postalCode}` : "", napInfo.prefecture, napInfo.city, napInfo.address, napInfo.building].filter(Boolean).join(" ")}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">電話番号:</span>
                    <span className="ml-2">{napInfo.phone || "-"}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">FAX:</span>
                    <span className="ml-2">{napInfo.fax || "-"}</span>
                  </div>
                  {napInfo.url && (
                    <div className="md:col-span-2">
                      <span className="text-gray-500">URL:</span>
                      <a href={napInfo.url} target="_blank" rel="noopener noreferrer" className="ml-2 text-blue-600 hover:underline">
                        {napInfo.url}
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-400 text-sm">正式NAP情報が未登録です。「編集」ボタンから登録してください。</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ===== セクション2: 対応依頼（NAP統一前の準備） ===== */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gray-500" />
              <h3 className="font-bold">対応依頼（NAP統一前の準備）</h3>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddTask(!showAddTask)}>
                <Plus className="w-3 h-3 mr-1" />
                追加
              </Button>
              {tasks.length === 0 && (
                <Button size="sm" onClick={createDefaultTasks} disabled={isUpdating}>
                  デフォルト作成
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* カスタムタスク追加フォーム */}
        {showAddTask && (
          <div className="p-4 border-b bg-blue-50/30 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">種別</label>
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
                  placeholder="例: EPARKの情報更新"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addCustomTask} disabled={isUpdating}>追加</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddTask(false)}>キャンセル</Button>
            </div>
          </div>
        )}

        {/* タスク一覧 */}
        {tasks.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            対応依頼がありません。「デフォルト作成」でHP/GBP医院名変更タスクを作成できます。
          </div>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => {
              const badge = getTaskStatusBadge(task.status);
              return (
                <div key={task.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          {task.reminderCount > 0 && (
                            <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-600">
                              催促 {task.reminderCount}回
                            </span>
                          )}
                        </div>
                        <h4 className="font-bold text-sm">{task.title}</h4>
                        {task.description && <p className="text-xs text-gray-500 mt-0.5">{task.description}</p>}
                        <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                          {task.requestedAt && <span>依頼日: {new Date(task.requestedAt).toLocaleDateString("ja-JP")}</span>}
                          {task.completedAt && <span>完了日: {new Date(task.completedAt).toLocaleDateString("ja-JP")}</span>}
                        </div>
                        <NoteEditor targetType="task" targetId={task.id} currentNote={task.note} />
                      </div>
                      <select
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        className="border rounded px-2 py-1 text-xs flex-shrink-0"
                      >
                        <option value="pending">未依頼</option>
                        <option value="requested">依頼済</option>
                        <option value="in_progress">対応中</option>
                        <option value="completed">完了</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <MessageButtons targetType="task" targetId={task.id} />
                      <button onClick={() => deleteTask(task.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <MessagePanel targetType="task" targetId={task.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===== セクション3: 媒体別NAP統一状況 ===== */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">媒体別NAP統一状況</h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowAddPlatform(!showAddPlatform)}>
                <Plus className="w-3 h-3 mr-1" />
                媒体を追加
              </Button>
              {platforms.length === 0 && (
                <Button size="sm" onClick={createDefaultPlatforms} disabled={isUpdating}>
                  デフォルト媒体を追加
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 媒体追加フォーム */}
        {showAddPlatform && (
          <div className="p-4 border-b bg-blue-50/30 space-y-3">
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">媒体名</label>
                <input
                  type="text"
                  value={newPlatform.platformName}
                  onChange={(e) => setNewPlatform({ ...newPlatform, platformName: e.target.value })}
                  placeholder="例: ホットペッパー"
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">掲載URL（任意）</label>
                <input
                  type="text"
                  value={newPlatform.platformUrl}
                  onChange={(e) => setNewPlatform({ ...newPlatform, platformUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={addCustomPlatform} disabled={isUpdating}>追加</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAddPlatform(false)}>キャンセル</Button>
            </div>
          </div>
        )}

        {platforms.length === 0 ? (
          <div className="p-6 text-center text-gray-400 text-sm">
            媒体が登録されていません。「デフォルト媒体を追加」で一括登録できます。
          </div>
        ) : (
          <div className="divide-y">
            {platforms.map((platform) => {
              const badge = getPlatformStatusBadge(platform.status);
              return (
                <div key={platform.id}>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${badge.className}`}>
                            {badge.label}
                          </span>
                          {platform.reminderCount > 0 && (
                            <span className="px-2 py-0.5 rounded text-xs bg-orange-50 text-orange-600">
                              催促 {platform.reminderCount}回
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm">{platform.platformName}</h4>
                          {platform.platformUrl && (
                            <a href={platform.platformUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>

                        {/* NAP一致状況 */}
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex items-center gap-1.5">
                            <NapStatusIcon status={platform.nameStatus} />
                            <span className="text-xs text-gray-600">名前</span>
                            <select
                              value={platform.nameStatus}
                              onChange={(e) => updatePlatform(platform.id, { nameStatus: e.target.value })}
                              className="border rounded px-1 py-0.5 text-xs ml-1"
                            >
                              <option value="unchecked">未確認</option>
                              <option value="match">一致</option>
                              <option value="mismatch">不一致</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <NapStatusIcon status={platform.addressStatus} />
                            <span className="text-xs text-gray-600">住所</span>
                            <select
                              value={platform.addressStatus}
                              onChange={(e) => updatePlatform(platform.id, { addressStatus: e.target.value })}
                              className="border rounded px-1 py-0.5 text-xs ml-1"
                            >
                              <option value="unchecked">未確認</option>
                              <option value="match">一致</option>
                              <option value="mismatch">不一致</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <NapStatusIcon status={platform.phoneStatus} />
                            <span className="text-xs text-gray-600">電話</span>
                            <select
                              value={platform.phoneStatus}
                              onChange={(e) => updatePlatform(platform.id, { phoneStatus: e.target.value })}
                              className="border rounded px-1 py-0.5 text-xs ml-1"
                            >
                              <option value="unchecked">未確認</option>
                              <option value="match">一致</option>
                              <option value="mismatch">不一致</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                          {platform.requestedAt && <span>依頼日: {new Date(platform.requestedAt).toLocaleDateString("ja-JP")}</span>}
                          {platform.completedAt && <span>完了日: {new Date(platform.completedAt).toLocaleDateString("ja-JP")}</span>}
                        </div>
                        <NoteEditor targetType="platform" targetId={platform.id} currentNote={platform.note} />
                      </div>

                      <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                        <select
                          value={platform.status}
                          onChange={(e) => updatePlatform(platform.id, { status: e.target.value })}
                          className="border rounded px-2 py-1 text-xs"
                        >
                          <option value="unchecked">未確認</option>
                          <option value="ok">問題なし</option>
                          <option value="requested">修正依頼済</option>
                          <option value="completed">修正完了</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <MessageButtons targetType="platform" targetId={platform.id} />
                      <button onClick={() => deletePlatform(platform.id)} className="text-red-400 hover:text-red-600 p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <MessagePanel targetType="platform" targetId={platform.id} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
