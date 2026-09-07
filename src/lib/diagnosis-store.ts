import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { DiagnosisType, ResultPattern } from "@/data/diagnosis-types";

interface Answer {
  choiceIndex: number;
  score: number;
}

// 「この診断結果の完了記録」を表すメモ。
// 結果が出た瞬間に1回だけ発行され、結果画面を再読み込み（リロード・タブ復帰など）しても
// 同じ結果には同じ key が付いたままなので、サーバーが「もう記録済み」と判別できる。
export interface CompletionRecord {
  // 完了1件につき1つの合言葉（サーバー側で重複防止の鍵として使う）
  key: string;
  // どの診断タイプの結果か（別の診断の結果を取り違えて表示しないため）
  diagnosisSlug: string;
  // サーバーに記録済みならそのセッションID（未送信・失敗なら null）
  sessionId: string | null;
}

// ブラウザで完了キーを生成する。crypto.randomUUID が使えない古い環境向けの予備あり。
export function generateCompletionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  const rand = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand()}-${rand()}`;
}

interface DiagnosisState {
  // ハイドレーション状態
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;

  // プロフィール
  userAge: number | null;
  userGender: string | null;
  locationConsent: boolean;
  latitude: number | null;
  longitude: number | null;

  // 診断進行状態
  currentStep: number;
  answers: Answer[];

  // 結果
  totalScore: number | null;
  resultPattern: ResultPattern | null;
  oralAge: number | null;
  // 完了記録（結果が出るまでは null）
  completion: CompletionRecord | null;

  // アクション
  setProfile: (age: number, gender: string | null, locationConsent: boolean) => void;
  setLocation: (latitude: number | null, longitude: number | null) => void;
  setAnswer: (step: number, choiceIndex: number, score: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  calculateResult: (diagnosis: DiagnosisType) => void;
  // サーバーへの完了記録が済んだらセッションIDを控える
  markCompletionTracked: (sessionId: string | null) => void;
  reset: () => void;
}

export const useDiagnosisStore = create<DiagnosisState>()(
  persist(
    (set, get) => ({
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      userAge: null,
      userGender: null,
      locationConsent: false,
      latitude: null,
      longitude: null,
      currentStep: 0,
      answers: [],
      totalScore: null,
      resultPattern: null,
      oralAge: null,
      completion: null,

      setProfile: (age, gender, locationConsent) => set({ userAge: age, userGender: gender, locationConsent }),
      setLocation: (latitude, longitude) => set({ latitude, longitude }),

      setAnswer: (step, choiceIndex, score) => {
        const answers = [...get().answers];
        answers[step] = { choiceIndex, score };
        set({ answers });
      },

      nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),

      prevStep: () =>
        set((state) => ({
          currentStep: Math.max(0, state.currentStep - 1),
        })),

      calculateResult: (diagnosis) => {
        const { answers, userAge } = get();
        const totalScore = answers.reduce((sum, answer) => sum + answer.score, 0);

        const resultPattern =
          diagnosis.resultPatterns.find(
            (p) => totalScore >= p.minScore && totalScore <= p.maxScore
          ) || diagnosis.resultPatterns[diagnosis.resultPatterns.length - 1];

        let oralAge: number | null = null;
        if (
          diagnosis.slug === "oral-age" &&
          userAge &&
          resultPattern.ageModifier !== undefined
        ) {
          oralAge = userAge + resultPattern.ageModifier;
        }

        // 結果が確定したタイミングで完了キーを1つ発行する。
        // 同じ結果に対しては（リロードしても）このキーが使い回される。
        set({
          totalScore,
          resultPattern,
          oralAge,
          completion: {
            key: generateCompletionKey(),
            diagnosisSlug: diagnosis.slug,
            sessionId: null,
          },
        });
      },

      markCompletionTracked: (sessionId) =>
        set((state) =>
          state.completion
            ? { completion: { ...state.completion, sessionId } }
            : {}
        ),

      reset: () =>
        set({
          userAge: null,
          userGender: null,
          locationConsent: false,
          latitude: null,
          longitude: null,
          currentStep: 0,
          answers: [],
          totalScore: null,
          resultPattern: null,
          oralAge: null,
          completion: null,
        }),
    }),
    {
      name: "diagnosis-store",
      // sessionStorageを使用（タブを閉じるとクリア）
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          // サーバーサイドではダミーストレージを返す
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }
        return sessionStorage;
      }),
      // ハイドレーション完了時にフラグを立てる
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHasHydrated(true);
        }
      },
      // _hasHydratedは永続化しない
      partialize: (state) => ({
        userAge: state.userAge,
        userGender: state.userGender,
        locationConsent: state.locationConsent,
        latitude: state.latitude,
        longitude: state.longitude,
        currentStep: state.currentStep,
        answers: state.answers,
        totalScore: state.totalScore,
        resultPattern: state.resultPattern,
        oralAge: state.oralAge,
        completion: state.completion,
      }),
    }
  )
);
