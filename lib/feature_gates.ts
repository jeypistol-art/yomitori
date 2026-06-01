import { ApiError } from "@/lib/api_errors";
import { getPlanCatalogItem, PLAN_CATALOG } from "@/lib/usage_catalog";

export type PlanCode = "personal" | "business" | "pro" | "enterprise";

export type FeatureKey =
  | "personal_tasks"
  | "calendar_sync"
  | "team_members"
  | "assignee_workflow"
  | "shared_ledger"
  | "monthly_work_queue"
  | "audit_logs"
  | "document_diff"
  | "advanced_permissions"
  | "branch_ledgers"
  | "priority_processing"
  | "document_templates"
  | "api_webhooks"
  | "onboarding_support"
  | "custom_rules"
  | "priority_support";

export type FeatureGate = {
  key: FeatureKey;
  label: string;
  description: string;
  minimumPlan: PlanCode;
  valueTheme: "personal" | "team" | "trust" | "embedded";
};

export type FeatureAvailability = FeatureGate & {
  available: boolean;
  requiredPlanName: string;
};

const PLAN_RANK: Record<PlanCode, number> = {
  personal: 1,
  business: 2,
  pro: 3,
  enterprise: 4,
};

export const FEATURE_GATES: FeatureGate[] = [
  {
    key: "personal_tasks",
    label: "個人タスク化",
    description: "抽出した期限と対応事項を自分のタスクとして管理できます。",
    minimumPlan: "personal",
    valueTheme: "personal",
  },
  {
    key: "calendar_sync",
    label: "カレンダー連携",
    description: "期限とリマインドを個人カレンダーへ連携します。",
    minimumPlan: "personal",
    valueTheme: "personal",
  },
  {
    key: "team_members",
    label: "複数ユーザー",
    description: "担当者を登録し、チームで書類とタスクを共有します。",
    minimumPlan: "business",
    valueTheme: "team",
  },
  {
    key: "assignee_workflow",
    label: "担当者割当",
    description: "承認時に担当者へタスクを割り当て、通知までつなげます。",
    minimumPlan: "business",
    valueTheme: "team",
  },
  {
    key: "shared_ledger",
    label: "共有台帳",
    description: "管理対象と取引先をチーム共通の台帳として扱います。",
    minimumPlan: "business",
    valueTheme: "team",
  },
  {
    key: "monthly_work_queue",
    label: "月次未処理一覧",
    description: "月内に残っている書類とタスクをまとめて確認します。",
    minimumPlan: "business",
    valueTheme: "team",
  },
  {
    key: "audit_logs",
    label: "監査ログ",
    description: "誰が、いつ、何を承認・変更したかを証跡として残します。",
    minimumPlan: "pro",
    valueTheme: "trust",
  },
  {
    key: "document_diff",
    label: "過去書類との差分",
    description: "前回書類と今回書類の違いを確認し、判断漏れを減らします。",
    minimumPlan: "pro",
    valueTheme: "trust",
  },
  {
    key: "advanced_permissions",
    label: "権限管理",
    description: "閲覧、編集、管理操作を役割ごとに分けて運用します。",
    minimumPlan: "pro",
    valueTheme: "trust",
  },
  {
    key: "branch_ledgers",
    label: "拠点別台帳",
    description: "施設、店舗、テナントを上位拠点に紐づけ、台帳を拠点別に整理します。",
    minimumPlan: "pro",
    valueTheme: "trust",
  },
  {
    key: "priority_processing",
    label: "優先処理",
    description: "期限切れ、期限接近、注意点ありの書類とタスクを優先表示します。",
    minimumPlan: "pro",
    valueTheme: "trust",
  },
  {
    key: "document_templates",
    label: "文書分類テンプレ",
    description: "行政通知、契約更新、点検報告などの分類ルールを設計します。",
    minimumPlan: "enterprise",
    valueTheme: "embedded",
  },
  {
    key: "api_webhooks",
    label: "API/Webhook",
    description: "既存システムへ書類、タスク、通知結果を連携します。",
    minimumPlan: "enterprise",
    valueTheme: "embedded",
  },
  {
    key: "onboarding_support",
    label: "初期設定支援",
    description: "書類分類、通知ルール、台帳項目の設計から支援します。",
    minimumPlan: "enterprise",
    valueTheme: "embedded",
  },
  {
    key: "custom_rules",
    label: "運用ルール設計",
    description: "会社ごとの承認、通知、分類ルールに合わせて運用を固めます。",
    minimumPlan: "enterprise",
    valueTheme: "embedded",
  },
  {
    key: "priority_support",
    label: "優先サポート",
    description: "運用停止を避けるため、優先的なサポートを提供します。",
    minimumPlan: "enterprise",
    valueTheme: "embedded",
  },
];

export function normalizePlanCode(planCode: string): PlanCode {
  return PLAN_CATALOG.some((plan) => plan.code === planCode)
    ? (planCode as PlanCode)
    : "personal";
}

export function canUseFeature(planCode: string, featureKey: FeatureKey) {
  const plan = normalizePlanCode(planCode);
  const feature = FEATURE_GATES.find((item) => item.key === featureKey);
  if (!feature) {
    return false;
  }
  return PLAN_RANK[plan] >= PLAN_RANK[feature.minimumPlan];
}

export function requireFeatureAccess(planCode: string, featureKey: FeatureKey) {
  const feature = FEATURE_GATES.find((item) => item.key === featureKey);
  if (!feature) {
    throw new ApiError(500, `Unknown feature gate: ${featureKey}`);
  }
  if (canUseFeature(planCode, featureKey)) {
    return feature;
  }

  const requiredPlan = getPlanCatalogItem(feature.minimumPlan);
  throw new ApiError(
    402,
    `${feature.label}は${requiredPlan.name}プラン以上で利用できます。`
  );
}

export function getFeatureAvailability(planCode: string): FeatureAvailability[] {
  const plan = normalizePlanCode(planCode);
  return FEATURE_GATES.map((feature) => ({
    ...feature,
    available: PLAN_RANK[plan] >= PLAN_RANK[feature.minimumPlan],
    requiredPlanName: getPlanCatalogItem(feature.minimumPlan).name,
  }));
}

export function getLockedFeatures(planCode: string) {
  return getFeatureAvailability(planCode).filter((feature) => !feature.available);
}

export function getPlanRank(planCode: string) {
  return PLAN_RANK[normalizePlanCode(planCode)];
}
