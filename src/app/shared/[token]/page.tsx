"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import {
  BarChart3,
  QrCode,
  Target,
  Loader2,
  Users,
  TrendingUp,
  MapPin,
  Clock,
  ChevronDown,
  ChevronUp,
  Eye,
} from "lucide-react";
import { getCtaTypeName } from "@/lib/cta-types";

const PERIOD_OPTIONS = [
  { value: "today", label: "今日" },
  { value: "week", label: "今週" },
  { value: "month", label: "今月" },
  { value: "all", label: "全期間" },
];

interface SharedChannel {
  id: string;
  name: string;
  channelType: string;
  diagnosisTypeSlug: string | null;
  budget: number | null;
  distributionMethod: string | null;
  distributionQuantity: number | null;
  accessCount: number;
  ctaCount: number;
  ctaRate: number;
  costPerAccess: number | null;
}

interface SharedStats {
  accessCount: number;
  completedCount: number;
  completionRate: number;
  ctaCount: number;
  ctaRate: number;
  ctaByType: Record<string, number>;
  categoryStats: Record<string, { count: number; ctaCount: number; ctaRate: number }>;
  genderByType: Record<string, number>;
  ageRanges: Record<string, number>;
}

interface ClinicInfo {
  name: string;
  logoUrl: string | null;
  mainColor: string;
}

interface TopRegion {
  region: string;
  count: number;
}

interface DailyTrend {
  date: string;
  accessCount: number;
  ctaCount: number;
}

interface HistoryItem {
  id: string;
  type: string;
  createdAt: string;
  userAge: number | null;
  userGender: string | null;
  diagnosisType: string;
  resultCategory: string | null;
  channelName: string;
  area: string;
  ctaClickCount: number;
  ctaByType: Record<string, number>;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, "0");
  const min = d.getMinutes().toString().padStart(2, "0");
  return `${m}/${day} ${h}:${min}`;
}

