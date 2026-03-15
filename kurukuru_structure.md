# QRくるくる診断DX - システム構造資料

SLPポータル連携検討用の技術仕様書です。

---

## 1. データベース構造

### DB種類

- **PostgreSQL** + **Prisma ORM**（スキーマ定義: `prisma/schema.prisma`）

### 主要テーブル

#### clinics（医院）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID (PK) | 医院ID |
| slug | String (UNIQUE) | URLスラッグ |
| name | String | 医院名 |
| email | String (UNIQUE) | ログインメール |
| password_hash | String | bcryptハッシュ済みパスワード |
| phone | String? | 電話番号 |
| logo_url | String? | ロゴ画像URL |
| main_color | String | ブランドカラー（デフォルト: #2563eb） |
| cta_config | JSON | CTA設定 |
| clinic_page | JSON | 医院ページ設定 |
| status | String | ステータス（trial / active / suspended） |
| failed_login_attempts | Int | ログイン失敗回数 |
| locked_until | DateTime? | アカウントロック解除日時 |
| is_hidden | Boolean | 管理パネル非表示フラグ |
| exclude_from_analysis | Boolean | 分析除外フラグ |
| share_token | String? (UNIQUE) | ダッシュボード共有用トークン |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

#### channels（QRコード）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID (PK) | チャンネルID |
| clinic_id | UUID (FK → clinics) | 医院ID |
| code | String (UNIQUE) | QRコード用短縮コード |
| name | String | 管理用名称（例: "ポスティング用"） |
| display_name | String? | 表示用名称 |
| description | String? | 説明 |
| image_url | String? | 紐付き画像1 |
| image_url_2 | String? | 紐付き画像2 |
| channel_type | String | タイプ（"diagnosis" / "link"） |
| diagnosis_type_slug | String? | 診断タイプスラッグ（diagnosis用） |
| redirect_url | String? | リダイレクト先URL（link用） |
| sort_order | Int | 表示順序 |
| is_active | Boolean | 有効/無効 |
| expires_at | DateTime? | 有効期限（nullは無期限） |
| scan_count | Int | スキャン回数（link用） |
| budget | Int? | 予算（円） |
| distribution_method | String? | 配布方法 |
| distribution_quantity | Int? | 配布枚数 |
| distribution_period | String? | 配布期間 |
| documents | JSON | 資料（[{url, name, size, uploadedAt}]） |
| created_at | DateTime | 作成日時 |
| updated_at | DateTime | 更新日時 |

#### diagnosis_sessions（診断セッション / スキャンログ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID (PK) | セッションID |
| clinic_id | UUID? (FK → clinics) | 医院ID |
| channel_id | UUID? (FK → channels) | QRコードID |
| diagnosis_type_id | UUID? (FK → diagnosis_types) | 診断タイプID |
| session_type | String | タイプ（"diagnosis" / "link"） |
| is_demo | Boolean | デモフラグ |
| is_deleted | Boolean | 論理削除フラグ |
| user_age | Int? | ユーザー年齢 |
| user_gender | String? | ユーザー性別（male / female / other） |
| answers | JSON? | 回答データ |
| total_score | Int? | 合計スコア |
| result_category | String? | 結果カテゴリ |
| completed_at | DateTime? | 完了日時 |
| created_at | DateTime | 作成日時 |
| ip_address | String? | IPアドレス |
| country | String? | 国コード |
| region | String? | 都道府県 |
| city | String? | 市区町村 |
| town | String? | 町丁目 |
| latitude | Float? | 緯度（小数点2桁、約1km精度） |
| longitude | Float? | 経度（小数点2桁、約1km精度） |

**インデックス:**
- `(clinic_id, created_at)` — 期間検索
- `(clinic_id, completed_at, is_demo, created_at)` — ダッシュボード集計
- `(clinic_id, session_type)` — セッションタイプ別
- `(clinic_id, is_deleted)` — 削除済みフィルタリング
- `(channel_id)` — チャンネル別検索

#### access_logs（アクセスログ）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID (PK) | ログID |
| clinic_id | UUID? (FK) | 医院ID |
| channel_id | UUID? (FK) | QRコードID |
| diagnosis_type_slug | String? | 診断タイプスラッグ |
| event_type | String | イベント種別 |
| user_agent | String? | ブラウザ情報 |
| referer | String? | リファラー |
| is_deleted | Boolean | 論理削除フラグ |
| ip_address | String? | IPアドレス |
| country / region / city | String? | 位置情報 |
| created_at | DateTime | 作成日時 |

#### cta_clicks（CTAクリック）

