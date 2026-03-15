# QRくるくる診断DX - 運用手順書

## 本番環境構成（Xserver VPS）

### サーバー情報

| 項目 | 値 |
|------|-----|
| ドメイン | qrqr-dental.com |
| サーバーIP | 210.131.223.161 |
| サーバー種別 | Xserver VPS |
| OS | Ubuntu 25.04 |

### 構成図

```
[GitHub]
    ↓ git push (mainブランチ)
[GitHub Actions]
    ↓ SSH自動デプロイ
[Xserver VPS]
├── Nginx ← SSL終端 + リバースプロキシ + 静的ファイル
├── PM2 + Node.js 20 ← Next.jsアプリ (ポート3000)
└── PostgreSQL 17 ← データベース (ポート5432)
```

### デプロイ方法

**自動デプロイ（推奨）:**
```bash
git push origin main
# → GitHub Actionsが自動でデプロイ実行
```

**手動デプロイ（緊急時のみ）:**
```bash
ssh -i ~/Downloads/qlql-key.pem root@210.131.223.161
cd /var/www/qlql
git pull origin main
npm install
npm run build
pm2 restart dental-app
```

---

## SSH接続

### Windows PowerShell
```powershell
ssh -i $env:USERPROFILE\Downloads\qlql-key.pem root@210.131.223.161
```

### Mac/Linux
```bash
ssh -i ~/Downloads/qlql-key.pem root@210.131.223.161
```

---

## プロジェクトパス

```bash
cd /var/www/qlql
```

---

## PM2コマンド

### アプリ状態確認
```bash
pm2 status
```

### ログ確認
```bash
# 全ログ
pm2 logs dental-app

# 直近100行
pm2 logs dental-app --lines 100

# リアルタイム監視
pm2 monit
```

### アプリ再起動
```bash
pm2 restart dental-app
```

### アプリ停止・起動
```bash
pm2 stop dental-app
pm2 start dental-app
```

---

## Nginxコマンド

### 設定テスト
```bash
nginx -t
```

### 再読み込み
```bash
systemctl reload nginx
```

### 再起動
```bash
systemctl restart nginx
```

### ログ確認
```bash
# アクセスログ
tail -f /var/log/nginx/access.log

# エラーログ
tail -f /var/log/nginx/error.log
```

### 設定ファイル
```
/etc/nginx/sites-available/qlql
```

---

## データベース操作

### 接続情報

| 項目 | 値 |
|------|-----|
| ホスト | localhost |
| ポート | 5432 |
| ユーザー | dental_user |
| データベース | dental_check |
| パスワード | .envファイル参照 |

### PostgreSQLに接続
```bash
sudo -u postgres psql -d dental_check
```

### マイグレーション実行
```bash
cd /var/www/qlql
npx prisma db push
```

### シードデータ投入
診断タイプなどの初期データをデータベースに投入します。
```bash
cd /var/www/qlql
npm install --include=dev   # devDependencies（tsx）をインストール
npm run db:seed             # シードを実行
```

**注意**: 本番環境では通常devDependenciesがインストールされないため、`--include=dev`オプションが必要です。

### 手動バックアップ
```bash
sudo -u postgres pg_dump dental_check > /var/backups/qlql/dental_$(date +%Y%m%d_%H%M%S).sql
```

### リストア
```bash
sudo -u postgres psql -d dental_check < /var/backups/qlql/dental_YYYYMMDD_HHMMSS.sql
```

---

## 自動バックアップ

### 設定内容

| 項目 | 値 |
|------|-----|
| 実行時刻 | 毎日 午前3時 |
| 保存場所 | `/var/backups/qlql/` |
| 保持期間 | 30日間（古いものは自動削除） |
| ログ | `/var/log/dental-backup.log` |

### バックアップ確認
```bash
ls -la /var/backups/qlql/
```

### バックアップログ確認
```bash
tail -f /var/log/dental-backup.log
```

### バックアップスクリプト
```
/var/www/qlql/scripts/backup-db.sh
```

### 手動実行
```bash
/var/www/qlql/scripts/backup-db.sh
```

---

## SSL証明書

### 証明書更新（自動更新設定済み）
```bash
certbot renew
```

### 証明書状態確認
```bash
certbot certificates
```

---

## 管理画面

| 項目 | 値 |
|------|-----|
| URL | https://qrqr-dental.com/admin/login |

### 管理画面メニュー

| ページ | URL | 説明 |
|--------|-----|------|
| ダッシュボード | /admin/stats | 統計情報 |
| 医院管理 | /admin/clinics | 医院一覧・プラン変更 |
| 診断管理 | /admin/diagnoses | 診断コンテンツ管理 |

---

## 料金プラン

### プラン一覧

