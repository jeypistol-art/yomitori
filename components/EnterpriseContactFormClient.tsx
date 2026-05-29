"use client";

import { useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import {
  enterpriseConsultationTopicOptions,
  enterpriseDesiredTimingOptions,
  enterpriseIndustryOptions,
  enterpriseManagementScaleOptions,
  enterpriseMonthlyDocumentOptions,
  enterprisePreferredContactOptions,
} from "@/lib/enterprise_contact_options";

type EnterpriseContactFormClientProps = {
  initialValues: {
    companyName: string;
    email: string;
    name: string;
  };
};

export default function EnterpriseContactFormClient({
  initialValues,
}: EnterpriseContactFormClientProps) {
  const [topics, setTopics] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  function toggleTopic(topic: string) {
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (topics.length === 0) {
      setError("相談したい内容を1つ以上選択してください。");
      return;
    }
    setError("");
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);
    const payload = {
      companyName: String(formData.get("companyName") ?? ""),
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      industry: String(formData.get("industry") ?? ""),
      managementScale: String(formData.get("managementScale") ?? ""),
      monthlyDocuments: String(formData.get("monthlyDocuments") ?? ""),
      consultationTopics: formData
        .getAll("consultationTopics")
        .map((value) => String(value)),
      currentPain: String(formData.get("currentPain") ?? ""),
      preferredContact: String(formData.get("preferredContact") ?? ""),
      desiredTiming: String(formData.get("desiredTiming") ?? ""),
    };

    try {
      const response = await fetch("/api/enterprise/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        setError(
          result?.error ??
            "送信に失敗しました。時間を置いて再度お試しください。"
        );
        return;
      }
      setTopics([]);
      setIsSubmitted(true);
    } catch {
      setError("送信に失敗しました。ネットワーク接続を確認してください。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSubmitted) {
    return (
      <div className="flex min-h-[520px] flex-col items-center justify-center px-6 py-12 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#edf2e8] text-[#2f5d50]">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-xl font-bold">送信しました</h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#4b5563]">
          内容を確認のうえ、メールにてご連絡します。追加で伝えたいことがある場合は、もう一度フォームを送信できます。
        </p>
        <button
          type="button"
          onClick={() => setIsSubmitted(false)}
          className="mt-6 h-10 rounded-md border border-[#d9ded3] bg-white px-4 text-sm font-bold text-[#2f5d50]"
        >
          続けて送信する
        </button>
      </div>
    );
  }

  return (
    <>
      <form
        className="space-y-6 p-5"
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <TextField
            defaultValue={initialValues.companyName}
            label="会社名・屋号"
            name="companyName"
            required
          />
          <TextField
            defaultValue={initialValues.name}
            label="お名前"
            name="name"
            required
          />
        </div>

        <TextField
          defaultValue={initialValues.email}
          label="メールアドレス"
          name="email"
          required
          type="email"
        />

        <div className="grid gap-4 md:grid-cols-3">
          <SelectField
            label="業種"
            name="industry"
            options={enterpriseIndustryOptions}
            required
          />
          <SelectField
            label="管理対象の規模"
            name="managementScale"
            options={enterpriseManagementScaleOptions}
            required
          />
          <SelectField
            label="毎月扱う書類数"
            name="monthlyDocuments"
            options={enterpriseMonthlyDocumentOptions}
            required
          />
        </div>

        <fieldset>
          <legend className="text-sm font-bold text-[#1f2933]">
            相談したい内容
          </legend>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {enterpriseConsultationTopicOptions.map((topic) => (
              <label
                key={topic}
                className="flex cursor-pointer items-center gap-3 border border-[#d9ded3] bg-[#fbfcf8] px-3 py-3 text-sm font-semibold text-[#1f2933]"
              >
                <input
                  checked={topics.includes(topic)}
                  className="h-4 w-4"
                  name="consultationTopics"
                  onChange={() => toggleTopic(topic)}
                  type="checkbox"
                  value={topic}
                />
                {topic}
              </label>
            ))}
          </div>
        </fieldset>

        <TextAreaField
          label="現在困っていること"
          name="currentPain"
          placeholder="例: 期限の見落とし、担当者への引き継ぎ、監査ログ、書類分類、拠点別管理など"
          rows={5}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <SelectField
            label="希望する連絡方法"
            name="preferredContact"
            options={enterprisePreferredContactOptions}
          />
          <SelectField
            label="希望時期"
            name="desiredTiming"
            options={enterpriseDesiredTimingOptions}
          />
        </div>

        {error ? (
          <p className="border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e5e9df] pt-5">
          <p className="max-w-xl text-xs leading-5 text-[#6b7280]">
            送信内容は導入相談への回答確認にのみ利用します。内容確認後、メールでご連絡します。
          </p>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex h-11 items-center gap-2 rounded-md bg-[#2f5d50] px-5 text-sm font-bold text-white disabled:opacity-60"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            送信する
          </button>
        </div>
      </form>
    </>
  );
}

function TextField({
  defaultValue,
  label,
  name,
  required = false,
  type = "text",
}: {
  defaultValue?: string;
  label: string;
  name: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block text-sm font-bold text-[#1f2933]">
      {label}
      <input
        defaultValue={defaultValue}
        name={name}
        required={required}
        type={type}
        className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] bg-white px-3 text-sm font-semibold outline-none focus:border-[#2f5d50]"
      />
    </label>
  );
}

function SelectField({
  label,
  name,
  options,
  required = false,
}: {
  label: string;
  name: string;
  options: readonly string[];
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-[#1f2933]">
      {label}
      <select
        className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] bg-white px-3 text-sm font-semibold outline-none focus:border-[#2f5d50]"
        defaultValue=""
        name={name}
        required={required}
      >
        <option value="" disabled>
          選択してください
        </option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextAreaField({
  label,
  name,
  placeholder,
  rows,
}: {
  label: string;
  name: string;
  placeholder?: string;
  rows: number;
}) {
  return (
    <label className="block text-sm font-bold text-[#1f2933]">
      {label}
      <textarea
        className="mt-2 w-full resize-y rounded-md border border-[#cfd6ca] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2f5d50]"
        name={name}
        placeholder={placeholder}
        rows={rows}
      />
    </label>
  );
}
