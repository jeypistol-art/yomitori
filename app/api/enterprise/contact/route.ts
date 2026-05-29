import { NextResponse } from "next/server";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import {
  enterpriseContactFormEntries,
  getEnterpriseContactFormActionUrl,
} from "@/lib/enterprise_contact";
import {
  enterpriseConsultationTopicOptions,
  enterpriseDesiredTimingOptions,
  enterpriseIndustryOptions,
  enterpriseManagementScaleOptions,
  enterpriseMonthlyDocumentOptions,
  enterprisePreferredContactOptions,
  hasEnterpriseContactOption,
} from "@/lib/enterprise_contact_options";

export const dynamic = "force-dynamic";

type ContactRequest = {
  companyName?: unknown;
  name?: unknown;
  email?: unknown;
  industry?: unknown;
  managementScale?: unknown;
  monthlyDocuments?: unknown;
  consultationTopics?: unknown;
  currentPain?: unknown;
  preferredContact?: unknown;
  desiredTiming?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function requireText(value: unknown, fieldName: string) {
  const normalized = text(value);
  if (!normalized) {
    throw new ApiError(400, `${fieldName}を入力してください。`);
  }
  return normalized;
}

function requireOption(
  value: unknown,
  options: readonly string[],
  fieldName: string
) {
  const normalized = requireText(value, fieldName);
  if (!options.includes(normalized)) {
    throw new ApiError(400, `${fieldName}の値が正しくありません。`);
  }
  return normalized;
}

function optionalOption(
  value: unknown,
  options: readonly string[],
  fieldName: string
) {
  const normalized = text(value);
  if (!normalized) {
    return "";
  }
  if (!options.includes(normalized)) {
    throw new ApiError(400, `${fieldName}の値が正しくありません。`);
  }
  return normalized;
}

function validateEmail(value: unknown) {
  const email = requireText(value, "メールアドレス");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "メールアドレスの形式が正しくありません。");
  }
  return email;
}

function validateTopics(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ApiError(400, "相談したい内容を1つ以上選択してください。");
  }

  const topics = value
    .map((item) => text(item))
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
  if (topics.length === 0) {
    throw new ApiError(400, "相談したい内容を1つ以上選択してください。");
  }
  if (
    topics.some(
      (topic) =>
        !hasEnterpriseContactOption(enterpriseConsultationTopicOptions, topic)
    )
  ) {
    throw new ApiError(400, "相談したい内容の値が正しくありません。");
  }
  return topics;
}

async function readJson(request: Request): Promise<ContactRequest> {
  return request.json().catch(() => ({}));
}

export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const companyName = requireText(body.companyName, "会社名・屋号");
    const name = requireText(body.name, "お名前");
    const email = validateEmail(body.email);
    const industry = requireOption(
      body.industry,
      enterpriseIndustryOptions,
      "業種"
    );
    const managementScale = requireOption(
      body.managementScale,
      enterpriseManagementScaleOptions,
      "管理対象の規模"
    );
    const monthlyDocuments = requireOption(
      body.monthlyDocuments,
      enterpriseMonthlyDocumentOptions,
      "毎月扱う書類数"
    );
    const consultationTopics = validateTopics(body.consultationTopics);
    const currentPain = text(body.currentPain).slice(0, 3000);
    const preferredContact = optionalOption(
      body.preferredContact,
      enterprisePreferredContactOptions,
      "希望する連絡方法"
    );
    const desiredTiming = optionalOption(
      body.desiredTiming,
      enterpriseDesiredTimingOptions,
      "希望時期"
    );

    const entries = enterpriseContactFormEntries;
    const formBody = new URLSearchParams();
    formBody.set(entries.companyName, companyName);
    formBody.set(entries.name, name);
    formBody.set(entries.email, email);
    formBody.set(entries.industry, industry);
    formBody.set(entries.managementScale, managementScale);
    formBody.set(entries.monthlyDocuments, monthlyDocuments);
    consultationTopics.forEach((topic) => {
      formBody.append(entries.consultationTopics, topic);
    });
    if (currentPain) {
      formBody.set(entries.currentPain, "__other_option__");
      formBody.set(`${entries.currentPain}.other_option_response`, currentPain);
    }
    if (preferredContact && preferredContact !== "メール") {
      formBody.set(entries.preferredContact, preferredContact);
    }
    if (desiredTiming) {
      formBody.set(entries.desiredTiming, desiredTiming);
    }

    const response = await fetch(getEnterpriseContactFormActionUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: formBody,
      redirect: "manual",
    });

    if (!response.ok) {
      console.error(
        `Enterprise contact form failed: Google Forms returned ${response.status}`
      );
      throw new ApiError(
        502,
        "導入相談フォームの送信に失敗しました。時間を置いて再度お試しください。"
      );
    }

    return NextResponse.json({ data: { submitted: true } });
  } catch (error) {
    return jsonApiError(error);
  }
}
