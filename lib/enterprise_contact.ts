const defaultContactEmail = "info@morimori-labo.monster";
const defaultContactFormUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSeFxDtMVmjNXNBSzGCdXe4d4gz2dxV9JWAlkTPVhfvbpvPKuw/viewform?usp=publish-editor";
const enterpriseContactPageHref = "/enterprise/contact";

type EnterpriseContactPrefill = {
  companyName?: string | null;
  email?: string | null;
  name?: string | null;
};

const googleFormEntries = {
  companyName: "entry.1015888782",
  name: "entry.1623621589",
  email: "entry.701789915",
};

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

export function getEnterpriseContactFormUrl(prefill: EnterpriseContactPrefill = {}) {
  const explicitUrl =
    process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_FORM_URL?.trim() ||
    process.env.ENTERPRISE_CONTACT_FORM_URL?.trim() ||
    process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_URL?.trim() ||
    process.env.ENTERPRISE_CONTACT_URL?.trim() ||
    defaultContactFormUrl;
  if (explicitUrl) {
    return buildGoogleFormUrl(explicitUrl, prefill);
  }
  return null;
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

function buildGoogleFormUrl(value: string, prefill: EnterpriseContactPrefill) {
  const normalized = normalizeGoogleFormUrl(value);
  try {
    const url = new URL(normalized);
    if (!isGoogleFormUrl(url)) {
      return normalized;
    }
    addPrefill(url, googleFormEntries.companyName, prefill.companyName);
    addPrefill(url, googleFormEntries.name, prefill.name);
    addPrefill(url, googleFormEntries.email, prefill.email);
    return url.toString();
  } catch {
    return normalized;
  }
}

function addPrefill(url: URL, entryId: string, value: string | null | undefined) {
  const trimmed = value?.trim();
  if (trimmed) {
    url.searchParams.set(entryId, trimmed);
  }
}

function isGoogleFormUrl(url: URL) {
  return url.hostname === "docs.google.com" && url.pathname.includes("/forms/");
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
