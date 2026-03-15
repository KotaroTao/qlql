# Dental Check - 歯科医院向けQR診断システム

歯科医院向けのQRコードベース診断システム。患者がQRコードをスキャンすると診断を受けられ、医院はダッシュボードで効果測定ができる。

## 技術スタック

- **フレームワーク**: Next.js 14 (App Router)
- **言語**: TypeScript
- **DB**: PostgreSQL + Prisma ORM
- **認証**: JWT (jose)
- **決済**: PAY.JP
- **スタイリング**: Tailwind CSS
- **デプロイ**: GitHub Actions + SSH

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env
# DATABASE_URL, JWT_SECRET 等を設定

# DBマイグレーション
npx prisma migrate dev

# 診断タイプのシード（重要！）
npx tsx scripts/seed-diagnoses.ts

# 開発サーバー起動
npm run dev
```

## プロジェクト構成

```
src/
├── app/
│   ├── api/
│   │   ├── admin/
│   │   │   ├── auth/               # 管理者認証 (login/logout/me)
│   │   │   ├── clinics/            # 医院CRUD + 招待 + なりすまし
│   │   │   ├── diagnoses/          # 診断タイプ管理
│   │   │   └── stats/              # 全体統計
│   │   ├── auth/                   # 医院認証 (login/logout/me/signup/forgot-password)
│   │   ├── billing/                # 決済・サブスクリプション
│   │   ├── dashboard/              # ダッシュボード用API
│   │   │   ├── stats/              # 効果測定サマリー
│   │   │   ├── channel-stats/      # チャンネル別統計
│   │   │   ├── history/            # 読み込み履歴
│   │   │   ├── locations/          # エリア分析
│   │   │   └── diagnoses/          # 診断管理
│   │   ├── invite/[token]/         # 招待トークン検証・パスワード設定
│   │   └── track/                  # トラッキングAPI
│   ├── admin/                      # 管理者パネル
│   │   ├── clinics/                # 医院管理（一覧・詳細・作成・招待）
│   │   ├── diagnoses/              # 診断タイプ管理
│   │   └── stats/                  # 統計
│   ├── dashboard/                  # 医院ダッシュボード
│   │   ├── channels/               # QRコード管理 (new/[id]/[id]/edit)
│   │   ├── diagnoses/              # 診断管理 (new/[id]/edit)
│   │   ├── billing/                # 契約・お支払い
│   │   ├── settings/               # 医院設定
│   │   └── embed/                  # 埋め込みコード
│   ├── invite/[token]/             # 招待・パスワードリセットページ
│   ├── forgot-password/            # パスワードリセット申請
│   ├── c/[code]/                   # QRコードリダイレクト
│   └── embed/[slug]/[type]/        # iframe埋め込み用
├── components/
│   ├── dashboard/                  # ダッシュボードコンポーネント
│   │   ├── effectiveness-summary.tsx
│   │   ├── qr-code-row.tsx
│   │   ├── location-section.tsx
│   │   ├── history-cta-popover.tsx
│   │   ├── skeleton.tsx
│   │   ├── cta-alert.tsx
│   │   └── types.ts
│   ├── ui/                         # 汎用UIコンポーネント
│   └── logo.tsx
└── lib/
    ├── auth.ts                     # 医院認証 (JWT, Cookie: auth_token)
    ├── admin-auth.ts               # 管理者認証 (JWT, Cookie: admin_auth_token)
    ├── prisma.ts                   # Prismaクライアント
    ├── subscription.ts             # サブスクリプション状態算出
    ├── plans.ts                    # プラン定義・制限
    └── payjp.ts                    # PAY.JPクライアント
