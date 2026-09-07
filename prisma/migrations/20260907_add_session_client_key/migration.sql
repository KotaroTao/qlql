-- 診断セッションに「完了キー」列を追加。
-- ブラウザが結果1件につき1つ発行する合言葉で、結果画面のリロードやタブ復帰で
-- 同じ完了が再送信されても、同じキーなら新しいセッションを作らないようにする。
-- （QR読み込み履歴に同じ人が2件並ぶ二重計測の防止）
ALTER TABLE "diagnosis_sessions" ADD COLUMN "client_key" TEXT;

-- 同じ完了キーのセッションは最大1件（ほぼ同時に2回届いても2件目を弾く）
CREATE UNIQUE INDEX "diagnosis_sessions_client_key_key" ON "diagnosis_sessions"("client_key");
