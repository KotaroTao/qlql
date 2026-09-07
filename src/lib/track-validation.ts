/**
 * トラッキングAPIの入力値サニタイズ（A6）
 *
 * 方針: 不正な値はリクエストを拒否せず「null」にして無視する
 * → 患者さんの診断体験を絶対に壊さないようにする
 */

/** 年齢を検証。有効なら数値、無効ならnull */
export function sanitizeAge(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const age = typeof value === "string" ? parseInt(value, 10) : Number(value);
  if (!Number.isInteger(age) || age < 0 || age > 120) return null;
  return age;
}

/** 性別を検証。許可された値のみ通す */
const VALID_GENDERS = ["male", "female", "other"];
export function sanitizeGender(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return VALID_GENDERS.includes(value) ? value : null;
}

/** 緯度を検証（-90〜90の範囲） */
export function sanitizeLatitude(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const lat = Number(value);
  if (isNaN(lat) || lat < -90 || lat > 90) return null;
  return lat;
}

/** 経度を検証（-180〜180の範囲） */
export function sanitizeLongitude(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const lng = Number(value);
  if (isNaN(lng) || lng < -180 || lng > 180) return null;
  return lng;
}

/** 文字列を検証（最大長制限つき） */
export function sanitizeString(value: unknown, maxLength: number = 255): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.slice(0, maxLength);
}

/** CTAタイプを検証 */
const VALID_CTA_TYPES = [
  "booking", "phone", "line", "instagram", "website", "email", "direct_link", "other",
  // SNS系
  "youtube", "facebook", "tiktok", "threads", "x",
  // マップ・医院ページ系
  "google_maps", "clinic_page", "clinic_homepage",
];
export function sanitizeCtaType(value: unknown): string | null {
  if (typeof value !== "string") return null;
  // 完全一致チェック、またはカスタムCTA（custom_で始まるもの）を許可
  if (VALID_CTA_TYPES.includes(value)) return value;
  if (value.startsWith("custom_")) return value;
  return null;
}

/** イベントタイプを検証 */
const VALID_EVENT_TYPES = ["page_view", "qr_scan", "diagnosis_start", "diagnosis_complete", "profile_view"];
export function sanitizeEventType(value: unknown): string {
  if (typeof value !== "string") return "page_view";
  return VALID_EVENT_TYPES.includes(value) ? value : "page_view";
}

/**
 * 完了キー（ブラウザが発行する重複防止用の合言葉）を検証。
 * 英数字と - _ のみ、8〜64文字。形式が合わなければ null（＝キーなしとして扱う）
 */
const COMPLETION_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
export function sanitizeCompletionKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return COMPLETION_KEY_PATTERN.test(value) ? value : null;
}
