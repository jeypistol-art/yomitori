const defaultContactEmail = "info@morimori-labo.monster";
const defaultContactFormUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSeFxDtMVmjNXNBSzGCdXe4d4gz2dxV9JWAlkTPVhfvbpvPKuw/viewform?usp=publish-editor";
const enterpriseContactPageHref = "/enterprise/contact";

export const enterpriseContactFormEntries = {
  companyName: "entry.1015888782",
  name: "entry.1623621589",
  email: "entry.701789915",
  industry: "entry.225021138",
  managementScale: "entry.1068659254",
  monthlyDocuments: "entry.1568853063",
  consultationTopics: "entry.410062933",
  currentPain: "entry.947243090",
  preferredContact: "entry.1611145614",
  desiredTiming: "entry.1547328506",
};

export type EnterpriseContactFormEntries = typeof enterpriseContactFormEntries;

function extractEmail(value: string | undefined) {
  if (!value) {
    return null;
  }
  const bracketed = value.match(/<([^<>\s@]+@[^<>\s@]+\.[^<>\s@]+)>/);
  if (bracketed?.[1]) {
    return bracketed[1];
  }
  const plain = value.match(/[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/);
  return plain?.[0] ?? null;
}

export function getEnterpriseContactPageHref() {
  return enterpriseContactPageHref;
}

function getEnterpriseContactSourceUrl() {
  return (
    process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_FORM_URL?.trim() ||
    process.env.ENTERPRISE_CONTACT_FORM_URL?.trim() ||
    process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_URL?.trim() ||
    process.env.ENTERPRISE_CONTACT_URL?.trim() ||
    defaultContactFormUrl
  );
}

export function getEnterpriseContactFormActionUrl() {
  return normalizeGoogleFormActionUrl(getEnterpriseContactSourceUrl());
}

export function getEnterpriseContactFormUrl() {
  const explicitUrl =
    getEnterpriseContactSourceUrl();
  return normalizeGoogleFormUrl(explicitUrl);
}

export function getEnterpriseContactMailtoHref() {
  const contactEmail =
    process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_EMAIL?.trim() ||
    extractEmail(process.env.EMAIL_FROM) ||
    defaultContactEmail;
  const subject = encodeURIComponent("YOMITORI DocuTask Enterprise相談");
  const body = encodeURIComponent(
    [
      "YOMITORI DocuTaskのEnterprise/個別提供について相談したいです。",
      "",
      "会社名:",
      "利用人数:",
      "管理対象の拠点数:",
      "相談したい内容:",
    ].join("\n")
  );

  return `mailto:${contactEmail}?subject=${subject}&body=${body}`;
}

function isGoogleFormUrl(url: URL) {
  return url.hostname === "docs.google.com" && url.pathname.includes("/forms/");
}

function normalizeGoogleFormActionUrl(value: string) {
  try {
    const url = new URL(value);
    if (!isGoogleFormUrl(url)) {
      return value;
    }
    if (url.pathname.endsWith("/viewform")) {
      url.pathname = url.pathname.replace(/\/viewform$/, "/formResponse");
      url.search = "";
      return url.toString();
    }
    if (url.pathname.endsWith("/edit")) {
      url.pathname = url.pathname.replace(/\/edit$/, "/formResponse");
      url.search = "";
      return url.toString();
    }
    return value;
  } catch {
    return value;
  }
}

function normalizeGoogleFormUrl(value: string) {
  try {
    const url = new URL(value);
    if (
      isGoogleFormUrl(url) &&
      url.pathname.endsWith("/viewform")
    ) {
      url.searchParams.set("embedded", "true");
      return url.toString();
    }
    if (
      isGoogleFormUrl(url) &&
      url.pathname.endsWith("/edit")
    ) {
      url.pathname = url.pathname.replace(/\/edit$/, "/viewform");
      url.search = "";
      url.searchParams.set("embedded", "true");
      return url.toString();
    }
    return value;
  } catch {
    return value;
  }
}
