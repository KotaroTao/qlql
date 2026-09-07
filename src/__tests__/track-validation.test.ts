import { describe, it, expect } from "vitest";
import {
  sanitizeAge,
  sanitizeGender,
  sanitizeLatitude,
  sanitizeLongitude,
  sanitizeString,
  sanitizeCtaType,
  sanitizeEventType,
  sanitizeCompletionKey,
} from "@/lib/track-validation";

describe("sanitizeAge", () => {
  it("有効な年齢を返す", () => {
    expect(sanitizeAge(25)).toBe(25);
    expect(sanitizeAge(0)).toBe(0);
    expect(sanitizeAge(120)).toBe(120);
    expect(sanitizeAge("30")).toBe(30);
  });

  it("無効な値はnull", () => {
    expect(sanitizeAge(-1)).toBeNull();
    expect(sanitizeAge(121)).toBeNull();
    expect(sanitizeAge("abc")).toBeNull();
    expect(sanitizeAge(null)).toBeNull();
    expect(sanitizeAge(undefined)).toBeNull();
    expect(sanitizeAge("")).toBeNull();
    expect(sanitizeAge(25.5)).toBeNull(); // 整数のみ
  });
});

describe("sanitizeGender", () => {
  it("許可された性別を返す", () => {
    expect(sanitizeGender("male")).toBe("male");
    expect(sanitizeGender("female")).toBe("female");
    expect(sanitizeGender("other")).toBe("other");
  });

  it("不正な値はnull", () => {
    expect(sanitizeGender("invalid")).toBeNull();
    expect(sanitizeGender(123)).toBeNull();
    expect(sanitizeGender(null)).toBeNull();
  });
});

describe("sanitizeLatitude", () => {
  it("有効な緯度を返す", () => {
    expect(sanitizeLatitude(35.6762)).toBe(35.6762);
    expect(sanitizeLatitude(-90)).toBe(-90);
    expect(sanitizeLatitude(90)).toBe(90);
  });

  it("範囲外はnull", () => {
    expect(sanitizeLatitude(-91)).toBeNull();
    expect(sanitizeLatitude(91)).toBeNull();
    expect(sanitizeLatitude(NaN)).toBeNull();
  });
});

describe("sanitizeLongitude", () => {
  it("有効な経度を返す", () => {
    expect(sanitizeLongitude(139.6503)).toBe(139.6503);
    expect(sanitizeLongitude(-180)).toBe(-180);
    expect(sanitizeLongitude(180)).toBe(180);
  });

  it("範囲外はnull", () => {
    expect(sanitizeLongitude(-181)).toBeNull();
    expect(sanitizeLongitude(181)).toBeNull();
  });
});

describe("sanitizeString", () => {
  it("文字列を返す", () => {
    expect(sanitizeString("hello")).toBe("hello");
  });

  it("空文字と非文字列はnull", () => {
    expect(sanitizeString("")).toBeNull();
    expect(sanitizeString(123)).toBeNull();
    expect(sanitizeString(null)).toBeNull();
  });

  it("最大長で切り詰める", () => {
    expect(sanitizeString("abcdefghij", 5)).toBe("abcde");
  });
});

describe("sanitizeCtaType", () => {
  it("許可されたタイプを返す", () => {
    expect(sanitizeCtaType("booking")).toBe("booking");
    expect(sanitizeCtaType("phone")).toBe("phone");
    expect(sanitizeCtaType("line")).toBe("line");
  });

  it("不正な値はnull", () => {
    expect(sanitizeCtaType("invalid")).toBeNull();
    expect(sanitizeCtaType(123)).toBeNull();
  });
});

describe("sanitizeEventType", () => {
  it("許可されたイベントタイプを返す", () => {
    expect(sanitizeEventType("page_view")).toBe("page_view");
    expect(sanitizeEventType("qr_scan")).toBe("qr_scan");
  });

  it("不正な値はデフォルト（page_view）", () => {
    expect(sanitizeEventType("invalid")).toBe("page_view");
    expect(sanitizeEventType(123)).toBe("page_view");
  });
});

describe("sanitizeCompletionKey", () => {
  it("英数字・ハイフン・アンダースコアの8〜64文字を通す", () => {
    const uuid = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(sanitizeCompletionKey(uuid)).toBe(uuid);
    expect(sanitizeCompletionKey("abc_DEF-123")).toBe("abc_DEF-123");
  });

  it("形式が合わない値はnull", () => {
    expect(sanitizeCompletionKey(null)).toBeNull();
    expect(sanitizeCompletionKey(undefined)).toBeNull();
    expect(sanitizeCompletionKey(123)).toBeNull();
    expect(sanitizeCompletionKey("short")).toBeNull(); // 8文字未満
    expect(sanitizeCompletionKey("a".repeat(65))).toBeNull(); // 64文字超
    expect(sanitizeCompletionKey("has space here")).toBeNull();
    expect(sanitizeCompletionKey("日本語のキーです")).toBeNull();
  });
});
