-- QR読み込み（access_logs の qr_scan）と診断/入力セッションを結び付ける列を追加。
-- これにより「1回のQR読み込み」と「その結果の完了セッション」を
-- 二重に数えずに集計できる（QRアクセス = 実際に読み込まれた回数）。
ALTER TABLE "diagnosis_sessions" ADD COLUMN "access_log_id" TEXT;

-- 1つの読み込みに紐付くセッションは最大1件（重複紐付けを防ぐ）
CREATE UNIQUE INDEX "diagnosis_sessions_access_log_id_key" ON "diagnosis_sessions"("access_log_id");

-- 未紐付けセッション（access_log_id IS NULL）の集計を高速化
CREATE INDEX "diagnosis_sessions_channel_id_access_log_id_idx" ON "diagnosis_sessions"("channel_id", "access_log_id");

-- qr_scan 件数の集計を高速化
CREATE INDEX "access_logs_channel_id_event_type_created_at_idx" ON "access_logs"("channel_id", "event_type", "created_at");

-- 参照先の読み込みログが消えてもセッションは残す（集計上は「未紐付け」に戻る）
ALTER TABLE "diagnosis_sessions"
  ADD CONSTRAINT "diagnosis_sessions_access_log_id_fkey"
  FOREIGN KEY ("access_log_id") REFERENCES "access_logs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
