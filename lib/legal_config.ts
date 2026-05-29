import { EXTRA_PACK_CATALOG, PLAN_CATALOG } from "@/lib/usage_catalog";

const defaultContactEmail = "info.yomitori@morimori-labo.monster";
const defaultDisclosureText = "請求があった場合、遅滞なく開示します。";

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

export function getLegalConfig() {
  const contactEmail =
    readEnv(
      "LEGAL_CONTACT_EMAIL",
      "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL",
      "NEXT_PUBLIC_ENTERPRISE_CONTACT_EMAIL"
    ) ||
    defaultContactEmail;

  return {
    serviceName: "YOMITORI DocuTask",
    tagline: "書類を、要約・タスク・リマインド・証跡へ。",
    lastUpdated: readEnv("LEGAL_LAST_UPDATED") || "2026年5月29日",
    businessName:
      readEnv("LEGAL_BUSINESS_NAME", "NEXT_PUBLIC_LEGAL_BUSINESS_NAME") ||
      "YOMITORI DocuTask 運営事務局",
    representativeName:
      readEnv("LEGAL_REPRESENTATIVE_NAME") || defaultDisclosureText,
    address: readEnv("LEGAL_ADDRESS") || defaultDisclosureText,
    phone: readEnv("LEGAL_PHONE") || defaultDisclosureText,
    contactEmail,
    supportHours:
      readEnv("LEGAL_SUPPORT_HOURS") || "平日 10:00〜17:00（土日祝日を除く）",
    plans: PLAN_CATALOG,
    extraPacks: EXTRA_PACK_CATALOG,
  };
}
