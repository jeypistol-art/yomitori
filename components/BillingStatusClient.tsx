"use client";

import { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { getPlanCatalogItem } from "@/lib/usage_catalog";

type BillingSubscription = {
  organization_plan_code: string;
  subscription_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  plan_code: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  cancel_at: string | null;
  canceled_at: string | null;
  scheduled_cancel_at: string | null;
  pending_update: PendingBillingUpdate | null;
  stripe_sync_warning: string | null;
  updated_at: string | null;
  billing_access?: {
    document_processing?: BillingAccess;
    extra_pack_purchase?: BillingAccess;
  };
};

type PendingBillingUpdate = {
  source: "pending_update" | "subscription_schedule";
  price_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  effective_at: string | null;
  expires_at: string | null;
};

type BillingAccess = {
  allowed: boolean;
  status: string;
  label: string;
  severity: "ok" | "warning" | "blocked";
  message: string;
};

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

const statusLabels: Record<string, { label: string; className: string; note: string }> = {
  active: {
    label: "有効",
    className: "bg-[#f1faf4] text-[#2f5d50]",
    note: "請求と利用枠は正常に有効です。",
  },
  trialing: {
    label: "トライアル",
    className: "bg-[#f1faf4] text-[#2f5d50]",
    note: "トライアル期間中です。",
  },
  past_due: {
    label: "支払い確認中",
    className: "bg-[#fff8eb] text-[#9a5b13]",
    note: "支払いに確認が必要です。Stripeで支払い方法を確認してください。",
  },
  incomplete: {
    label: "未完了",
    className: "bg-[#fff8eb] text-[#9a5b13]",
    note: "初回支払いが完了していません。",
  },
  canceled: {
    label: "解約済み",
    className: "bg-[#fff5f2] text-[#b42318]",
    note: "サブスクリプションは解約済みです。",
  },
  unpaid: {
    label: "未払い",
    className: "bg-[#fff5f2] text-[#b42318]",
    note: "支払いが完了していません。",
  },
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
    return "未設定";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BillingStatusClient() {
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadSubscription() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<BillingSubscription | null>("/api/billing/subscription");
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "契約状態を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function syncSubscription() {
    setSyncing(true);
    setError("");
    try {
      await fetchJson<{ synced: boolean }>("/api/billing/sync-subscription", {
        method: "POST",
      });
      await loadSubscription();
    } catch (err) {
      setError(err instanceof Error ? err.message : "契約状態を同期できませんでした");
    } finally {
      setSyncing(false);
    }
  }

  async function openPortal() {
    setPortalLoading(true);
    setError("");
    try {
      const data = await fetchJson<{ portal_url: string }>("/api/billing/portal", {
        method: "POST",
      });
      window.location.assign(data.portal_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "請求管理画面を開けませんでした");
      setPortalLoading(false);
    }
  }

  useEffect(() => {
    loadSubscription();
  }, []);

  const planCode = subscription?.plan_code ?? subscription?.organization_plan_code ?? "personal";
  const plan = getPlanCatalogItem(planCode);
  const status = subscription?.status ?? "not_started";
  const statusInfo =
    statusLabels[status] ?? {
      label: subscription?.stripe_subscription_id ? status : "未契約",
      className: "bg-[#edf2e8] text-[#4b5563]",
      note: subscription?.stripe_subscription_id
        ? "Stripeの契約状態を確認してください。"
        : "まだStripeサブスクリプションはありません。",
    };
  const documentProcessingAccess = subscription?.billing_access?.document_processing;
  const extraPackAccess = subscription?.billing_access?.extra_pack_purchase;
  const blockedAccess = [documentProcessingAccess, extraPackAccess].find(
    (access) => access && !access.allowed
  );
  const pendingPlanName =
    subscription?.pending_update?.plan_name ??
    (subscription?.pending_update?.plan_code
      ? getPlanCatalogItem(subscription.pending_update.plan_code).name
      : null);
  const scheduledCancelAt =
    subscription?.scheduled_cancel_at ??
    (subscription?.cancel_at_period_end ? subscription.current_period_end : null);

  return (
    <section className="border border-[#d9ded3] bg-white">
      <div className="border-b border-[#e5e9df] px-5 py-4">
        <p className="text-sm font-bold text-[#2f5d50]">Billing</p>
        <h2 className="mt-1 text-xl font-bold">契約状態</h2>
      </div>
      <div className="space-y-4 p-5">
        {loading ? (
          <p className="text-sm font-semibold text-[#6b7280]">契約状態を読み込み中</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[#6b7280]">現在の契約プラン</p>
                <p className="mt-1 text-2xl font-bold">{plan.name}</p>
                <p className="mt-1 text-sm font-semibold text-[#4b5563]">
                  {plan.priceLabel}
                </p>
              </div>
              <span className={`shrink-0 rounded px-2 py-1 text-xs font-bold ${statusInfo.className}`}>
                {statusInfo.label}
              </span>
            </div>

            <div className="space-y-2">
              <p className="border border-[#e1e6dc] bg-[#fbfcf8] px-3 py-2 text-sm font-semibold text-[#4b5563]">
                {statusInfo.note}
              </p>

              {scheduledCancelAt ? (
                <p className="border border-[#f0d6a8] bg-[#fff8eb] px-3 py-2 text-sm font-semibold text-[#9a5b13]">
                  {formatDateTime(scheduledCancelAt)}
                  までは現在のプランを利用できます。期間終了後に解約されます。
                </p>
              ) : null}

              {subscription?.pending_update ? (
                <p className="border border-[#d7e6d2] bg-[#f1faf4] px-3 py-2 text-sm font-semibold text-[#2f5d50]">
                  {formatDateTime(subscription.pending_update.effective_at)}
                  に{pendingPlanName ?? "別プラン"}へ変更予定です。
                </p>
              ) : null}

              {subscription?.stripe_sync_warning ? (
                <p className="border border-[#f0d6a8] bg-[#fff8eb] px-3 py-2 text-sm font-semibold text-[#9a5b13]">
                  Stripeの最新状態を取得できませんでした。表示は最終同期時点の情報です。
                </p>
              ) : null}
            </div>

            {blockedAccess ? (
              <p
                className={
                  blockedAccess.severity === "blocked"
                    ? "border border-[#f1c9c3] bg-[#fff5f2] px-3 py-2 text-sm font-semibold text-[#b42318]"
                    : "border border-[#f0d6a8] bg-[#fff8eb] px-3 py-2 text-sm font-semibold text-[#9a5b13]"
                }
              >
                {blockedAccess.message}
              </p>
            ) : null}

            <dl className="grid gap-3 text-sm">
              <div className="border border-[#e1e6dc] p-3">
                <dt className="font-bold text-[#6b7280]">現在期間の終了</dt>
                <dd className="mt-1 font-semibold">
                  {formatDateTime(subscription?.current_period_end ?? null)}
                </dd>
              </div>
              <div className="border border-[#e1e6dc] p-3">
                <dt className="font-bold text-[#6b7280]">最終同期</dt>
                <dd className="mt-1 font-semibold">
                  {formatDateTime(subscription?.updated_at ?? null)}
                </dd>
              </div>
              <div className="border border-[#e1e6dc] p-3">
                <dt className="font-bold text-[#6b7280]">予定されている変更</dt>
                <dd className="mt-1 font-semibold">
                  {subscription?.pending_update
                    ? `${pendingPlanName ?? "別プラン"}へ変更`
                    : scheduledCancelAt
                      ? "期間終了時に解約"
                      : "なし"}
                </dd>
              </div>
            </dl>
          </>
        )}

        {error ? (
          <p className="border border-[#f1c9c3] bg-[#fff5f2] px-3 py-2 text-sm font-semibold text-[#b42318]">
            {error}
          </p>
        ) : null}

        <div className="grid gap-2">
          <button
            type="button"
            onClick={openPortal}
            disabled={portalLoading || loading || !subscription?.stripe_customer_id}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-3 text-sm font-bold text-white hover:bg-[#24483e] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <ExternalLink className="h-4 w-4" />
            {portalLoading ? "Stripeを開いています" : "請求・支払いを管理"}
          </button>
          <button
            type="button"
            onClick={syncSubscription}
            disabled={syncing || loading || !subscription?.stripe_subscription_id}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className="h-4 w-4" />
            {syncing ? "同期中" : "Stripeと同期"}
          </button>
        </div>
      </div>
    </section>
  );
}
