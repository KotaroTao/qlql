/**
 * 既存医院の share_token 一括設定スクリプト
 *
 * share_token が NULL の医院すべてに、新しいトークンを生成・設定する。
 * 実行方法: npx tsx prisma/backfill-share-tokens.ts
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

async function main() {
  // share_token が NULL の医院を取得
  const clinics = await prisma.clinic.findMany({
    where: { shareToken: null },
    select: { id: true, name: true },
  });

  console.log(`share_token が未設定の医院: ${clinics.length} 件`);

  if (clinics.length === 0) {
    console.log("対応不要です。すべての医院に share_token が設定済みです。");
    return;
  }

  // 1件ずつ share_token を生成・設定
  for (const clinic of clinics) {
    const shareToken = crypto.randomBytes(32).toString("base64url");
    await prisma.clinic.update({
      where: { id: clinic.id },
      data: { shareToken },
    });
    console.log(`  ✔ ${clinic.name} (ID: ${clinic.id}) → share_token を設定`);
  }

  // 確認: share_token が NULL の医院が残っていないことを確認
  const remaining = await prisma.clinic.count({
    where: { shareToken: null },
  });
  console.log(`\n完了確認: share_token が未設定の医院 = ${remaining} 件`);
  if (remaining === 0) {
    console.log("すべての医院に share_token が設定されました！");
  } else {
    console.error("警告: まだ未設定の医院があります。");
  }
}

main()
  .catch((e) => {
    console.error("エラー:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
