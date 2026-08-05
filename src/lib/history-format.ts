// 「QR読み込み履歴」の1行を組み立てる共通ロジック。
// ダッシュボード（/api/dashboard/history）と共有ページ（/api/shared/[token]/history）で
// 同じ見え方・同じ件数になるよう、整形処理をここに集約する。
//
// 行の作られ方は2通り:
//   A. QR読み込みログ（AccessLog の qr_scan）から作る行
//      → 紐付く完了セッションがあれば、その年齢・性別・診断結果を同じ行に合体させる
//        （読み込みと完了が別々の2行に分かれないので、件数＝実際の読み込み回数になる）
//   B. 読み込みログに紐付いていない完了セッションから作る行
//      → qr_scan 計測開始（2026/5/10）前の過去データや、QRを介さない直接アクセス
import { getCtaTypeName } from "@/lib/cta-types";

// 診断タイプの表示名（DBに名前が無い場合のフォールバック）
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

const GENDER_NAMES: Record<string, string> = {
  male: "男性",
  female: "女性",
  other: "-",
};

// Prisma の include 指定（両APIで同じ形のデータを取るために共有）
export const HISTORY_SESSION_INCLUDE = {
  channel: { select: { id: true, name: true } },
  diagnosisType: { select: { slug: true, name: true } },
  ctaClicks: { select: { ctaType: true } },
  _count: { select: { ctaClicks: true } },
} as const;

export const HISTORY_SCAN_INCLUDE = {
  channel: { select: { id: true, name: true } },
  session: { include: HISTORY_SESSION_INCLUDE },
} as const;

export type HistorySession = {
  id: string;
  createdAt: Date;
  userAge: number | null;
  userGender: string | null;
  resultCategory: string | null;
  sessionType: string | null;
  region: string | null;
  city: string | null;
  town: string | null;
  channel: { id: string; name: string } | null;
  diagnosisType: { slug: string; name: string } | null;
  ctaClicks: { ctaType: string }[];
  _count: { ctaClicks: number };
};

export type HistoryScanLog = {
  id: string;
  createdAt: Date;
  region: string | null;
  city: string | null;
  channel: { id: string; name: string } | null;
  session: HistorySession | null;
};

export interface HistoryRow {
  id: string;
  // 行の中身の種類。診断/リンクが完了していればその種類、
  // 読み込みだけで終わっていれば "qr_scan"
  type: "diagnosis" | "link" | "qr_scan";
  // この行がどのテーブル由来か（削除APIがどちらを消すか判断するのに使う）
  sourceType: "qr_scan" | "session";
  // 紐付く完了セッション（読み込みだけの行では null）
  sessionId: string | null;
  createdAt: Date;
  userAge: number | null;
  userGender: string | null;
  diagnosisType: string;
  diagnosisTypeSlug: string | null;
  resultCategory: string | null;
  channelName: string;
  channelId: string | null;
  area: string;
  ctaType: string | null;
  ctaClickCount: number;
  ctaByType: Record<string, number>;
}

// エリア表示（都道府県 + 市区町村 + 町名）。取れている分だけつなげる
function formatArea(
  region: string | null,
  city: string | null,
  town: string | null
): string {
  const parts = [region, city, town].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : "-";
}

// セッションの中身（年齢・性別・診断結果・CTA）を行の形に整える
function sessionFields(s: HistorySession) {
  const ctaByType: Record<string, number> = {};
  for (const click of s.ctaClicks) {
    ctaByType[click.ctaType] = (ctaByType[click.ctaType] || 0) + 1;
  }
  const ctaClick = s.ctaClicks[0];

  const diagnosisTypeName =
    s.sessionType === "link"
      ? "リンクQR"
      : s.diagnosisType?.name ||
        DIAGNOSIS_TYPE_NAMES[s.diagnosisType?.slug || ""] ||
        "不明";

  return {
    type: (s.sessionType === "link" ? "link" : "diagnosis") as
      | "diagnosis"
      | "link",
    sessionId: s.id,
    userAge: s.userAge,
    userGender: s.userGender
      ? GENDER_NAMES[s.userGender] || s.userGender
      : null,
    diagnosisType: diagnosisTypeName,
    diagnosisTypeSlug: s.diagnosisType?.slug || null,
    resultCategory: s.resultCategory,
    ctaType: ctaClick ? getCtaTypeName(ctaClick.ctaType) : null,
    ctaClickCount: s._count.ctaClicks,
    ctaByType,
  };
}

/**
 * B: 読み込みログに紐付いていない完了セッションから1行を作る。
 */
export function formatSessionRow(s: HistorySession): HistoryRow {
  return {
    id: s.id,
    sourceType: "session",
    createdAt: s.createdAt,
    channelName: s.channel?.name || "不明",
    channelId: s.channel?.id || null,
    area: formatArea(s.region, s.city, s.town),
    ...sessionFields(s),
  };
}

/**
 * A: QR読み込みログから1行を作る。
 * 紐付く完了セッションがあれば、その属性を同じ行にまとめる。
 *
 * 日時は「読み込んだ時刻」（ログ側）を使う。
 * エリアはセッション側のほうがGPSベースで精度が高いので、あればそちらを優先する。
 */
export function formatScanRow(log: HistoryScanLog): HistoryRow {
  const base = {
    id: log.id,
    sourceType: "qr_scan" as const,
    createdAt: log.createdAt,
    channelName: log.channel?.name || log.session?.channel?.name || "不明",
    channelId: log.channel?.id || log.session?.channel?.id || null,
  };

  if (!log.session) {
    // 読み込まれただけ（プロフィール入力前に離脱など）
    return {
      ...base,
      type: "qr_scan",
      sessionId: null,
      userAge: null,
      userGender: null,
      diagnosisType: "QR読み込み",
      diagnosisTypeSlug: null,
      resultCategory: null,
      area: formatArea(log.region, log.city, null),
      ctaType: null,
      ctaClickCount: 0,
      ctaByType: {},
    };
  }

  const sessionArea = formatArea(
    log.session.region,
    log.session.city,
    log.session.town
  );

  return {
    ...base,
    area: sessionArea !== "-" ? sessionArea : formatArea(log.region, log.city, null),
    ...sessionFields(log.session),
  };
}

/**
 * 読み込み由来の行とセッション由来の行をまとめて日時の新しい順に並べる。
 */
export function mergeHistoryRows(
  scanRows: HistoryRow[],
  sessionRows: HistoryRow[]
): HistoryRow[] {
  return [...scanRows, ...sessionRows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}
