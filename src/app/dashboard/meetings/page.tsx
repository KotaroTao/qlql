"use client";

import { useEffect, useState } from "react";
import {
  Calendar,
  User,
  Video,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  BookOpen,
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
}

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const loadMeetings = async () => {
      try {
        const res = await fetch("/api/dashboard/meetings");
        if (res.ok) {
          const data = await res.json();
          setMeetings(data.meetings);
        }
      } catch {
        console.error("議事録の読み込みに失敗しました");
      } finally {
        setIsLoading(false);
      }
    };
    loadMeetings();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-gray-500 py-12 text-center">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <BookOpen className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-bold">議事録</h1>
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center text-gray-400">
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>議事録はまだありません</p>
          <p className="text-sm mt-1">ミーティング後に議事録が追加されます</p>
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
                      </div>
                      <h3 className="font-bold">{meeting.title}</h3>
                      {meeting.summary && (
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{meeting.summary}</p>
                      )}
                      <div className="flex gap-3 mt-1 text-xs text-gray-400 flex-wrap">
                        {meeting.ourStaff && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            担当: {meeting.ourStaff}
                          </span>
                        )}
                        {meeting.clinicAttendees && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            出席: {meeting.clinicAttendees}
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
                      <div className="px-4 py-2 bg-gray-50 flex gap-4 flex-wrap text-sm">
                        {meeting.zoomUrl && (
                          <a href={meeting.zoomUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                            <Video className="w-3.5 h-3.5" />
                            Zoom
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        {meeting.recordingUrl && (
                          <a href={meeting.recordingUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                            <FileText className="w-3.5 h-3.5" />
                            録画・記録
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    )}

                    {/* 本文 */}
                    {meeting.content && (
                      <div className="px-4 py-4">
                        <h4 className="text-xs font-bold text-gray-500 mb-2">議事録</h4>
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{meeting.content}</pre>
                      </div>
                    )}

                    {/* 次回アクション */}
                    {meeting.nextActions && (
                      <div className="px-4 py-4 border-t bg-blue-50/30">
                        <h4 className="text-xs font-bold text-blue-600 mb-2">次回アクション</h4>
                        <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{meeting.nextActions}</pre>
                      </div>
                    )}

                    {!meeting.content && !meeting.nextActions && (
                      <div className="px-4 py-6 text-center text-gray-400 text-sm">
                        詳細な議事録はまだ追加されていません
                      </div>
                    )}
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
