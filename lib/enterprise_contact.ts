const defaultContactEmail = "info@morimori-labo.monster";

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

export function getEnterpriseContactHref() {
  const explicitUrl =
    process.env.NEXT_PUBLIC_ENTERPRISE_CONTACT_URL?.trim() ||
    process.env.ENTERPRISE_CONTACT_URL?.trim();
  if (explicitUrl) {
    return explicitUrl;
  }

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
