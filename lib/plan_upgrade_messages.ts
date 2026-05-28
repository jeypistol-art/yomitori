import { type PlanCode } from "@/lib/feature_gates";

type PlanUpgradeMessage = {
  headline: string;
  body: string;
  cta: string;
};

const planUpgradeMessages: Record<PlanCode, PlanUpgradeMessage> = {
  personal: {
    headline: "個人の書類対応を整理できます",
    body: "要約、期限抽出、個人タスク化で、まずは自分の書類対応を取りこぼしにくくします。",
    cta: "Personalを確認",
  },
  business: {
    headline: "個人対応から、チームで止まらない運用へ",
    body: "担当者割当、共有台帳、未処理一覧で、書類対応を個人の記憶ではなくチームの流れとして管理できます。",
    cta: "Businessを確認",
  },
  pro: {
    headline: "判断と引き継ぎに、証跡を残せる運用へ",
    body: "監査ログ、権限管理、差分確認で、誰が何を確認し、いつ完了したかを後から追える状態にします。",
    cta: "Proを確認",
  },
  enterprise: {
    headline: "自社の書類ルールへ組み込む運用へ",
    body: "分類テンプレ、導入支援、API/Webhook、運用ルール設計を組み合わせ、既存業務に合わせて定着させます。",
    cta: "Enterpriseを確認",
  },
};

export function getPlanUpgradeMessage(planCode: string) {
  if (
    planCode === "personal" ||
    planCode === "business" ||
    planCode === "pro" ||
    planCode === "enterprise"
  ) {
    return planUpgradeMessages[planCode];
  }
  return planUpgradeMessages.personal;
}