| プラン | 月額（税別） | QRコード上限 | 特徴 |
|--------|-------------|-------------|------|
| スターター | ¥4,980 | 2枚 | 基本機能 |
| スタンダード | ¥8,800 | 無制限 | CSVエクスポート |
| カスタム | ¥13,800 | 無制限 | オリジナル診断作成 |
| マネージド | ¥24,800 | 無制限 | カスタム+専任サポート+月次レポート |
| 特別（無料・無制限） | ¥0 | 無制限 | 管理者設定のみ |

### プラン変更（管理者）

1. 管理画面にログイン: https://qrqr-dental.com/admin/login
2. 「医院管理」メニューを選択
3. 対象医院の「プラン変更」から変更

### トライアル期間

- 期間: 14日間
- トライアル中はスタータープラン相当
- トライアル終了後3日間の猶予期間あり

### 契約期間切れ時の動作

1. **猶予期間中（3日間）**: ログイン可能、QRコード作成不可、トラッキング停止
2. **猶予期間終了後**: ログイン可能、データ閲覧のみ可能

---

## 環境変数

`/var/www/qlql/.env` に設定:

| 変数名 | 説明 |
|--------|------|
| DATABASE_URL | PostgreSQL接続文字列 |
| JWT_SECRET | JWT署名用シークレット |
| NEXT_PUBLIC_APP_URL | アプリのURL |
| PAYJP_SECRET_KEY | Pay.jp シークレットキー |
| PAYJP_WEBHOOK_SECRET | Pay.jp Webhookシークレット |
| NEXT_PUBLIC_PAYJP_PUBLIC_KEY | Pay.jp 公開キー |
| GOOGLE_MAPS_API_KEY | Google Geocoding API キー（任意） |

### Google Geocoding API の設定（推奨）

位置情報の逆ジオコーディングにGoogle Geocoding APIを使用できます。
設定がない場合はNominatim API（無料・レート制限あり）にフォールバックします。

**設定手順:**

