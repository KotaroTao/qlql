# QRコード機能改善 仕様書

## 概要

「経路」という用語を「QRコード」に統一し、QRコードに画像を紐付けられるようにする改善。

---

## 変更内容

### 1. 用語の統一

| 現状 | 変更後 |
|------|--------|
| 経路 | QRコード |
| 新しい経路を作成 | 新しいQRコードを作成 |
| 経路名 | QRコード名 |
| 経路の作成に失敗 | QRコードの作成に失敗 |

**対象ファイル:**
- `src/app/dashboard/page.tsx`
- `src/app/dashboard/channels/new/page.tsx`
- `src/app/dashboard/channels/[id]/page.tsx`
- `src/app/dashboard/channels/[id]/edit/page.tsx`
- `src/app/api/channels/route.ts`
- `src/app/api/channels/[id]/route.ts`
- `src/app/api/dashboard/stats/route.ts`
- `prisma/schema.prisma` (コメントのみ)

---

### 2. ナビゲーションの変更

**Before:**
```
ダッシュボード | 埋め込みコード | 医院紹介 | 設定 | 契約・お支払い
```

**After:**
```
ダッシュボード | QRコード作成 | 医院紹介 | 設定 | 契約・お支払い
```

**変更ファイル:** `src/app/dashboard/layout.tsx`

**補足:**
- 「埋め込みコード」ページ（`/dashboard/embed`）は残すが、ナビゲーションからは削除
- 「QRコード作成」は `/dashboard/channels/new` にリンク

---

### 3. 画像アップロード機能

#### 3.1 データベース変更

```prisma
model Channel {
  // 既存フィールド...
  imageUrl String? @map("image_url") // 追加: QRコードに紐付く画像
}
```

#### 3.2 QRコード作成画面

**追加UI:**
- ドラッグ＆ドロップエリア
- ファイル選択ボタン
- プレビュー表示
- 削除ボタン

**画像仕様:**
| 項目 | 値 |
|------|-----|
| 枚数 | 1枚のみ |
| 最大サイズ | 5MB |
| 形式 | JPEG, PNG, WebP |
| リサイズ | 800px（長辺） |
| 圧縮 | JPEG 80% |

#### 3.3 ダッシュボード表示

**QRコード一覧:**
```
┌─────────────────────────────────────────────┐
│ [サムネイル] QRコード名         診断タイプ  │
│  40x40px     チラシ①（駅前配布） お口年齢   │
│              アクセス: 123 完了: 45        │
└─────────────────────────────────────────────┘
```

**サムネイルクリック時:**
- モーダルで元画像を表示
- 閉じるボタン / 背景クリックで閉じる

---

## 改善提案

### 提案1: QRコード自動生成
**内容:** QRコード画像を自動生成して表示
**効果:** 手動でQRコード作成する手間が省ける
**実装:** `qrcode` ライブラリを使用

### 提案2: QRコードダウンロード機能
**内容:** 生成したQRコードをPNG/SVGでダウンロード
**効果:** チラシやポスターに貼り付け可能

### 提案3: 画像に説明文を追加
**内容:** 画像と一緒にメモ（どこで撮影したか等）を保存
**効果:** 後から見返したときに分かりやすい

### 提案4: 複数画像対応
**内容:** 1つのQRコードに複数の画像を紐付け
**効果:** 配布場所の写真を複数保存可能
**注意:** 今回は1枚のみの要件なので将来対応

### 提案5: 画像のドラッグ並べ替え（将来）
**内容:** 複数画像対応時に順序変更可能に

---

## ファイル変更一覧

| ファイル | 変更内容 |
|---------|---------|
| `prisma/schema.prisma` | Channel に imageUrl 追加 |
| `src/app/dashboard/layout.tsx` | ナビ変更 |
| `src/app/dashboard/page.tsx` | 用語変更、サムネイル表示 |
| `src/app/dashboard/channels/new/page.tsx` | 用語変更、画像アップロード追加 |
| `src/app/dashboard/channels/[id]/page.tsx` | 用語変更、画像表示 |
| `src/app/dashboard/channels/[id]/edit/page.tsx` | 用語変更、画像編集 |
| `src/app/api/channels/route.ts` | 画像URL保存対応 |
| `src/app/api/channels/[id]/route.ts` | 画像URL更新対応 |

---

## マイグレーション

```bash
# 本番環境でのマイグレーション
docker run --rm --network qlql_dental-network \
  -e DATABASE_URL='postgresql://dental_user:PASSWORD@db:5432/dental_check' \
  -v $(pwd)/prisma:/app/prisma -w /app node:20 \
  sh -c "npm install prisma@5.22.0 && npx prisma db push"
```

---

## 確認項目

- [ ] 「経路」が「QRコード」に置き換わっている
- [ ] ナビゲーションに「QRコード作成」が表示される
- [ ] QRコード作成時に画像をアップロードできる
- [ ] ダッシュボードにサムネイルが表示される
- [ ] サムネイルクリックで元画像が表示される
- [ ] 画像なしのQRコードも正常に動作する
