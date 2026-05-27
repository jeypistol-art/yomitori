"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, RefreshCw, Save } from "lucide-react";

type BillingProfile = {
  id: string;
  name: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  updated_at: string;
  can_edit: boolean;
};

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload.data as T;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "未記録";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BillingProfileClient() {
  const router = useRouter();
  const [profile, setProfile] = useState<BillingProfile | null>(null);
  const [name, setName] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadProfile() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchJson<BillingProfile>("/api/billing/profile");
      setProfile(data);
      setName(data.name);
      setBillingEmail(data.billing_email ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "請求先情報を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchJson<BillingProfile>("/api/billing/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          billing_email: billingEmail,
        }),
      });
      setProfile(data);
      setName(data.name);
      setBillingEmail(data.billing_email ?? "");
      setNotice(
        data.stripe_customer_id
          ? "請求先情報を保存し、Stripe顧客情報も同期しました。"
          : "請求先情報を保存しました。"
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "請求先情報を保存できませんでした");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  const canEdit = Boolean(profile?.can_edit);

  return (
    <section className="border border-[#d9ded3] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
        <div>
          <p className="text-sm font-bold text-[#2f5d50]">Billing Profile</p>
          <h2 className="mt-1 text-xl font-bold">請求先情報</h2>
        </div>
        <button
          type="button"
          onClick={loadProfile}
          disabled={loading || saving}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#d9ded3] text-[#2f5d50] disabled:opacity-60"
          aria-label="請求先情報を再読み込み"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </button>
      </div>
      <form onSubmit={saveProfile} className="space-y-4 p-5">
        {loading && !profile ? (
          <p className="text-sm font-semibold text-[#6b7280]">
            請求先情報を読み込み中
          </p>
        ) : null}

        {error ? (
          <p className="border border-[#f1c9c3] bg-[#fff5f2] px-3 py-2 text-sm font-semibold text-[#b42318]">
            {error}
          </p>
        ) : null}

        {notice ? (
          <p className="border border-[#cde5d5] bg-[#f1faf4] px-3 py-2 text-sm font-semibold text-[#2f5d50]">
            {notice}
          </p>
        ) : null}

        <div className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-[#4b5563]">会社名・組織名</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canEdit || loading || saving}
              className="mt-1 h-10 w-full rounded-md border border-[#d9ded3] px-3 text-sm font-semibold outline-none focus:border-[#2f5d50] disabled:bg-[#f3f4f6] disabled:text-[#6b7280]"
              maxLength={120}
            />
          </label>

          <label className="block">
            <span className="text-sm font-bold text-[#4b5563]">請求先メール</span>
            <input
              value={billingEmail}
              onChange={(event) => setBillingEmail(event.target.value)}
              disabled={!canEdit || loading || saving}
              type="email"
              className="mt-1 h-10 w-full rounded-md border border-[#d9ded3] px-3 text-sm font-semibold outline-none focus:border-[#2f5d50] disabled:bg-[#f3f4f6] disabled:text-[#6b7280]"
              maxLength={254}
            />
          </label>
        </div>

        <div className="border border-[#e1e6dc] bg-[#fbfcf8] p-3 text-sm">
          <div className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f5d50]" />
            <div>
              <p className="font-bold text-[#1f2933]">
                Stripe顧客ID: {profile?.stripe_customer_id ?? "未作成"}
              </p>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                最終更新: {formatDateTime(profile?.updated_at ?? null)}
              </p>
            </div>
          </div>
        </div>

        {canEdit ? (
          <button
            type="submit"
            disabled={saving || loading}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-3 text-sm font-bold text-white hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "保存中" : "請求先情報を保存"}
          </button>
        ) : (
          <p className="border border-[#e1e6dc] bg-[#fbfcf8] px-3 py-2 text-sm font-semibold text-[#6b7280]">
            請求先情報の編集はowner/adminのみ可能です。
          </p>
        )}
      </form>
    </section>
  );
}