export default function SharedDashboardPage() {
  const params = useParams();
  const token = params.token as string;

  const [clinic, setClinic] = useState<ClinicInfo | null>(null);
  const [stats, setStats] = useState<SharedStats | null>(null);
  const [channels, setChannels] = useState<SharedChannel[]>([]);
  const [topRegions, setTopRegions] = useState<TopRegion[]>([]);
  const [dailyTrend, setDailyTrend] = useState<DailyTrend[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState("all");
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [showChannelFilter, setShowChannelFilter] = useState(false);
  const channelFilterRef = useRef<HTMLDivElement>(null);

  // 履歴
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const queryParams = new URLSearchParams({ period });
      if (selectedChannelIds.length > 0) {
        queryParams.set("channelIds", selectedChannelIds.join(","));
      }

      const response = await fetch(`/api/shared/${token}?${queryParams}`);
      if (!response.ok) {
        if (response.status === 404) {
          setError("この共有リンクは無効です。リンクが削除されたか、期限切れの可能性があります。");
        } else {
          setError("データの取得に失敗しました");
        }
        return;
      }

      const data = await response.json();
      setClinic(data.clinic);
      setStats(data.stats);
      setChannels(data.channels);
      setTopRegions(data.topRegions || []);
      setDailyTrend(data.dailyTrend || []);
      setError("");
    } catch {
      setError("通信エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }, [token, period, selectedChannelIds]);

  // 履歴データ取得
  const fetchHistory = useCallback(async (offset = 0, append = false) => {
    try {
      setIsLoadingHistory(true);
      const queryParams = new URLSearchParams({
        period,
        offset: String(offset),
        limit: "20",
      });
      if (selectedChannelIds.length > 0) {
        queryParams.set("channelIds", selectedChannelIds.join(","));
      }

      const response = await fetch(`/api/shared/${token}/history?${queryParams}`);
      if (!response.ok) return;

      const data = await response.json();
      if (append) {
        setHistory((prev) => [...prev, ...data.history]);
      } else {
        setHistory(data.history);
      }
      setHistoryTotalCount(data.totalCount);
      setHistoryHasMore(data.hasMore);
    } catch {
      // エラーは無視
    } finally {
      setIsLoadingHistory(false);
    }
  }, [token, period, selectedChannelIds]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 履歴セクションが開かれたときにデータを取得
  useEffect(() => {
    if (showHistory && history.length === 0) {
      fetchHistory();
    }
  }, [showHistory, history.length, fetchHistory]);

  // 期間やチャンネルが変わったときに履歴をリセット
  useEffect(() => {
    if (showHistory) {
      fetchHistory();
    } else {
      setHistory([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, selectedChannelIds]);

  // 初回読み込み時にすべてのチャンネルを選択状態にする
  const [isInitialized, setIsInitialized] = useState(false);
  useEffect(() => {
    if (!isInitialized && channels.length > 0) {
      setSelectedChannelIds(channels.map((c) => c.id));
      setIsInitialized(true);
    }
  }, [channels, isInitialized]);

  // ドロップダウン外クリックで閉じる
  useEffect(() => {
    if (!showChannelFilter) return;
    const handleClick = (e: MouseEvent) => {
      if (channelFilterRef.current && !channelFilterRef.current.contains(e.target as Node)) {
        setShowChannelFilter(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showChannelFilter]);

  const toggleChannel = (channelId: string) => {
    setSelectedChannelIds((prev) =>
      prev.includes(channelId)
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId]
    );
  };

  const selectAllChannels = () => {
    setSelectedChannelIds(channels.map((c) => c.id));
  };

  const deselectAllChannels = () => {
    setSelectedChannelIds([]);
  };

  if (isLoading && !clinic) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-sm border p-8 max-w-md text-center">
          <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h1 className="text-lg font-bold text-gray-800 mb-2">共有ダッシュボード</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const genderTotal = stats
    ? (stats.genderByType.male || 0) + (stats.genderByType.female || 0) + (stats.genderByType.other || 0)
    : 0;

  const accentColor = clinic?.mainColor || "#2563eb";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {clinic?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={clinic.logoUrl} alt="" className="w-7 h-7 rounded-lg object-cover" />
            ) : (
              <BarChart3 className="w-5 h-5" style={{ color: accentColor }} />
            )}
            <span className="font-bold text-gray-800">{clinic?.name}</span>
            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded flex items-center gap-1">
              <Eye className="w-3 h-3" />
              閲覧専用
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl">
        {/* 期間フィルター + チャンネルフィルター */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex gap-2 flex-wrap">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setPeriod(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  period === opt.value
                    ? "text-white"
                    : "bg-white text-gray-600 border hover:bg-gray-50"
                }`}
                style={period === opt.value ? { backgroundColor: accentColor } : undefined}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {channels.length > 1 && (
            <div className="relative sm:ml-auto" ref={channelFilterRef}>
              <button
                onClick={() => setShowChannelFilter(!showChannelFilter)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <QrCode className="w-4 h-4" />
                QRコード絞り込み
                {selectedChannelIds.length < channels.length && (
                  <span className="text-xs text-white rounded-full w-5 h-5 flex items-center justify-center" style={{ backgroundColor: accentColor }}>
                    {selectedChannelIds.length}
                  </span>
                )}
                {showChannelFilter ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showChannelFilter && (
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-xl shadow-lg p-3 z-30 min-w-[240px]">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b">
                    <span className="text-xs font-medium text-gray-500">QRコード選択</span>
                    <div className="flex gap-2">
                      <button onClick={selectAllChannels} className="text-xs hover:underline" style={{ color: accentColor }}>全選択</button>
                      <button onClick={deselectAllChannels} className="text-xs text-gray-400 hover:underline">全解除</button>
                    </div>
                  </div>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {channels.map((ch) => (
                      <label key={ch.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedChannelIds.includes(ch.id)}
                          onChange={() => toggleChannel(ch.id)}
                          className="rounded border-gray-300"
                          style={{ accentColor: accentColor }}
                        />
                        <span className="text-sm text-gray-700 truncate">{ch.name}</span>
                        <span className="text-xs text-gray-400 ml-auto">
                          {ch.channelType === "diagnosis" ? "診断" : "リンク"}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* サマリーカード */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="text-xs text-gray-500 mb-1">QR読込数</div>
              <div className="text-2xl font-bold text-gray-800">
                {stats.accessCount.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="text-xs text-gray-500 mb-1">診断完了数</div>
              <div className="text-2xl font-bold text-gray-800">
                {stats.completedCount.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="text-xs text-gray-500 mb-1">CTA数</div>
              <div className="text-2xl font-bold text-gray-800">
                {stats.ctaCount.toLocaleString()}
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm border p-4">
              <div className="text-xs text-gray-500 mb-1">CTA率</div>
              <div className="text-2xl font-bold" style={{ color: accentColor }}>
                {stats.ctaRate}%
              </div>
            </div>
          </div>
        )}

        {/* 日別トレンドグラフ */}
        {dailyTrend.length > 1 && (
          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 mb-6">
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: accentColor }} />
              日別トレンド
            </h2>
            <div className="flex items-center gap-4 mb-3 text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: accentColor }} />
                診断完了
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: accentColor, opacity: 0.35 }} />
                CTA
              </span>
            </div>
            {(() => {
              const maxVal = Math.max(...dailyTrend.flatMap((d) => [d.accessCount, d.ctaCount]), 1);
              return (
                <div className="flex items-end gap-px h-32 overflow-x-auto">
                  {dailyTrend.map((d) => {
                    const accessH = (d.accessCount / maxVal) * 100;
                    const ctaH = (d.ctaCount / maxVal) * 100;
                    const label = d.date.slice(5); // "MM-DD"
                    return (
                      <div key={d.date} className="flex flex-col items-center flex-1 min-w-[14px] group relative">
                        {/* ツールチップ */}
                        <div className="absolute bottom-full mb-1 hidden group-hover:block bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
                          {label}: {d.accessCount}件 / CTA {d.ctaCount}件
                        </div>
                        {/* 棒グラフ */}
                        <div className="w-full flex items-end gap-px" style={{ height: "100px" }}>
                          <div
                            className="flex-1 rounded-t-sm transition-all"
                            style={{ height: `${Math.max(accessH, 2)}%`, backgroundColor: accentColor }}
                          />
                          <div
                            className="flex-1 rounded-t-sm transition-all"
                            style={{ height: `${Math.max(ctaH, d.ctaCount > 0 ? 2 : 0)}%`, backgroundColor: accentColor, opacity: 0.35 }}
                          />
                        </div>
                        {/* 日付ラベル（間引き表示） */}
                        {dailyTrend.length <= 14 || dailyTrend.indexOf(d) % Math.ceil(dailyTrend.length / 7) === 0 ? (
                          <span className="text-[9px] text-gray-400 mt-1 -rotate-45 origin-top-left whitespace-nowrap">
                            {label}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* QRコード別 効果 */}
        <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 mb-6">
          <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
            <QrCode className="w-4 h-4" style={{ color: accentColor }} />
            QRコード別 効果
          </h2>
          {channels.length === 0 ? (
            <p className="text-gray-400 text-sm">QRコードがありません</p>
          ) : (
            <div className="space-y-3">
              {channels
                .filter((ch) => selectedChannelIds.includes(ch.id))
                .map((ch) => (
                <div key={ch.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium text-sm text-gray-800">{ch.name}</div>
                    <span className="text-xs text-gray-400">
                      {ch.channelType === "diagnosis" ? "診断型" : "リンク型"}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-lg font-bold text-gray-700">{ch.accessCount.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">読込数</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-700">{ch.ctaCount.toLocaleString()}</div>
                      <div className="text-xs text-gray-400">CTA数</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold" style={{ color: accentColor }}>{ch.ctaRate}%</div>
                      <div className="text-xs text-gray-400">CTA率</div>
                    </div>
                  </div>
                  {(ch.budget || ch.costPerAccess || ch.distributionMethod || ch.distributionQuantity) && (
                    <div className="mt-2 pt-2 border-t flex flex-wrap gap-3 text-xs text-gray-500">
                      {ch.budget != null && (
                        <span>予算: ¥{ch.budget.toLocaleString()}</span>
                      )}
                      {ch.costPerAccess != null && (
                        <span>読込単価: ¥{ch.costPerAccess.toLocaleString()}</span>
                      )}
                      {ch.distributionMethod && (
                        <span>配布: {ch.distributionMethod}</span>
                      )}
                      {ch.distributionQuantity != null && (
                        <span>枚数: {ch.distributionQuantity.toLocaleString()}枚</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CTA内訳 */}
        {stats && Object.keys(stats.ctaByType).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 mb-6">
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: accentColor }} />
              CTA内訳
            </h2>
            <div className="space-y-2">
              {Object.entries(stats.ctaByType)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => {
                  const pct = stats.ctaCount > 0
                    ? Math.round((count / stats.ctaCount) * 100)
                    : 0;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <div className="w-24 text-sm text-gray-600 shrink-0">
                        {getCtaTypeName(type)}
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, backgroundColor: accentColor }}
                        />
                      </div>
                      <div className="text-sm font-medium text-gray-700 w-16 text-right">
                        {count} ({pct}%)
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* 結果カテゴリ別統計 */}
        {stats && Object.keys(stats.categoryStats).length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 mb-6">
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: accentColor }} />
              結果カテゴリ別
            </h2>
            <div className="space-y-2">
              {Object.entries(stats.categoryStats)
                .sort(([, a], [, b]) => b.count - a.count)
                .map(([category, data]) => (
                  <div key={category} className="flex items-center gap-3 text-sm">
                    <div className="w-28 text-gray-600 shrink-0 truncate">{category}</div>
                    <div className="flex-1 text-gray-700">{data.count}件</div>
                    <div className="text-gray-500">CTA {data.ctaCount}件 ({data.ctaRate}%)</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 性別・年齢 & 地域 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          {/* 性別 */}
          {stats && genderTotal > 0 && (
            <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
              <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: accentColor }} />
                性別
              </h2>
              <div className="space-y-2">
                {[
                  { key: "male", label: "男性", color: "#3B82F6" },
                  { key: "female", label: "女性", color: "#EC4899" },
                  { key: "other", label: "その他", color: "#9CA3AF" },
                ].map(({ key, label, color }) => {
                  const count = stats.genderByType[key] || 0;
                  const pct = genderTotal > 0 ? Math.round((count / genderTotal) * 100) : 0;
                  if (count === 0) return null;
                  return (
                    <div key={key} className="flex items-center gap-3">
                      <div className="w-12 text-sm text-gray-600">{label}</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <div className="text-sm text-gray-700 w-20 text-right">{count} ({pct}%)</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 年齢層 */}
          {stats && Object.values(stats.ageRanges).some((v) => v > 0) && (
            <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6">
              <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" style={{ color: accentColor }} />
                年齢層
              </h2>
              <div className="space-y-1.5">
                {Object.entries(stats.ageRanges).map(([range, count]) => {
                  const total = Object.values(stats.ageRanges).reduce((s, v) => s + v, 0);
                  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                  if (count === 0) return null;
                  return (
                    <div key={range} className="flex items-center gap-3">
                      <div className="w-12 text-xs text-gray-600">{range}歳</div>
                      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: accentColor, opacity: 0.7 }} />
                      </div>
                      <div className="text-xs text-gray-700 w-16 text-right">{count} ({pct}%)</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 地域ランキング */}
        {topRegions.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-4 sm:p-6 mb-6">
            <h2 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
              <MapPin className="w-4 h-4" style={{ color: accentColor }} />
              エリア別ランキング
            </h2>
            <div className="space-y-2">
              {topRegions.map((r, i) => {
                const maxCount = topRegions[0]?.count || 1;
                const pct = Math.round((r.count / maxCount) * 100);
                return (
                  <div key={r.region} className="flex items-center gap-3">
                    <div className="w-6 text-center text-sm font-bold" style={{ color: i < 3 ? accentColor : "#9CA3AF" }}>
                      {i + 1}
                    </div>
                    <div className="w-20 text-sm text-gray-700 shrink-0">{r.region}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: accentColor, opacity: i < 3 ? 0.8 : 0.4 }}
                      />
                    </div>
                    <div className="text-sm font-medium text-gray-700 w-12 text-right">
                      {r.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 読み込み履歴（折りたたみ） */}
        <div className="bg-white rounded-xl shadow-sm border mb-6">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="w-full p-4 sm:p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              <Clock className="w-4 h-4" style={{ color: accentColor }} />
              読み込み履歴
              {historyTotalCount > 0 && (
                <span className="text-xs font-normal text-gray-400">({historyTotalCount.toLocaleString()}件)</span>
              )}
            </h2>
            {showHistory ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </button>

          {showHistory && (
            <div className="border-t">
              {isLoadingHistory && history.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-sm">
                  選択した期間内にデータがありません
                </div>
              ) : (
                <>
                  {/* PC用テーブル */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">日時</th>
                          <th className="text-center px-2 py-3 text-xs font-medium text-gray-500">年齢</th>
                          <th className="text-center px-2 py-3 text-xs font-medium text-gray-500">性別</th>
                          <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">診断</th>
                          <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">結果</th>
                          <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">QRコード</th>
                          <th className="text-center px-2 py-3 text-xs font-medium text-gray-500">CTA</th>
                          <th className="text-left px-3 py-3 text-xs font-medium text-gray-500">エリア</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {history.map((item) => (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                              {formatDate(item.createdAt)}
                            </td>
                            <td className="px-2 py-3 text-center text-sm text-gray-700">
                              {item.userAge !== null ? `${item.userAge}歳` : "-"}
                            </td>
                            <td className="px-2 py-3 text-center text-sm text-gray-700">
                              {item.userGender || "-"}
                            </td>
                            <td className="px-3 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                                {item.diagnosisType}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-700">
                              {item.resultCategory ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                                  {item.resultCategory}
                                </span>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-sm font-medium text-gray-900">{item.channelName}</td>
                            <td className="px-2 py-3 text-center">
                              {item.ctaClickCount > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                                  {item.ctaClickCount}件
                                </span>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-600">{item.area}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* モバイル用カード */}
                  <div className="md:hidden divide-y">
                    {history.map((item) => (
                      <div key={item.id} className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-gray-500">{formatDate(item.createdAt)}</span>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                              {item.diagnosisType}
                            </span>
                            {item.resultCategory && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                                {item.resultCategory}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-700">
                              {item.userAge !== null ? `${item.userAge}歳` : "-"} / {item.userGender || "-"}
                            </span>
                            <span className="text-sm font-medium text-gray-900">{item.channelName}</span>
                          </div>
                          {item.ctaClickCount > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: `${accentColor}15`, color: accentColor }}>
                              CTA {item.ctaClickCount}件
                            </span>
                          )}
                        </div>
                        {item.area !== "-" && (
                          <div className="mt-1 text-xs text-gray-400">{item.area}</div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* もっと読み込む */}
                  {historyHasMore && (
                    <div className="p-4 text-center border-t">
                      <button
                        onClick={() => fetchHistory(history.length, true)}
                        disabled={isLoadingHistory}
                        className="px-4 py-2 text-sm font-medium rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-50"
                        style={{ color: accentColor }}
                      >
                        {isLoadingHistory ? (
                          <span className="flex items-center gap-2 justify-center">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            読み込み中...
                          </span>
                        ) : (
                          "もっと見る"
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="text-center text-xs text-gray-400 py-8">
          Powered by QRくるくる診断DX
        </div>
      </main>
    </div>
  );
}
