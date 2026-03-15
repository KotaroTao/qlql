import { prisma } from "./prisma";
import {
  PlanType,
  getPlan,
  canCreateQRCode,
  getRemainingQRCodes,
  canCreateCustomDiagnosis,
  TRIAL_CONFIG,
  GRACE_PERIOD_DAYS,
} from "./plans";

export type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "canceled"
  | "suspended"
  | "expired"
  | "grace_period";

export interface SubscriptionCheck {
  isActive: boolean;
  status: SubscriptionStatus;
  trialDaysLeft: number | null;
  message: string | null;
}

export interface SubscriptionState {
  status: SubscriptionStatus;
  planType: PlanType;
  isActive: boolean; // サービス利用可能か
  canCreateQR: boolean; // QRコード作成可能か
  canEditQR: boolean; // QRコード編集可能か
  canTrack: boolean; // 計測可能か
  canCreateCustomDiagnosis: boolean; // オリジナル診断作成可能か
  canEditDiagnosis: boolean; // 診断編集可能か
  isDemo: boolean; // デモアカウントか
  trialDaysLeft: number | null;
  gracePeriodDaysLeft: number | null;
  currentPeriodEnd: Date | null;
  message: string | null; // ダッシュボード表示用メッセージ
  alertType: "info" | "warning" | "error" | null;
  qrCodeLimit: number | null; // null = 無制限
  qrCodeCount: number;
  remainingQRCodes: number | null; // null = 無制限
}

