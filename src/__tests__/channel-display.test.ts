import { describe, it, expect } from "vitest";
import { getChannelPublicName } from "@/lib/channel-display";

describe("getChannelPublicName", () => {
  it("displayNameが設定されていればそれを返す", () => {
    const channel = { name: "管理用の名前", displayName: "公開用の名前" };
    expect(getChannelPublicName(channel)).toBe("公開用の名前");
  });

  it("displayNameがnullならnameをフォールバックとして返す", () => {
    const channel = { name: "管理用の名前", displayName: null };
    expect(getChannelPublicName(channel)).toBe("管理用の名前");
  });

  it("displayNameが空文字ならnameをフォールバックとして返す", () => {
    const channel = { name: "管理用の名前", displayName: "" };
    expect(getChannelPublicName(channel)).toBe("管理用の名前");
  });

  it("displayNameがundefinedならnameをフォールバックとして返す", () => {
    const channel = { name: "管理用の名前" };
    expect(getChannelPublicName(channel)).toBe("管理用の名前");
  });
});