| カラム | 型 | 説明 |
|--------|-----|------|
| id | UUID (PK) | クリックID |
| session_id | UUID? (FK) | 診断セッションID |
| clinic_id | UUID? (FK) | 医院ID |
| channel_id | UUID? (FK) | QRコードID |
| cta_type | String | CTAタイプ |
| created_at | DateTime | クリック日時 |

#### その他のテーブル

| テーブル | 概要 |
|----------|------|
| subscriptions | Pay.jp決済・サブスク管理（trial/active/canceled/past_due/expired） |
| diagnosis_types | 診断テンプレート（questions/resultPatterns をJSON保持） |
| clinic_diagnoses | 医院×診断タイプの有効/無効設定 |
| invitation_tokens | 招待・パスワードリセット用トークン |
| admins | 管理者ユーザー |
| audit_logs | 管理者操作の監査ログ |

---

## 2. 認証方式とセッション管理

### 医院ユーザー認証

| 項目 | 内容 |
|------|------|
| 方式 | JWT (JSON Web Token) |
| ライブラリ | jose（HS256署名） |
| トークン有効期限 | 7日間 |
| 格納場所 | Cookie（`auth_token`） |
| Cookie属性 | httpOnly, secure(本番), sameSite=lax |
| パスワード | bcryptjs（ストレッチング12回）でハッシュ化 |

### JWTペイロード

```json
{
  "clinicId": "uuid-string",
  "email": "clinic@example.com",
  "iat": 1234567890,
  "exp": 1235172690
}
```

### セッション取得の流れ

```
リクエスト
  → Cookie から auth_token を取得
  → jose.jwtVerify() で検証
  → { clinicId, email } を返す（失敗時は null）
```

### ミドルウェアによる保護

```typescript
// src/middleware.ts
// 保護対象: /dashboard 配下すべて
// → 未認証なら /login?redirect=元のパス にリダイレクト
// → /login, /signup にログイン済みでアクセスすると /dashboard にリダイレクト
```

### セキュリティ機能

- **レート制限**: 1IPあたり15分間に30回まで（ログインAPI）
- **アカウントロック**: ログイン10回失敗で5分間ロック
- **管理者認証**: 別Cookie（`admin_auth_token`、24時間有効）

### 認証コード（src/lib/auth.ts）

```typescript
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { JWT_SECRET } from "./jwt-secret";

const COOKIE_NAME = "auth_token";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export async function createToken(payload: {
  clinicId: string;
  email: string;
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{
  clinicId: string;
  email: string;
} | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { clinicId: string; email: string };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<{
  clinicId: string;
  email: string;
} | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function getTokenFromCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(";").reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split("=");
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  return cookies[COOKIE_NAME] || null;
}
```

---

## 3. APIルートハンドラーのサンプル

### サンプル1: ログインAPI（`src/app/api/auth/login/route.ts`）

```typescript
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createToken } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import type { Clinic } from "@/types/clinic";

const MAX_FAILED_ATTEMPTS = 10;
const LOCK_DURATION_MS = 5 * 60 * 1000;

export async function POST(request: NextRequest) {
  const rateLimitResponse = checkRateLimit(request, "auth-login", 30, 15 * 60 * 1000);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードを入力してください" },
        { status: 400 }
      );
    }

    const clinic = (await prisma.clinic.findUnique({
      where: { email },
      include: { subscription: true },
    })) as (Clinic & { failedLoginAttempts: number; lockedUntil: Date | null }) | null;

    if (!clinic) {
      return NextResponse.json(
        { error: "メールアドレスまたはパスワードが正しくありません" },
        { status: 401 }
      );
    }

    // アカウントロック中かチェック
    if (clinic.lockedUntil && new Date() < clinic.lockedUntil) {
      const remainingMs = clinic.lockedUntil.getTime() - Date.now();
      const remainingMin = Math.ceil(remainingMs / 60000);
      return NextResponse.json(
        { error: `セキュリティのためアカウントが一時的にロックされています。${remainingMin}分後に再度お試しください` },
        { status: 423 }
      );
    }

    const isValid = await verifyPassword(password, clinic.passwordHash);

    if (!isValid) {
      const newAttempts = clinic.failedLoginAttempts + 1;
      const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS;

      await prisma.clinic.update({
        where: { id: clinic.id },
        data: {
          failedLoginAttempts: newAttempts,
          ...(shouldLock ? { lockedUntil: new Date(Date.now() + LOCK_DURATION_MS) } : {}),
        },
      });

      if (shouldLock) {
        const lockMin = Math.ceil(LOCK_DURATION_MS / 60000);
        return NextResponse.json(
          { error: `ログイン試行回数の上限に達しました。セキュリティのため${lockMin}分間ロックされます` },
          { status: 423 }
        );
      }

      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      return NextResponse.json(
        { error: `メールアドレスまたはパスワードが正しくありません（あと${remaining}回試行できます）` },
        { status: 401 }
      );
    }

    // ログイン成功 → 失敗カウンターリセット
    if (clinic.failedLoginAttempts > 0 || clinic.lockedUntil) {
      await prisma.clinic.update({
        where: { id: clinic.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
    }

    if (clinic.status === "suspended") {
      return NextResponse.json({ error: "このアカウントは停止されています" }, { status: 403 });
    }

    const token = await createToken({ clinicId: clinic.id, email: clinic.email });

    const response = NextResponse.json({
      message: "ログインしました",
      clinic: {
        id: clinic.id,
        name: clinic.name,
        email: clinic.email,
        slug: clinic.slug,
        status: clinic.status,
        subscription: clinic.subscription
          ? { status: clinic.subscription.status, trialEnd: clinic.subscription.trialEnd }
          : null,
      },
    }, { status: 200 });

    response.cookies.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "ログインに失敗しました。しばらく経ってから再度お試しください" },
      { status: 500 }
    );
  }
}
```

