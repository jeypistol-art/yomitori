export type PlanCatalogItem = {
  code: "personal" | "business" | "pro" | "enterprise";
  name: string;
  priceLabel: string;
  audience: string;
  includedDocuments: number;
  description: string;
  features: string[];
};

export type ExtraPackCatalogItem = {
  code: "extra_10" | "extra_30";
  name: string;
  quantity: number;
  priceYen: number;
  priceLabel: string;
};

export const PLAN_CATALOG: PlanCatalogItem[] = [
  {
    code: "personal",
    name: "Personal",
    priceLabel: "2,980円/月",
    audience: "個人・フリーランス",
    includedDocuments: 50,
    description: "個人で書類の要約、期限抽出、タスク化を回すための基本プラン。",
    features: ["要約", "期限抽出", "個人タスク", "カレンダー連携"],
  },
  {
    code: "business",
    name: "Business",
    priceLabel: "9,800円/月",
    audience: "小規模事業者",
    includedDocuments: 300,
    description: "複数人で担当者割当と共有台帳を使う管理会社向けの標準プラン。",
    features: ["複数ユーザー", "担当者割当", "共有台帳", "月次未処理一覧"],
  },
  {
    code: "pro",
    name: "Pro",
    priceLabel: "19,800円/月",
    audience: "複数拠点の管理会社",
    includedDocuments: 500,
    description: "権限、監査、差分確認まで含めて組織運用するための上位プラン。",
    features: ["権限管理", "拠点別台帳", "監査ログ", "過去書類との差分", "優先処理"],
  },
  {
    code: "enterprise",
    name: "Enterprise",
    priceLabel: "49,800円/月〜",
    audience: "士業法人・施設運営・多店舗",
    includedDocuments: 1000,
    description: "導入支援、分類テンプレ、API連携まで含めて業務設計するプラン。",
    features: [
      "初期設定支援",
      "文書分類テンプレ",
      "運用ルール設計",
      "API/Webhook",
      "優先サポート",
    ],
  },
];

export const EXTRA_PACK_CATALOG: ExtraPackCatalogItem[] = [
  {
    code: "extra_10",
    name: "追加10件パック",
    quantity: 10,
    priceYen: 980,
    priceLabel: "980円",
  },
  {
    code: "extra_30",
    name: "追加30件パック",
    quantity: 30,
    priceYen: 1500,
    priceLabel: "1,500円",
  },
];

export function getPlanCatalogItem(planCode: string) {
  return PLAN_CATALOG.find((plan) => plan.code === planCode) ?? PLAN_CATALOG[0];
}

export function getPlanIncludedCount(planCode: string) {
  return getPlanCatalogItem(planCode).includedDocuments;
}
