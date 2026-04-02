# SLP連携 実装完了報告
実装日: 2026-04-02

## 1. 作成・変更したファイル一覧
- 新規作成: src/app/api/integration/issue-token/route.ts
- 新規作成: src/app/api/integration/verify-token/route.ts
- 変更: next.config.mjs
- 変更: prisma/schema.prisma
- 変更: src/app/admin/clinics/page.tsx

## 2. APIエンドポイント（確定URL）
- トークン発行: POST https://qrqr-dental.com/api/integration/issue-token
- トークン検証: POST https://qrqr-dental.com/api/integration/verify-token

## 3. DBに追加したテーブル・フィールド名（実際のもの）
- テーブル名: SlpIntegrationToken（DBテーブル名: slp_integration_tokens）
- フィールド: id, token, clinic_id, expires_at, used_at, created_at

## 4. 環境変数
- SLP_DOMAIN に設定すべき値: https://（SLPの本番ドメイン）

## 5. share_tokenの状況
- 全医院に share_token が設定されているか: 要確認（本番DBで確認が必要）
- 未設定の医院がある場合: verify-token APIが SHARE_TOKEN_NOT_SET エラーを返すため、事前に設定が必要

## 6. 動作確認済み項目
- [ ] issue-token APIが正常にトークンを返す
- [ ] verify-token APIが正しいトークンでshareTokenを返す
- [ ] verify-token APIが不正なトークンでTOKEN_INVALIDを返す
- [ ] verify-token APIが期限切れトークンでTOKEN_EXPIREDを返す
- [ ] verify-token APIが使用済みトークンでTOKEN_USEDを返す
- [ ] /admin/clinics に「SLP連携」ボタンが表示される
- [ ] モーダルにトークンとコピーボタンが表示される
- [ ] 10分カウントダウンが動作する
- [ ] /shared/[token] がSLPドメインのiframeで表示される
- [ ] /shared/[token] が他のドメインからブロックされる

## 7. 備考・注意事項
- 本環境にはDATABASE_URLが設定されていないため、Prismaマイグレーションは本番/ステージング環境で `npx prisma migrate dev --name add_slp_integration_token` または `npx prisma db push` を実行する必要がある
- SLP_DOMAIN 環境変数が未設定の場合、next.config.mjs ではフォールバック値 `https://smile-life-project.com` が使用される（本番デプロイ前に正しいドメインを設定すること）
- share_token が未設定の医院がある場合、SLP連携時に SHARE_TOKEN_NOT_SET エラーとなる。事前に全医院の share_token を確認・設定すること