### サンプル2: QRコード別統計API（`src/app/api/dashboard/channel-stats/route.ts`）

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "all";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    // 期間フィルター計算
    let dateFrom: Date | null = null;
    let dateTo: Date | null = null;

    if (period === "all") {
      // フィルターなし
    } else if (period === "custom" && startDate && endDate) {
      dateFrom = new Date(startDate);
      dateTo = new Date();
      dateTo.setTime(new Date(endDate).getTime());
      dateTo.setHours(23, 59, 59, 999);
    } else {
      dateTo = new Date();
      switch (period) {
        case "today":
          dateFrom = new Date(); dateFrom.setHours(0, 0, 0, 0); break;
        case "week":
          dateFrom = new Date(); dateFrom.setDate(dateFrom.getDate() - 7); dateFrom.setHours(0, 0, 0, 0); break;
        case "month": default:
          dateFrom = new Date(); dateFrom.setMonth(dateFrom.getMonth() - 1); dateFrom.setHours(0, 0, 0, 0); break;
      }
    }

    const channels = await prisma.channel.findMany({
      where: { clinicId: session.clinicId, isActive: true },
      select: { id: true },
    });
    const channelIds = channels.map((c: { id: string }) => c.id);

    if (channelIds.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    const dateFilter = dateFrom && dateTo ? { createdAt: { gte: dateFrom, lte: dateTo } } : {};

    // 並列で統計データ取得
    const [accessCounts, completedCounts, ctaCounts, ctaByChannel, genderByChannel, ageByChannel, accessLogs] =
      await Promise.all([
        // アクセス数（チャンネル別）
        prisma.diagnosisSession.groupBy({
          by: ["channelId"],
          where: { clinicId: session.clinicId, channelId: { in: channelIds }, isDeleted: false, isDemo: false, completedAt: { not: null }, ...dateFilter },
          _count: { id: true },
        }),
        // 診断完了数
        prisma.diagnosisSession.groupBy({
          by: ["channelId"],
          where: { clinicId: session.clinicId, channelId: { in: channelIds }, ...dateFilter, isDemo: false, isDeleted: false, completedAt: { not: null } },
          _count: { id: true },
        }),
        // CTAクリック数
        prisma.cTAClick.groupBy({
          by: ["channelId"],
          where: { clinicId: session.clinicId, channelId: { in: channelIds }, ...dateFilter, OR: [{ sessionId: null }, { session: { isDeleted: false } }] },
          _count: { id: true },
        }),
        // CTA内訳
        prisma.cTAClick.groupBy({
          by: ["channelId", "ctaType"],
          where: { clinicId: session.clinicId, channelId: { in: channelIds }, ...dateFilter, OR: [{ sessionId: null }, { session: { isDeleted: false } }] },
          _count: { id: true },
        }),
        // 性別統計
        prisma.diagnosisSession.groupBy({
          by: ["channelId", "userGender"],
          where: { clinicId: session.clinicId, channelId: { in: channelIds }, ...dateFilter, isDemo: false, isDeleted: false, completedAt: { not: null } },
          _count: { id: true },
        }),
        // 年齢データ
        prisma.diagnosisSession.findMany({
          where: { clinicId: session.clinicId, channelId: { in: channelIds }, ...dateFilter, isDemo: false, isDeleted: false, completedAt: { not: null } },
          select: { channelId: true, userAge: true },
        }),
        // アクセスログ（日付別集計）
        prisma.accessLog.findMany({
          where: { clinicId: session.clinicId, channelId: { in: channelIds }, ...dateFilter, eventType: { not: "clinic_page_view" }, isDeleted: false },
          select: { channelId: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    // レスポンス構造（チャンネルIDをキーにした統計オブジェクト）
    // {
    //   "channel-uuid": {
    //     accessCount: 100,
    //     completedCount: 80,
    //     completionRate: 80.0,
    //     ctaCount: 25,
    //     ctaRate: 31.3,
    //     ctaByType: { "phone": 10, "reservation": 15 },
    //     genderByType: { "male": 30, "female": 45, "other": 5 },
    //     ageRanges: { "~19": 5, "20-29": 15, "30-39": 20, "40-49": 25, "50-59": 10, "60~": 5 },
    //     accessByDate: [{ date: "2026-03-15", count: 12 }, ...]
    //   }
    // }

    return NextResponse.json({ stats });
  } catch (error) {
    console.error("Channel stats error:", error);
    return NextResponse.json({ error: "チャンネル統計の取得に失敗しました" }, { status: 500 });
  }
}
```

---

## 4. next.config.mjs の現状

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // standaloneモード（コンテナデプロイ用）
  output: 'standalone',

  // 画像最適化 - 許可ドメイン
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'qrqr-dental.com' },
      { protocol: 'https', hostname: '*.qrqr-dental.com' },
    ],
  },

  // Server Actions のボディサイズ上限（画像アップロード用）
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },

  // セキュリティヘッダー
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), usb=(), geolocation=(self)' },
      ],
    }];
  },
};

export default nextConfig;
```

---

## 5. package.json

```json
{
  "name": "qlql",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "prisma generate && prisma db push --accept-data-loss && next build",
    "start": "next start",
    "lint": "next lint",
    "db:seed": "tsx prisma/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "prisma": {
    "seed": "tsx prisma/seed.ts"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.2.2",
    "@prisma/client": "^5.22.0",
    "@radix-ui/react-checkbox": "^1.3.3",
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-progress": "^1.1.8",
    "@radix-ui/react-radio-group": "^1.3.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@types/leaflet": "^1.9.21",
    "bcryptjs": "^3.0.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "framer-motion": "^12.23.26",
    "jose": "^6.1.3",
    "jsonwebtoken": "^9.0.3",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.562.0",
    "next": "14.2.35",
    "nodemailer": "^8.0.1",
    "payjp": "^3.0.0",
    "prisma": "^5.22.0",
    "qrcode": "^1.5.4",
    "qrcode.react": "^4.2.0",
    "react": "^18",
    "react-dom": "^18",
    "react-hook-form": "^7.69.0",
    "react-leaflet": "^4.2.1",
    "recharts": "^3.6.0",
    "sharp": "^0.34.5",
    "tailwind-merge": "^3.4.0",
    "zod": "^4.2.1",
    "zustand": "^5.0.9"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.10",
    "@types/node": "^20",
    "@types/nodemailer": "^7.0.9",
    "@types/qrcode": "^1.5.6",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "@vitejs/plugin-react": "^5.1.3",
    "eslint": "^8",
    "eslint-config-next": "14.2.35",
    "postcss": "^8",
    "tailwindcss": "^3.4.1",
    "tsx": "^4.21.0",
    "typescript": "^5",
    "vitest": "^4.0.18"
  }
}
```

---

## 6. src/app/ ディレクトリ構造

```
src/app/
├── layout.tsx                    # ルートレイアウト
├── page.tsx                      # トップページ
├── globals.css                   # グローバルCSS
├── favicon.ico
├── fonts/
│
├── admin/                        # 管理者パネル
│   ├── login/                    #   管理者ログイン
│   ├── clinics/                  #   医院一覧・詳細
│   │   └── [id]/                 #     個別医院
│   ├── diagnoses/                #   診断タイプ管理
│   │   ├── new/                  #     新規作成
│   │   └── [id]/                 #     編集
│   └── flyer-analysis/           #   チラシ分析
│
├── api/                          # APIルート
│   ├── auth/                     #   認証
│   │   ├── login/                #     ログイン
│   │   ├── signup/               #     サインアップ
│   │   ├── logout/               #     ログアウト
│   │   ├── me/                   #     現在のユーザー情報
│   │   └── forgot-password/      #     パスワードリセット
│   ├── admin/                    #   管理者API
│   │   ├── auth/                 #     管理者認証（login/logout/me）
│   │   ├── clinics/              #     医院CRUD
│   │   │   └── [id]/             #       個別（channels/diagnosis-types/impersonate/invite/settings/stats）
│   │   ├── diagnoses/            #     診断タイプCRUD
│   │   │   └── [id]/
│   │   ├── audit-logs/           #     監査ログ
│   │   └── flyer-analysis/       #     チラシ分析
│   ├── channels/                 #   QRコード管理
│   │   ├── [id]/                 #     個別（permanent-delete）
│   │   └── reorder/              #     並び替え
│   ├── dashboard/                #   ダッシュボードデータ
│   │   ├── stats/                #     統計サマリー
│   │   ├── channel-stats/        #     QRコード別統計
│   │   ├── diagnoses/            #     診断データ
│   │   │   └── [id]/
│   │   ├── history/              #     履歴
│   │   │   └── [id]/
│   │   ├── locations/            #     位置情報
│   │   ├── location-demographics/#     地域別属性
│   │   └── share/                #     共有設定
│   ├── track/                    #   トラッキング
│   │   ├── access/               #     アクセスログ
│   │   ├── complete/             #     診断完了
│   │   ├── cta/                  #     CTAクリック
│   │   ├── link-complete/        #     リンク完了
│   │   └── update-location/      #     位置情報更新
│   ├── billing/                  #   決済（Pay.jp）
│   │   ├── subscribe/            #     サブスク開始
│   │   ├── cancel/               #     キャンセル
│   │   ├── card/                 #     カード管理
│   │   └── subscription/         #     サブスク情報
│   ├── clinic/                   #   医院設定
│   │   ├── settings/             #     設定
│   │   └── page/                 #     医院ページ
│   ├── diagnoses/                #   診断タイプ取得
│   │   └── [slug]/
│   ├── embed/                    #   埋め込み用
│   ├── health/                   #   ヘルスチェック
│   ├── invite/                   #   招待
│   │   └── [token]/
│   ├── shared/                   #   共有ダッシュボード
│   │   └── [token]/
│   ├── stats/                    #   統計
│   ├── upload/                   #   ファイルアップロード
│   └── webhook/
│       └── payjp/                #   Pay.jpウェブフック
│
├── c/                            # QRコード経由の公開ページ
│   └── [code]/                   #   QRコード別
│       ├── [type]/               #     診断タイプ別
│       ├── expired/              #     期限切れ
│       ├── link/                 #     リンクタイプ
│       └── profile/              #     プロフィール入力
│
├── dashboard/                    # 医院向けダッシュボード（要認証）
│   ├── channels/                 #   QRコード管理
│   │   ├── new/                  #     新規作成
│   │   └── [id]/                 #     詳細
│   │       └── edit/             #       編集
│   ├── diagnoses/                #   診断管理
│   │   ├── new/                  #     新規作成
│   │   └── [id]/                 #     詳細
│   │       └── edit/             #       編集
│   ├── billing/                  #   決済管理
│   ├── embed/                    #   埋め込み設定
│   └── settings/                 #   医院設定
│
├── demo/                         # デモページ
│   └── [type]/
├── embed/                        # 埋め込み用ページ
│   └── [slug]/
│       └── [type]/
├── preview/                      # プレビュー
│   └── result/
├── shared/                       # 共有ダッシュボード
│   └── [token]/
│
├── login/                        # ログインページ
├── signup/                       # サインアップページ
├── forgot-password/              # パスワードリセット
├── invite/                       # 招待ページ
│   └── [token]/
├── pricing/                      # 料金ページ
├── legal/                        # 法的情報
├── terms/                        # 利用規約
└── privacy/                      # プライバシーポリシー
```

---

## 7. SLPポータル連携に関する補足

### 連携で使えそうな既存機能

1. **共有ダッシュボード機能**: `Clinic.shareToken` フィールドと `/api/shared/[token]` APIが既に存在。トークンベースの閲覧専用アクセスの仕組みがある
2. **QRコード別統計API**: `/api/dashboard/channel-stats` がチャンネル別の詳細統計を返す
3. **位置情報データ**: `/api/dashboard/locations` と `/api/dashboard/location-demographics` で地域別データを取得可能

### ワンタイムパスワード連携の実装案

くるくる側に必要な新規実装:
- ワンタイムパスワード発行API（医院IDに紐付け、10分有効）
- ワンタイムパスワード検証API → 成功時に閲覧専用トークンを返す
- 閲覧専用APIエンドポイント（既存の `channel-stats` をベースに、編集操作を除外）
