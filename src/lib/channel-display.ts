/**
 * チャンネルの公開表示名を取得するヘルパー関数
 *
 * 管理用の名前（name）がアンケートページなどに表示されるバグを防ぐため、
 * 公開ページでチャンネル名を表示するときは必ずこの関数を使う。
 *
 * - displayName が設定されていればそれを返す
 * - 未設定なら name をフォールバックとして返す
 */
export function getChannelPublicName(channel: {
  name: string;
  displayName?: string | null;
}): string {
  return channel.displayName || channel.name;
}