```

## データベース設計

### 主要テーブル

| テーブル | 説明 |
|---------|------|
| `Clinic` | 医院情報 |
| `Channel` | QRコード（経路別計測用） |
| `DiagnosisType` | 診断タイプ定義（質問・結果パターン） |
| `DiagnosisSession` | 診断セッション（回答・結果） |
| `AccessLog` | QRアクセスログ |
| `CTAClick` | CTAクリックログ |

### チャンネルタイプ

- **`diagnosis`**: 診断型 - QRスキャン → 診断 → 結果 → CTA
- **`link`**: リンク型 - QRスキャン → 直接リダイレクト（CTAは`direct_link`として記録）

## 認証・権限システム

### 二重認証アーキテクチャ

医院用と管理者用で独立した認証を持つ:

| 項目 | 医院（Clinic） | 管理者（Admin） |
|------|---------------|----------------|
| Cookie名 | `auth_token` | `admin_auth_token` |
| 認証lib | `src/lib/auth.ts` | `src/lib/admin-auth.ts` |
| セッション取得 | `getSession()` | `getAdminSession()` |
| トークン有効期限 | 7日 | 24時間 |
| ログインAPI | `/api/auth/login` | `/api/admin/auth/login` |
| セッションAPI | `/api/auth/me` | `/api/admin/auth/me` |

### 管理者なりすまし（Impersonation）

管理者が任意の医院のダッシュボードに全権限でログインできる機能。

**仕組み:**
1. `/api/admin/clinics/[id]/impersonate` が医院用の `auth_token` を発行
2. ブラウザに `admin_auth_token`（既存）と `auth_token`（新規発行）が共存
3. `/api/auth/me` が `admin_auth_token` の存在を検知し `isImpersonating: true` を返却
4. `/api/billing/subscription` がなりすまし時にすべてのプラン制限を解除（`canCreateQR: true`, `isDemo: false` 等）
5. ダッシュボードのレイアウトにオレンジの「管理者モード」バナーを表示

**関連ファイル:**
- `src/app/api/admin/clinics/[id]/impersonate/route.ts` - なりすましAPI
- `src/app/api/auth/me/route.ts` - `isImpersonating` フラグ返却
- `src/app/api/billing/subscription/route.ts` - 権限オーバーライド
- `src/app/dashboard/layout.tsx` - 管理者モードバナー

**「管理画面に戻る」の動作:** `/api/auth/logout`（`auth_token`のみ削除）→ `/admin/clinics` にリダイレクト。`admin_auth_token`は残るため管理画面に戻れる。

### 招待・パスワード設定システム

管理者が医院アカウントを作成し、招待URLでパスワード設定を依頼するフロー。

**フロー:**
1. 管理者が `/admin/clinics` で医院を新規作成 → `status: "pending"`, ダミーパスワード
2. `InvitationToken` が発行され、招待URLが生成
3. クライアントが `/invite/[token]` でパスワードを設定 → `status: "active"` に更新、自動ログイン
4. パスワードリセットも同じトークン機構を共用（`type: "password_reset"`, 有効期限1時間）

**関連ファイル:**
- `prisma/schema.prisma` - `InvitationToken` モデル
- `src/app/api/admin/clinics/route.ts` - POST: 医院作成+トークン発行
- `src/app/api/admin/clinics/[id]/invite/route.ts` - 招待再送
- `src/app/api/invite/[token]/route.ts` - トークン検証+パスワード設定
- `src/app/api/auth/forgot-password/route.ts` - パスワードリセットトークン発行
- `src/app/invite/[token]/page.tsx` - 招待/リセット共用UI

### サブスクリプション・プランシステム

**プラン種別:**

| planType | 説明 | QR作成 | QR編集 | isDemo |
|----------|------|--------|--------|--------|
| `demo` | デモ（閲覧のみ） | × | × | ○ |
| `free` | 無料（全機能） | ○ | ○ | × |
| `starter` | スターター | ○（上限あり） | ○ | × |
| `professional` | プロフェッショナル | ○（上限あり） | ○ | × |

**権限チェックの流れ:**
1. `src/lib/subscription.ts` の `getSubscriptionState()` がDB状態から権限を算出
2. `/api/billing/subscription` がフロントに返却（なりすまし時はオーバーライド）
3. フロントの各コンポーネントが `subscription.canCreateQR` 等で制御

**SubscriptionState の主要フィールド:**
- `canCreateQR`, `canEditQR`, `canTrack`, `canCreateCustomDiagnosis`, `canEditDiagnosis`
- `isDemo` - デモアカウントフラグ
- `qrCodeLimit`, `qrCodeCount`, `remainingQRCodes` - QRコード枠管理
- `trialDaysLeft`, `gracePeriodDaysLeft` - トライアル/猶予期間

## 重要な実装詳細

### 1. 診断タイプのシード（超重要）

**新しい診断タイプを追加する場合、必ずDBにレコードが必要。**

`track/complete` APIは `DiagnosisType` テーブルを参照し、存在しない場合はセッション作成に失敗する。

```typescript
// /src/app/api/track/complete/route.ts
const diagnosisTypeRecord = await prisma.diagnosisType.findUnique({
  where: { slug: diagnosisType },
});
if (!diagnosisTypeRecord) {
  return NextResponse.json({ error: "DiagnosisType not found" }, { status: 404 });
}
```

**現在登録済みの診断タイプ:**
- `oral-age` - お口年齢診断
- `child-orthodontics` - 子供の矯正タイミングチェック
- `periodontal-risk` - 歯周病リスク診断
- `cavity-risk` - 虫歯リスク診断
- `whitening-check` - ホワイトニング適正診断

新規追加時は `/scripts/seed-diagnoses.ts` を更新して実行:
```bash
npx tsx scripts/seed-diagnoses.ts
```

### 2. 論理削除と統計フィルタリング

**AccessLog**: `isDeleted` カラムあり
**CTAClick**: `isDeleted` カラムなし（session経由でフィルタ）

```typescript
// AccessLogのフィルタリング
where: { isDeleted: false }

