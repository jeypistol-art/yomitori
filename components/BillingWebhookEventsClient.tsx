"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";

type WebhookEvent = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
};

type WebhookEventsPayload = {
  summary: {
    total_count: number;
    failed_count: number;
    pending_count: number;
    latest_created_at: string | null;
  };
  events: WebhookEvent[];
};

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) {
    const error = new Error(payload.error || "Request failed");
    error.name = String(response.status);
    throw error;
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

function eventLabel(eventType: string) {
  const labels: Record<string, string> = {
    "checkout.session.completed": "決済完了",
    "checkout.session.async_payment_succeeded": "非同期決済成功",
    "checkout.session.async_payment_failed": "非同期決済失敗",
    "checkout.session.expired": "決済期限切れ",
    "customer.subscription.created": "契約作成",
    "customer.subscription.updated": "契約更新",
    "customer.subscription.deleted": "契約削除",
    "invoice.payment_succeeded": "請求支払い成功",
    "invoice.payment_failed": "請求支払い失敗",
  };
  return labels[eventType] ?? eventType;
}

export default function BillingWebhookEventsClient() {
  const [payload, setPayload] = useState<WebhookEventsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [forbidden, setForbidden] = useState(false);
  const [retryingId, setRetryingId] = useState("");
  const [notice, setNotice] = useState("");

  async function loadEvents() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const data = await fetchJson<WebhookEventsPayload>("/api/billing/webhook-events");
      setPayload(data);
      setForbidden(false);
    } catch (err) {
      if (err instanceof Error && err.name === "403") {
        setForbidden(true);
        return;
      }
      setError(err instanceof Error ? err.message : "Webhookイベントを読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function retryEvent(eventId: string) {
    setRetryingId(eventId);
    setError("");
    setNotice("");
    try {
      await fetchJson<{ retried: boolean; already_processed: boolean }>(
        "/api/billing/webhook-events/retry",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ event_id: eventId }),
        }
      );
      await loadEvents();
      setNotice("Webhookイベントを再処理しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Webhookイベントを再処理できませんでした");
    } finally {
      setRetryingId("");
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  if (forbidden) {
    return null;
  }

  const hasFailure = (payload?.summary.failed_count ?? 0) > 0;
  const hasPending = (payload?.summary.pending_count ?? 0) > 0;

  return (
    <section className="border border-[#d9ded3] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
        <div>
          <p className="text-sm font-bold text-[#2f5d50]">Stripe Webhook</p>
          <h2 className="mt-1 text-xl font-bold">決済イベント監視</h2>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          disabled={loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#d9ded3] text-[#2f5d50] disabled:opacity-60"
          aria-label="Webhookイベントを再読み込み"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </button>
      </div>
      <div className="space-y-4 p-5">
        {loading && !payload ? (
          <p className="text-sm font-semibold text-[#6b7280]">
            決済イベントを読み込み中
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

        {payload ? (
          <>
            <div
              className={
                hasFailure
                  ? "border border-[#f1c9c3] bg-[#fff5f2] px-3 py-2 text-sm font-semibold text-[#b42318]"
                  : hasPending
                    ? "border border-[#f0d6a8] bg-[#fff8eb] px-3 py-2 text-sm font-semibold text-[#9a5b13]"
                    : "border border-[#cde5d5] bg-[#f1faf4] px-3 py-2 text-sm font-semibold text-[#2f5d50]"
              }
            >
              {hasFailure
                ? `処理失敗が${payload.summary.failed_count}件あります。`
                : hasPending
                  ? `未処理イベントが${payload.summary.pending_count}件あります。`
                  : "直近の決済イベントは正常に処理されています。"}
            </div>

            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="border border-[#e1e6dc] p-2">
                <dt className="text-xs font-bold text-[#6b7280]">全件</dt>
                <dd className="mt-1 font-bold">{payload.summary.total_count}</dd>
              </div>
              <div className="border border-[#e1e6dc] p-2">
                <dt className="text-xs font-bold text-[#6b7280]">失敗</dt>
                <dd className="mt-1 font-bold">{payload.summary.failed_count}</dd>
              </div>
              <div className="border border-[#e1e6dc] p-2">
                <dt className="text-xs font-bold text-[#6b7280]">未処理</dt>
                <dd className="mt-1 font-bold">{payload.summary.pending_count}</dd>
              </div>
            </dl>

            <div className="space-y-2">
              {payload.events.length === 0 ? (
                <p className="text-sm font-semibold text-[#6b7280]">
                  この組織に紐づくWebhookイベントはまだありません。
                </p>
              ) : (
                payload.events.map((event) => {
                  const failed = Boolean(event.error_message);
                  return (
                    <div key={event.id} className="border border-[#e1e6dc] p-3">
                      <div className="flex items-start gap-2">
                        {failed ? (
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#b42318]" />
                        ) : (
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#2f5d50]" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">
                            {eventLabel(event.event_type)}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                            {formatDateTime(event.created_at)}
                            {event.processed_at ? " / 処理済み" : " / 未処理"}
                          </p>
                          {event.error_message ? (
                            <p className="mt-2 line-clamp-2 text-xs font-semibold text-[#b42318]">
                              {event.error_message}
                            </p>
                          ) : null}
                          {failed ? (
                            <button
                              type="button"
                              onClick={() => retryEvent(event.id)}
                              disabled={retryingId === event.id}
                              className="mt-3 inline-flex h-8 items-center gap-2 rounded-md border border-[#f1c9c3] px-3 text-xs font-bold text-[#b42318] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <RefreshCw
                                className={
                                  retryingId === event.id
                                    ? "h-3.5 w-3.5 animate-spin"
                                    : "h-3.5 w-3.5"
                                }
                              />
                              {retryingId === event.id ? "再処理中" : "再処理"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
