"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Calendar,
  User,
  Video,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
} from "lucide-react";

interface Meeting {
  id: string;
  meetingDate: string;
  title: string;
  content: string | null;
  summary: string | null;
  ourStaff: string | null;
  clinicAttendees: string | null;
  zoomUrl: string | null;
  recordingUrl: string | null;
  nextActions: string | null;
  isVisibleToClinic: boolean;
  createdAt: string;
}

interface MeetingForm {
  title: string;
  meetingDate: string;
  content: string;
  summary: string;
  ourStaff: string;
  clinicAttendees: string;
  zoomUrl: string;
  recordingUrl: string;
  nextActions: string;
  isVisibleToClinic: boolean;
}

const emptyForm: MeetingForm = {
  title: "",
  meetingDate: "",
  content: "",
  summary: "",
  ourStaff: "",
  clinicAttendees: "",
  zoomUrl: "",
  recordingUrl: "",
  nextActions: "",
  isVisibleToClinic: true,
};

interface Props {
  clinicId: string;
  onMessage: (msg: { type: "success" | "error"; text: string }) => void;
}

export default function MeetingMinutesAdmin({ clinicId, onMessage }: Props) {
  const [isLoading, setIsLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null); // null=新規作成モード or 閲覧モード
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<MeetingForm>(emptyForm);
  const [isUpdating, setIsUpdating] = useState(false);

  const loadMeetings = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/meetings`);
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings);
      }
    } catch {
      onMessage({ type: "error", text: "議事録の読み込みに失敗しました" });
    } finally {
      setIsLoading(false);
    }
  }, [clinicId, onMessage]);

  useEffect(() => {
    loadMeetings();
  }, [loadMeetings]);

  const startCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(true);
  };

  const startEdit = (meeting: Meeting) => {
    setForm({
      title: meeting.title,
      meetingDate: meeting.meetingDate.slice(0, 16), // datetime-local用
      content: meeting.content || "",
      summary: meeting.summary || "",
      ourStaff: meeting.ourStaff || "",
      clinicAttendees: meeting.clinicAttendees || "",
      zoomUrl: meeting.zoomUrl || "",
      recordingUrl: meeting.recordingUrl || "",
      nextActions: meeting.nextActions || "",
      isVisibleToClinic: meeting.isVisibleToClinic,
    });
    setEditingId(meeting.id);
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const saveForm = async () => {
    if (!form.title.trim() || !form.meetingDate) {
      onMessage({ type: "error", text: "タイトルとミーティング日時を入力してください" });
      return;
    }
    setIsUpdating(true);
    try {
      const url = editingId
        ? `/api/admin/clinics/${clinicId}/meetings/${editingId}`
        : `/api/admin/clinics/${clinicId}/meetings`;
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        onMessage({ type: "success", text: data.message });
        cancelForm();
        loadMeetings();
      } else {
        const data = await res.json();
        onMessage({ type: "error", text: data.error });
      }
    } catch {
      onMessage({ type: "error", text: "保存に失敗しました" });
    } finally {
      setIsUpdating(false);
    }
  };

  const deleteMeeting = async (meetingId: string) => {
    if (!confirm("この議事録を削除しますか？")) return;
    try {
      const res = await fetch(`/api/admin/clinics/${clinicId}/meetings/${meetingId}`, { method: "DELETE" });
      if (res.ok) {
        onMessage({ type: "success", text: "議事録を削除しました" });
        loadMeetings();
      }
    } catch {
      onMessage({ type: "error", text: "削除に失敗しました" });
    }
  };

  const toggleVisibility = async (meeting: Meeting) => {
    await fetch(`/api/admin/clinics/${clinicId}/meetings/${meeting.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isVisibleToClinic: !meeting.isVisibleToClinic }),
    });
    loadMeetings();
  };

  if (isLoading) return <div className="text-gray-500">読み込み中...</div>;

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">議事録</h3>
        {!showForm && (
          <Button size="sm" onClick={startCreate}>
            <Plus className="w-4 h-4 mr-1" />
            新規作成
          </Button>
        )}
      </div>

      {/* 作成/編集フォーム */}
      {showForm && (
        <div className="bg-white rounded-xl shadow-sm border p-4 space-y-4">
          <h4 className="font-bold text-sm">{editingId ? "議事録を編集" : "新しい議事録を作成"}</h4>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">タイトル *</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例: 第3回定期ミーティング"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">ミーティング日時 *</label>
              <input
                type="datetime-local"
                value={form.meetingDate}
                onChange={(e) => setForm({ ...form, meetingDate: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">弊社担当</label>
              <input
                type="text"
                value={form.ourStaff}
                onChange={(e) => setForm({ ...form, ourStaff: e.target.value })}
                placeholder="例: 田尾"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">医院側出席者</label>
              <input
                type="text"
                value={form.clinicAttendees}
                onChange={(e) => setForm({ ...form, clinicAttendees: e.target.value })}
                placeholder="例: 鈴木（理事長）、有田（事務）"
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Zoom URL</label>
              <input
                type="text"
                value={form.zoomUrl}
                onChange={(e) => setForm({ ...form, zoomUrl: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="https://us06web.zoom.us/..."
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">録画URL（Circleback等）</label>
              <input
                type="text"
                value={form.recordingUrl}
                onChange={(e) => setForm({ ...form, recordingUrl: e.target.value })}
                className="w-full border rounded px-3 py-2 text-sm"
                placeholder="https://app.circleback.ai/..."
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">要約</label>
            <textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
              rows={2}
              placeholder="ミーティングの概要をひとことで..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">議事録本文</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm font-mono"
              rows={10}
              placeholder="議事録の内容を記入してください..."
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">次回アクション</label>
            <textarea
              value={form.nextActions}
              onChange={(e) => setForm({ ...form, nextActions: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
              rows={3}
              placeholder="次回までに対応すること..."
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isVisibleToClinic}
                onChange={(e) => setForm({ ...form, isVisibleToClinic: e.target.checked })}
                className="rounded"
              />
              医院側に表示する
            </label>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={saveForm} disabled={isUpdating}>
              <Save className="w-4 h-4 mr-1" />
              {editingId ? "更新" : "作成"}
            </Button>
            <Button variant="outline" onClick={cancelForm}>
              <X className="w-4 h-4 mr-1" />
              キャンセル
            </Button>
          </div>
        </div>
      )}

      {/* 議事録一覧 */}
      {meetings.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center text-gray-400 text-sm">
          議事録がまだありません。「新規作成」ボタンから作成できます。
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting) => {
            const isExpanded = expandedId === meeting.id;
            return (
              <div key={meeting.id} className="bg-white rounded-xl shadow-sm border overflow-hidden">
                {/* ヘッダー */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                  className="w-full p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar className="w-3 h-3" />
                          {new Date(meeting.meetingDate).toLocaleDateString("ja-JP", {
                            year: "numeric", month: "long", day: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </span>
                        {!meeting.isVisibleToClinic && (
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-500">
                            <EyeOff className="w-3 h-3 inline mr-0.5" />
                            非公開
                          </span>
                        )}
                      </div>
                      <h4 className="font-bold text-sm">{meeting.title}</h4>
                      {meeting.summary && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{meeting.summary}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        {meeting.ourStaff && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            弊社: {meeting.ourStaff}
                          </span>
                        )}
                        {meeting.clinicAttendees && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            医院: {meeting.clinicAttendees}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>
                </button>

                {/* 展開時の詳細 */}
                {isExpanded && (
                  <div className="border-t">
                    {/* リンク */}
                    {(meeting.zoomUrl || meeting.recordingUrl) && (
                      <div className="px-4 py-2 bg-gray-50 flex gap-4 flex-wrap text-xs">
                        {meeting.zoomUrl && (
                          <a href={meeting.zoomUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                            <Video className="w-3 h-3" />
                            Zoom
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {meeting.recordingUrl && (
                          <a href={meeting.recordingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                            <FileText className="w-3 h-3" />
                            録画・記録
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* 本文 */}
                    {meeting.content && (
                      <div className="px-4 py-3">
                        <h5 className="text-xs font-bold text-gray-500 mb-1">議事録</h5>
                        <pre className="whitespace-pre-wrap text-sm text-gray-700">{meeting.content}</pre>
                      </div>
                    )}

                    {/* 次回アクション */}
                    {meeting.nextActions && (
                      <div className="px-4 py-3 border-t">
                        <h5 className="text-xs font-bold text-gray-500 mb-1">次回アクション</h5>
                        <pre className="whitespace-pre-wrap text-sm text-gray-700">{meeting.nextActions}</pre>
                      </div>
                    )}

                    {/* 管理者アクション */}
                    <div className="px-4 py-3 border-t bg-gray-50 flex items-center gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); startEdit(meeting); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                      >
                        <Pencil className="w-3 h-3" />
                        編集
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleVisibility(meeting); }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                      >
                        {meeting.isVisibleToClinic ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        {meeting.isVisibleToClinic ? "非公開にする" : "公開にする"}
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteMeeting(meeting.id); }}
                        className="text-red-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