1. [Google Cloud Console](https://console.cloud.google.com/) でプロジェクトを作成
2. 「APIとサービス」→「ライブラリ」で「Geocoding API」を有効化
3. 「認証情報」→「認証情報を作成」→「APIキー」を作成
4. APIキーの制限を設定（Geocoding APIのみ許可を推奨）
5. 「お支払い」で請求先アカウントを設定（毎月$200分無料）
6. `.env` に追加:
   ```
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```
7. アプリを再起動: `pm2 restart dental-app`

**料金目安:**
- 毎月$200分無料（約28,500リクエスト相当）
- 超過分: $5.00 / 1,000リクエスト

---

## GitHub Actions

### 設定ファイル
`.github/workflows/deploy.yml`

### 必要なSecrets（GitHub Settings → Secrets）

| Secret名 | 説明 |
|----------|------|
| VPS_HOST | サーバーIP (210.131.223.161) |
| VPS_USER | SSHユーザー (root) |
| VPS_SSH_KEY | SSH秘密鍵の内容 |
| VPS_PORT | SSHポート (22) |

### デプロイ状況確認
GitHubリポジトリ → Actions タブ

---

## トラブルシューティング

### アプリが起動しない
```bash
# PM2ログ確認
pm2 logs dental-app --lines 200

# プロセス状態確認
pm2 status

# 手動で起動テスト
cd /var/www/qlql
npm start
```

### 502 Bad Gateway
```bash
# アプリが起動しているか確認
pm2 status

# Nginx設定確認
nginx -t

# ポート3000が使われているか確認
lsof -i :3000
```

### ディスク容量確認
```bash
df -h
```

### メモリ確認
```bash
free -h
```

### サーバー再起動
```bash
reboot
# → PM2は自動起動設定済み
```

---

## Windows PC 開発環境

### プロジェクトパス
```
C:\Users\hacha\Documents\qlql
```

### 起動方法（コマンドプロンプト）
```cmd
cd C:\Users\hacha\Documents\qlql
npm run dev -- -p 3002
```

### ローカルDB（Docker）

**起動:**
```cmd
docker start dental-local-db
```

**停止:**
```cmd
docker stop dental-local-db
```

| 項目 | 値 |
|------|-----|
| ホスト | localhost |
| ポート | 5433 |
| ユーザー | dental_user |
| パスワード | localpass |
| データベース | dental_check |

### .env ファイル（Windows）
```
DATABASE_URL="postgresql://dental_user:localpass@localhost:5433/dental_check"
JWT_SECRET="qrqr-dental-jwt-secret-key-2025-very-long-random-string-here"
NEXT_PUBLIC_APP_URL="http://localhost:3002"
```

---

## クラウド開発環境（Claude Code）

### プロジェクトパス
```
/home/user/qlql
```

### 起動方法
```bash
npm install
npm run dev -- -p 3001
```

---

## Git ブランチ

- 本番ブランチ: `main`
- リポジトリ: `https://github.com/KotaroTao/qlql`

### 開発→本番 反映手順

```bash
# 1. 開発ブランチで作業
git checkout -b feature/xxx

# 2. コミット＆プッシュ
git add .
git commit -m "修正内容"
git push origin feature/xxx

# 3. PRを作成してmainにマージ
# → マージ後、自動でデプロイされる
```

---

## 位置情報の取得・利用

### 概要

診断利用者の地域分布を把握するため、ブラウザのGPS機能を利用して位置情報を取得しています。

### 取得フロー

```
1. 利用規約チェックボックスをクリック
2. ブラウザのGPS許可ダイアログが表示
3. 許可した場合 → 診断完了時に位置情報を取得
4. 拒否した場合 → 位置情報なしで診断継続（規約同意は有効）
```

### データ保存内容

| 項目 | 保存 | 備考 |
|------|------|------|
| GPS座標（緯度・経度） | ❌ | 保存しない |
| 都道府県 | ✅ | 例: 東京都 |
| 市区町村 | ✅ | 例: 渋谷区 |

### 利用目的

- 診断利用状況の地域分布の把握
- 地域ごとの歯科健康意識の傾向分析
- 歯科医院様のサービス改善支援

### 関連ファイル

| ファイル | 説明 |
|----------|------|
| `/src/components/diagnosis/profile-form.tsx` | 規約同意時のGPS許可リクエスト |
| `/src/components/diagnosis/result-card.tsx` | 診断完了時の位置情報送信 |
| `/src/app/api/track/update-location/route.ts` | 逆ジオコーディング・DB更新 |
| `/src/app/privacy/page.tsx` | プライバシーポリシー |

### 逆ジオコーディング

OpenStreetMap Nominatim API（無料）を使用して、GPS座標から都道府県・市区町村名を取得しています。

**注意**: 1リクエスト/秒の制限があります。

---

## 地図表示機能

### 現在の実装状況

| 項目 | 状態 |
|------|------|
| 表示方式 | 都道府県レベルの境界線表示 |
| データソース | 簡略化バウンディングボックス |
| 表示スタイル | 境界線のみ（塗りつぶしなし） |

### 関連ファイル

| ファイル | 説明 |
|----------|------|
| `/src/components/dashboard/location-map.tsx` | 地図コンポーネント（境界線表示） |
| `/src/components/dashboard/location-section.tsx` | 地図セクションラッパー |
| `/src/data/japan-prefectures.ts` | 都道府県GeoJSONデータ |
| `/src/app/api/dashboard/locations/route.ts` | 位置データ集計API |

### 表示ロジック

- データがある都道府県: 青色の太い境界線（2-4px）
- データがない都道府県: グレーの細い境界線（1px）
- ホバー時: 境界線をハイライト、ツールチップ表示

---

## 【未実装】町丁目レベル境界線表示

### 概要

現在の都道府県レベル表示をより詳細な町丁目レベルに拡張する計画です。

**仕様書**: `/docs/specs/town-level-boundary-display.md`

### 実装に必要な変更

#### 1. データベース変更
```prisma
model DiagnosisSession {
  // 既存
  region    String?   // 都道府県
  city      String?   // 市区町村
  // 追加
  town      String?   // 町丁目（例: "神南一丁目"）
}
```

#### 2. 逆ジオコーディング更新
- Nominatim APIレスポンスから `neighbourhood` フィールドを取得
- `town` カラムに保存

#### 3. GeoJSONデータ準備
- データソース: 国土数値情報（MLIT）町丁目界データ
- ファイルサイズ: 約50-100MB（全国）
- 配置: `/public/geojson/prefectures/{都道府県コード}/{市区町村コード}.json`
- 動的ロード必須（表示エリアに応じて）

#### 4. フロントエンド更新
- 動的GeoJSONローダー実装
- ズームレベル連動表示
- パフォーマンス最適化（キャッシュ、簡略化）

### 実装フェーズ（見積もり）

| フェーズ | 内容 | 期間 |
|---------|------|------|
| Phase 1 | GeoJSONデータ準備・加工 | 1-2週間 |
| Phase 2 | バックエンド（DB・API更新） | 3-5日 |
| Phase 3 | フロントエンド実装 | 1週間 |
| Phase 4 | テスト・リリース | 3-5日 |

### プライバシー考慮

- GPS座標は引き続き保存しない
- 町丁目名のみ保存（統計目的）
- 1件でもデータがあれば町丁目レベルで表示

### 代替案

1. **外部サービス利用**: Mapbox等のベクタータイル（月額費用発生）
2. **段階的実装**: まず市区町村レベル→需要があれば町丁目

---

## 運営会社情報

- 会社名: 株式会社ファンクション・ティ
- URL: https://function-t.com/
- 代表: 田尾耕太郎
- 所在地: 兵庫県西宮市北名次町5-9-301
- メール: mail@function-t.com