// 契約状態を取得（詳細版）
export async function getSubscriptionState(
  clinicId: string
): Promise<SubscriptionState> {
  const subscription = await prisma.subscription.findUnique({
    where: { clinicId },
  });

  const now = new Date();

  // QRコード数を取得（非表示含む全QRコードをカウント、完全削除で枠が空く）
  const qrCount = await prisma.channel.count({
    where: { clinicId },
  });

  // サブスクリプションがない場合（新規登録直後など）
  if (!subscription) {
    return {
      status: "expired",
      planType: "starter",
      isActive: false,
      canCreateQR: false,
      canEditQR: false,
      canTrack: false,
      canCreateCustomDiagnosis: false,
      canEditDiagnosis: false,
      isDemo: false,
      trialDaysLeft: null,
      gracePeriodDaysLeft: null,
      currentPeriodEnd: null,
      message: "契約情報がありません。お問い合わせください。",
      alertType: "error",
      qrCodeLimit: 2,
      qrCodeCount: qrCount,
      remainingQRCodes: 0,
    };
  }

  const planType = ((subscription as { planType?: string }).planType as PlanType) || "starter";
  const plan = getPlan(planType);

  // 無料プランの場合
  if (planType === "free") {
    return {
      status: "active",
      planType: "free",
      isActive: true,
      canCreateQR: true,
      canEditQR: true,
      canTrack: true,
      canCreateCustomDiagnosis: true,
      canEditDiagnosis: true,
      isDemo: false,
      trialDaysLeft: null,
      gracePeriodDaysLeft: null,
      currentPeriodEnd: null,
      message: null,
      alertType: null,
      qrCodeLimit: null,
      qrCodeCount: qrCount,
      remainingQRCodes: null,
    };
  }

  // デモプランの場合（閲覧のみ）
  if (planType === "demo") {
    return {
      status: "active",
      planType: "demo",
      isActive: true,
      canCreateQR: false,
      canEditQR: false,
      canTrack: true,
      canCreateCustomDiagnosis: false,
      canEditDiagnosis: false,
      isDemo: true,
      trialDaysLeft: null,
      gracePeriodDaysLeft: null,
      currentPeriodEnd: null,
      message: "デモアカウントのため、データの閲覧のみ可能です。QRコードや診断の作成・編集はできません。",
      alertType: "info",
      qrCodeLimit: null,
      qrCodeCount: qrCount,
      remainingQRCodes: null,
    };
  }

  // トライアル中
  if (subscription.status === "trial" && subscription.trialEnd) {
    const trialEnd = new Date(subscription.trialEnd);
    const trialDaysLeft = Math.max(
      0,
      Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    );

    if (trialDaysLeft > 0) {
      // トライアル期間中はスタータープラン相当のQRコード制限
      const trialPlanType = TRIAL_CONFIG.planEquivalent;
      const trialPlan = getPlan(trialPlanType);
      const canCreate = canCreateQRCode(trialPlanType, qrCount);
      const remaining = getRemainingQRCodes(trialPlanType, qrCount);

      return {
        status: "trial",
        planType: trialPlanType,
        isActive: true,
        canCreateQR: canCreate,
        canEditQR: true,
        canTrack: true,
        canCreateCustomDiagnosis: canCreateCustomDiagnosis(trialPlanType),
        canEditDiagnosis: true,
        isDemo: false,
        trialDaysLeft,
        gracePeriodDaysLeft: null,
        currentPeriodEnd: trialEnd,
        message:
          trialDaysLeft <= 3
            ? `トライアル期間が残り${trialDaysLeft}日です。継続利用にはプランをご契約ください。`
            : `トライアル期間: 残り${trialDaysLeft}日`,
        alertType: trialDaysLeft <= 3 ? "warning" : "info",
        qrCodeLimit: trialPlan.qrCodeLimit,
        qrCodeCount: qrCount,
        remainingQRCodes: remaining,
      };
    }

    // トライアル期間終了 → 猶予期間チェック
    const gracePeriodEnd =
      (subscription as { gracePeriodEnd?: Date }).gracePeriodEnd ||
      new Date(trialEnd.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    if (now <= gracePeriodEnd) {
      const graceDaysLeft = Math.ceil(
        (gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        status: "grace_period",
        planType,
        isActive: true,
        canCreateQR: false,
        canEditQR: false,
        canTrack: false,
        canCreateCustomDiagnosis: false,
        canEditDiagnosis: false,
        isDemo: false,
        trialDaysLeft: 0,
        gracePeriodDaysLeft: graceDaysLeft,
        currentPeriodEnd: gracePeriodEnd,
        message: `トライアル期間が終了しました。${graceDaysLeft}日以内にプランをご契約ください。`,
        alertType: "error",
        qrCodeLimit: plan.qrCodeLimit,
        qrCodeCount: qrCount,
        remainingQRCodes: 0,
      };
    }

    // 猶予期間も終了
    return {
      status: "expired",
      planType,
      isActive: true, // ログインとデータ閲覧は可能
      canCreateQR: false,
      canEditQR: false,
      canTrack: false,
      canCreateCustomDiagnosis: false,
      canEditDiagnosis: false,
      isDemo: false,
      trialDaysLeft: 0,
      gracePeriodDaysLeft: 0,
      currentPeriodEnd: null,
      message:
        "契約期間が終了しました。サービスを継続するにはプランをご契約ください。",
      alertType: "error",
      qrCodeLimit: plan.qrCodeLimit,
      qrCodeCount: qrCount,
      remainingQRCodes: 0,
    };
  }

  // 有効な契約
  if (subscription.status === "active") {
    // currentPeriodEndがnullの場合（無期限または設定なし）は有効とみなす
    if (!subscription.currentPeriodEnd) {
      const canCreate = canCreateQRCode(planType, qrCount);
      const remaining = getRemainingQRCodes(planType, qrCount);

      return {
        status: "active",
        planType,
        isActive: true,
        canCreateQR: canCreate,
        canEditQR: true,
        canTrack: true,
        canCreateCustomDiagnosis: canCreateCustomDiagnosis(planType),
        canEditDiagnosis: true,
        isDemo: false,
        trialDaysLeft: null,
        gracePeriodDaysLeft: null,
        currentPeriodEnd: null,
        message:
          remaining !== null && remaining <= 0
            ? `QRコード作成上限に達しています。プランをアップグレードしてください。`
            : null,
        alertType: remaining !== null && remaining <= 0 ? "warning" : null,
        qrCodeLimit: plan.qrCodeLimit,
        qrCodeCount: qrCount,
        remainingQRCodes: remaining,
      };
    }

    const periodEnd = new Date(subscription.currentPeriodEnd);

    if (now <= periodEnd) {
      const canCreate = canCreateQRCode(planType, qrCount);
      const remaining = getRemainingQRCodes(planType, qrCount);

      return {
        status: "active",
        planType,
        isActive: true,
        canCreateQR: canCreate,
        canEditQR: true,
        canTrack: true,
        canCreateCustomDiagnosis: canCreateCustomDiagnosis(planType),
        canEditDiagnosis: true,
        isDemo: false,
        trialDaysLeft: null,
        gracePeriodDaysLeft: null,
        currentPeriodEnd: periodEnd,
        message:
          remaining !== null && remaining <= 0
            ? `QRコード作成上限に達しています。プランをアップグレードしてください。`
            : null,
        alertType: remaining !== null && remaining <= 0 ? "warning" : null,
        qrCodeLimit: plan.qrCodeLimit,
        qrCodeCount: qrCount,
        remainingQRCodes: remaining,
      };
    }

    // 契約期間終了 → 猶予期間チェック
    const gracePeriodEnd =
      (subscription as { gracePeriodEnd?: Date }).gracePeriodEnd ||
      new Date(periodEnd.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    if (now <= gracePeriodEnd) {
      const graceDaysLeft = Math.ceil(
        (gracePeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      return {
        status: "grace_period",
        planType,
        isActive: true,
        canCreateQR: false,
        canEditQR: false,
        canTrack: false,
        canCreateCustomDiagnosis: false,
        canEditDiagnosis: false,
        isDemo: false,
        trialDaysLeft: null,
        gracePeriodDaysLeft: graceDaysLeft,
        currentPeriodEnd: gracePeriodEnd,
        message: `契約期間が終了しました。${graceDaysLeft}日以内に更新してください。`,
        alertType: "error",
        qrCodeLimit: plan.qrCodeLimit,
        qrCodeCount: qrCount,
        remainingQRCodes: 0,
      };
    }

    // 猶予期間も終了
    return {
      status: "expired",
      planType,
      isActive: true,
      canCreateQR: false,
      canEditQR: false,
      canTrack: false,
      canCreateCustomDiagnosis: false,
      canEditDiagnosis: false,
      isDemo: false,
      trialDaysLeft: null,
      gracePeriodDaysLeft: 0,
      currentPeriodEnd: null,
      message:
        "契約期間が終了しました。サービスを継続するにはプランをご契約ください。",
      alertType: "error",
      qrCodeLimit: plan.qrCodeLimit,
      qrCodeCount: qrCount,
      remainingQRCodes: 0,
    };
  }

  // 解約済み
  if (subscription.status === "canceled" && subscription.currentPeriodEnd) {
    const periodEnd = new Date(subscription.currentPeriodEnd);

    if (now <= periodEnd) {
      const canCreate = canCreateQRCode(planType, qrCount);
      const remaining = getRemainingQRCodes(planType, qrCount);

      return {
        status: "canceled",
        planType,
        isActive: true,
        canCreateQR: canCreate,
        canEditQR: true,
        canTrack: true,
        canCreateCustomDiagnosis: canCreateCustomDiagnosis(planType),
        canEditDiagnosis: true,
        isDemo: false,
        trialDaysLeft: null,
        gracePeriodDaysLeft: null,
        currentPeriodEnd: periodEnd,
        message: `解約済みです。${periodEnd.toLocaleDateString("ja-JP")}まで利用可能です。`,
        alertType: "warning",
        qrCodeLimit: plan.qrCodeLimit,
        qrCodeCount: qrCount,
        remainingQRCodes: remaining,
      };
    }

    // 期間終了
    return {
      status: "expired",
      planType,
      isActive: true,
      canCreateQR: false,
      canEditQR: false,
      canTrack: false,
      canCreateCustomDiagnosis: false,
      canEditDiagnosis: false,
      isDemo: false,
      trialDaysLeft: null,
      gracePeriodDaysLeft: null,
      currentPeriodEnd: null,
      message:
        "契約期間が終了しました。サービスを継続するにはプランをご契約ください。",
      alertType: "error",
      qrCodeLimit: plan.qrCodeLimit,
      qrCodeCount: qrCount,
      remainingQRCodes: 0,
    };
  }

  // 支払い遅延
  if (subscription.status === "past_due") {
    return {
      status: "past_due",
      planType,
      isActive: true,
      canCreateQR: false,
      canEditQR: false,
      canTrack: false,
      canCreateCustomDiagnosis: false,
      canEditDiagnosis: false,
      isDemo: false,
      trialDaysLeft: null,
      gracePeriodDaysLeft: null,
      currentPeriodEnd: subscription.currentPeriodEnd,
      message: "お支払いに問題があります。カード情報を更新してください。",
      alertType: "error",
      qrCodeLimit: plan.qrCodeLimit,
      qrCodeCount: qrCount,
      remainingQRCodes: 0,
    };
  }

  // デフォルト（予期しない状態）
  return {
    status: "expired",
    planType,
    isActive: true,
    canCreateQR: false,
    canEditQR: false,
    canTrack: false,
    canCreateCustomDiagnosis: false,
    canEditDiagnosis: false,
    isDemo: false,
    trialDaysLeft: null,
    gracePeriodDaysLeft: null,
    currentPeriodEnd: null,
    message: "契約状態を確認できません。お問い合わせください。",
    alertType: "error",
    qrCodeLimit: plan.qrCodeLimit,
    qrCodeCount: qrCount,
    remainingQRCodes: 0,
  };
}

// サブスクリプション状態をチェック（後方互換性のため維持）
export async function checkSubscription(clinicId: string): Promise<SubscriptionCheck> {
  const state = await getSubscriptionState(clinicId);

  return {
    isActive: state.isActive,
    status: state.status === "grace_period" ? "suspended" : state.status,
    trialDaysLeft: state.trialDaysLeft,
    message: state.message,
  };
}

// 医院がアクティブかどうかをチェック（簡易版）
export async function isClinicActive(clinicId: string): Promise<boolean> {
  const check = await checkSubscription(clinicId);
  return check.isActive;
}

// 計測可能かチェック（高速版：APIで使用）
export async function canTrackSession(clinicId: string): Promise<boolean> {
  const subscription = await prisma.subscription.findUnique({
    where: { clinicId },
    select: {
      status: true,
      planType: true,
      trialEnd: true,
      currentPeriodEnd: true,
    },
  });

  if (!subscription) return false;

  const planType = (subscription.planType as PlanType) || "starter";

  // 無料プランは常に計測可能
  if (planType === "free") return true;

  const now = new Date();

  // トライアル中
  if (subscription.status === "trial" && subscription.trialEnd) {
    return now <= new Date(subscription.trialEnd);
  }

  // 有効な契約
  if (subscription.status === "active") {
    // currentPeriodEndがnullの場合は無期限とみなす
    if (!subscription.currentPeriodEnd) return true;
    return now <= new Date(subscription.currentPeriodEnd);
  }

  // 解約済みでも期間内
  if (subscription.status === "canceled" && subscription.currentPeriodEnd) {
    return now <= new Date(subscription.currentPeriodEnd);
  }

  return false;
}

// QRコード作成可能かチェック（高速版：APIで使用）
export async function canCreateChannel(clinicId: string): Promise<{
  canCreate: boolean;
  remaining: number | null;
  message: string | null;
}> {
  const state = await getSubscriptionState(clinicId);

  if (!state.canCreateQR) {
    return {
      canCreate: false,
      remaining: 0,
      message: state.message || "QRコードを作成できません。",
    };
  }

  if (state.remainingQRCodes !== null && state.remainingQRCodes <= 0) {
    const plan = getPlan(state.planType);
    return {
      canCreate: false,
      remaining: 0,
      message: `QRコード作成上限（${plan.qrCodeLimit}枚）に達しています。プランをアップグレードしてください。`,
    };
  }

  return {
    canCreate: true,
    remaining: state.remainingQRCodes,
    message: null,
  };
}