// CTAClickのフィルタリング（sessionを経由）
where: {
  OR: [
    { sessionId: null },
    { session: { isDeleted: false } },
  ],
}
```

### 3. CTA タイプ一覧

| ctaType | 表示名 |
|---------|--------|
| `line` | LINE |
| `phone` | 電話 |
| `reservation` | 予約 |
| `clinic_homepage` | ホームページ |
| `direct_link` | 直リンク |

### 4. 診断タイプ名のマッピング

複数ファイルで定義されているため、変更時は全て更新が必要:

- `/src/app/dashboard/page.tsx`
- `/src/app/dashboard/channels/[id]/page.tsx`
- `/src/app/dashboard/channels/[id]/edit/page.tsx`
- `/src/app/api/dashboard/history/route.ts`

```typescript
const DIAGNOSIS_TYPE_NAMES: Record<string, string> = {
  "oral-age": "お口年齢診断",
  "child-orthodontics": "子供の矯正タイミングチェック",
  "periodontal-risk": "歯周病リスク診断",
  "cavity-risk": "虫歯リスク診断",
  "whitening-check": "ホワイトニング適正診断",
};
```

## デプロイ

### GitHub Actions（自動）

`main` ブランチへのpushで自動デプロイ。

必要なSecrets:
- `DEPLOY_HOST`: サーバーIP
- `DEPLOY_USER`: SSHユーザー名
- `DEPLOY_SSH_KEY`: SSH秘密鍵

### 手動デプロイ

```bash
ssh user@server
cd /var/www/mieru-clinic
git fetch origin <branch>
git merge origin/<branch>
npm run build
pm2 restart dental-app
```

**注意:**
- PM2プロセス名は `dental-app`（`mieru-clinic` ではない）
- `main` ブランチへの直接pushは403でブロックされる。PRまたはサーバー上でmerge
- マイグレーションがある場合: `npx prisma db execute --file prisma/migrations/<dir>/migration.sql`
  - `psql $DATABASE_URL` はroot環境では使えない（環境変数未設定）。Prisma経由で実行する

### シード実行（本番）

```bash
cd /var/www/mieru-clinic
npx tsx scripts/seed-diagnoses.ts
```

## トラブルシューティング

### 症状: 新しい診断タイプの履歴・統計が表示されない

**原因**: `DiagnosisType` テーブルにレコードがない

**解決策**:
1. シードスクリプトに診断タイプを追加
2. 本番でシード実行: `npx tsx scripts/seed-diagnoses.ts`

### 症状: ts-node でエラー "Unknown file extension .ts"

**解決策**: `tsx` を使用
```bash
# NG
npx ts-node scripts/seed-diagnoses.ts

# OK
npx tsx scripts/seed-diagnoses.ts
```

### 症状: 効果測定サマリーが一部表示されない

**確認ポイント**:
1. 該当チャンネルに紐づくセッションが存在するか
2. セッションが `isDeleted: false` か
3. 診断タイプがDBに登録されているか

## 開発時の注意点

1. **診断タイプ追加時**: 必ずシードスクリプトを更新してDBに登録
2. **CTAClick統計**: `isDeleted`カラムがないため、session経由でフィルタ
3. **複数ファイルの同期**: `DIAGNOSIS_TYPE_NAMES`, `CTA_TYPE_NAMES` は複数箇所で定義
4. **linkタイプのCTA**: `direct_link` として `CTAClick` に記録される
5. **なりすまし時の権限**: `admin_auth_token` Cookie存在チェックで判定。新しいAPIで権限チェックする場合は `getAdminSession()` を使ってオーバーライドを検討
6. **ビルド時の動的ルートエラー**: APIルートで `cookies()` を使うと静的生成時にエラーが出るが、実行時には問題ない（既知の警告）
7. **設定変更のヘッダー反映**: 設定保存時に `window.dispatchEvent(new CustomEvent("clinic-settings-updated"))` を発火し、レイアウトが受信して再取得する
