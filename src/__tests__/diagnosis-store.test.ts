import { describe, it, expect, beforeEach } from "vitest";
import { useDiagnosisStore } from "@/lib/diagnosis-store";
import type { DiagnosisType } from "@/data/diagnosis-types";

// テスト用の最小の診断タイプ（質問2つ・結果2パターン）
const diagnosis: DiagnosisType = {
  slug: "teeth-yellowing",
  name: "歯の黄ばみ判定",
  description: "",
  questions: [
    { id: 1, text: "Q1", choices: [{ text: "A", score: 1 }, { text: "B", score: 3 }] },
    { id: 2, text: "Q2", choices: [{ text: "A", score: 1 }, { text: "B", score: 3 }] },
  ],
  resultPatterns: [
    { minScore: 0, maxScore: 3, category: "low", title: "良好", message: "" },
    { minScore: 4, maxScore: 6, category: "mid", title: "やや注意", message: "" },
  ],
};

describe("診断ストアの完了記録（completion）", () => {
  beforeEach(() => {
    useDiagnosisStore.getState().reset();
  });

  it("結果が確定すると完了キーが1つ発行される", () => {
    const store = useDiagnosisStore.getState();
    store.setProfile(30, "female", false);
    store.setAnswer(0, 1, 3);
    store.setAnswer(1, 1, 3);
    store.calculateResult(diagnosis);

    const { completion, resultPattern } = useDiagnosisStore.getState();
    expect(resultPattern?.category).toBe("mid");
    expect(completion).not.toBeNull();
    expect(completion?.diagnosisSlug).toBe("teeth-yellowing");
    expect(completion?.sessionId).toBeNull();
    // サーバー側の検証（8〜64文字の英数字・-・_）を通る形式であること
    expect(completion?.key).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it("結果を出し直すと新しい完了キーになる（別の完了として扱う）", () => {
    const store = useDiagnosisStore.getState();
    store.setAnswer(0, 0, 1);
    store.calculateResult(diagnosis);
    const first = useDiagnosisStore.getState().completion?.key;

    store.calculateResult(diagnosis);
    const second = useDiagnosisStore.getState().completion?.key;

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(first).not.toBe(second);
  });

  it("記録済みのセッションIDを控えられ、キーは変わらない", () => {
    const store = useDiagnosisStore.getState();
    store.setAnswer(0, 0, 1);
    store.calculateResult(diagnosis);
    const keyBefore = useDiagnosisStore.getState().completion?.key;

    store.markCompletionTracked("session-abc");

    const { completion } = useDiagnosisStore.getState();
    expect(completion?.sessionId).toBe("session-abc");
    expect(completion?.key).toBe(keyBefore);
  });

  it("結果が無いときに markCompletionTracked を呼んでも何も起きない", () => {
    useDiagnosisStore.getState().markCompletionTracked("session-abc");
    expect(useDiagnosisStore.getState().completion).toBeNull();
  });

  it("reset で完了記録も消える", () => {
    const store = useDiagnosisStore.getState();
    store.setAnswer(0, 0, 1);
    store.calculateResult(diagnosis);
    expect(useDiagnosisStore.getState().completion).not.toBeNull();

    store.reset();
    expect(useDiagnosisStore.getState().completion).toBeNull();
    expect(useDiagnosisStore.getState().resultPattern).toBeNull();
  });
});
