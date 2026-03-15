import { describe, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * 公開ページ（QRコード経由でユーザーが見るページ）で
 * 管理用のチャンネル名（channelName / channel.name）が
 * 直接使われていないことを確認するテスト。
 *
 * 過去に displayName ではなく name が表示されるバグがあったため、
 * 同じミスが再発しないようにこのテストで自動チェックする。
 *
 * 正しい方法: getChannelPublicName(channel) を使って
 *   channelPublicName という prop でコンポーネントに渡す。
 */

// 公開ページのコンポーネントファイル（QRコードを読んだユーザーが見るページ）
const PUBLIC_COMPONENT_FILES = [
  "src/components/link/link-profile-form.tsx",
  "src/components/diagnosis/diagnosis-profile-form.tsx",
  "src/components/diagnosis/profile-form.tsx",
];

// 公開ページのサーバーコンポーネント
const PUBLIC_PAGE_DIRS = [
  "src/app/c",
];

// 危険なパターン: 管理用名がそのまま渡されている可能性がある
const DANGEROUS_PATTERNS = [
  /channelName\s*[=}]/,          // channelName= や channelName} （propとして渡す/表示する）
  /\{channelName\}/,              // {channelName} （JSXで直接表示）
  /channel\.name\b(?!\s*\))/,     // channel.name（channel.nameをそのまま使う。ただしclinic.nameは除外）
];

// 安全なパターン（これらにマッチする行は除外）
const SAFE_PATTERNS = [
  /getChannelPublicName/,          // ヘルパー関数を使っている
  /channelPublicName/,             // 正しいprop名
  /channelDisplayName.*\|\|/,      // displayNameのフォールバック（既存の安全なパターン）
  /clinic\.name/,                  // 医院名（これはOK）
  /channel\.name\s*\}/,            // ファイル名として使う場合 (download用等)
  /\/\//,                          // コメント行
];

function getAllTsxFiles(dir: string): string[] {
  const files: string[] = [];
  const fullDir = path.resolve(dir);
  if (!fs.existsSync(fullDir)) return files;

  const entries = fs.readdirSync(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(fullDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...getAllTsxFiles(fullPath));
    } else if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

describe("公開ページで管理用チャンネル名が漏れていないこと", () => {
  it("公開コンポーネントでchannelNameプロップを使っていない", () => {
    const violations: string[] = [];

    for (const file of PUBLIC_COMPONENT_FILES) {
      const fullPath = path.resolve(file);
      if (!fs.existsSync(fullPath)) continue;

      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");

      lines.forEach((line, i) => {
        // interface定義内は除外（propsの型定義は問題ない）
        if (line.includes("interface") || line.trim().startsWith("//")) return;

        // 安全なパターンにマッチする行は除外
        if (SAFE_PATTERNS.some((p) => p.test(line))) return;

        for (const pattern of DANGEROUS_PATTERNS) {
          if (pattern.test(line)) {
            violations.push(
              `${file}:${i + 1}: ${line.trim()}\n` +
              `  → channelName ではなく channelPublicName を使ってください`
            );
          }
        }
      });
    }

    if (violations.length > 0) {
      throw new Error(
        "管理用チャンネル名が公開ページに漏れている可能性があります:\n\n" +
        violations.join("\n\n") +
        "\n\n修正方法: getChannelPublicName(channel) を使って channelPublicName prop で渡してください"
      );
    }
  });

  it("公開ページ（src/app/c/）でchannelNameプロップを渡していない", () => {
    const violations: string[] = [];

    for (const dir of PUBLIC_PAGE_DIRS) {
      const files = getAllTsxFiles(dir);
      for (const fullPath of files) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const lines = content.split("\n");
        const relativePath = path.relative(".", fullPath);

        lines.forEach((line, i) => {
          if (line.trim().startsWith("//")) return;
          if (SAFE_PATTERNS.some((p) => p.test(line))) return;

          // channelName=（propとして渡している）を検出
          if (/channelName\s*=/.test(line)) {
            violations.push(
              `${relativePath}:${i + 1}: ${line.trim()}\n` +
              `  → channelName= ではなく channelPublicName={getChannelPublicName(channel)} を使ってください`
            );
          }
        });
      }
    }

    if (violations.length > 0) {
      throw new Error(
        "公開ページで管理用チャンネル名がpropとして渡されています:\n\n" +
        violations.join("\n\n") +
        "\n\n修正方法: getChannelPublicName(channel) を使って channelPublicName prop で渡してください"
      );
    }
  });
});
