export const enterpriseIndustryOptions = [
  "不動産管理",
  "施設管理",
  "店舗運営",
  "士業",
  "その他",
] as const;

export const enterpriseManagementScaleOptions = [
  "1〜5拠点",
  "6〜20拠点",
  "21〜50拠点",
  "51拠点以上",
] as const;

export const enterpriseMonthlyDocumentOptions = [
  "〜100件",
  "101〜300件",
  "301〜500件",
  "501〜1000件",
  "1000件以上",
] as const;

export const enterpriseConsultationTopicOptions = [
  "文書分類テンプレ",
  "初期設定支援",
  "運用ルール設計",
  "API・Webhook連携",
  "優先サポート",
  "料金相談",
] as const;

export const enterprisePreferredContactOptions = [
  "メール",
  "オンライン面談",
  "資料が欲しい",
] as const;

export const enterpriseDesiredTimingOptions = [
  "すぐ相談したい",
  "1か月以内",
  "3か月以内",
  "情報収集中",
] as const;

export function hasEnterpriseContactOption(
  options: readonly string[],
  value: string
) {
  return options.includes(value);
}
