"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FileText, PackagePlus, RefreshCw, RotateCcw } from "lucide-react";

type UsageEvent = {
  id: string;
  event_type: "consume" | "purchase_extra" | "refund" | string;
  quantity: number;
  reason: string | null;
  document_id: string | null;
  document_title: string | null;
  actor_name: string | null;
  actor_email: string | null;
  stripe_payment_intent_id: string | null;
  period_start: string;
  period_end: string;
  created_at: string;
};

type UsageEventsPayload = {
  summary: {
    consumed_current_period: number;
    purchased_current_period: number;
    refunded_current_period: number;
  };
  events: UsageEvent[];
};

type ApiResponse<T> = {
  data?: T;
  error?: string;
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
  if (!response.ok) {
    throw new Error(payload.error || "Request failed");
  }
  return payload.data as T;
}

function formatDateTime(value: string) {
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

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00+09:00`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
  });
}

function eventView(event: UsageEvent) {
  if (event.event_type === "purchase_extra") {
    return {
      label: "追加パック",
      value: `+${event.quantity}件`,
      className: "text-[#2f5d50]",
      Icon: PackagePlus,
    };
  }
  if (event.event_type === "refund") {
    return {
      label: "返却",
      value: `+${event.quantity}件`,
      className: "text-[#2f5d50]",
      Icon: RotateCcw,
    };
  }
  return {
    label: "書類登録",
    value: `-${event.quantity}件`,
    className: "text-[#9a5b13]",
    Icon: FileText,
  };
}

function reasonLabel(reason: string | null) {
  const labels: Record<string, string> = {
    document_registration: "書類登録",
  };
  return reason ? labels[reason] ?? reason : "理由未記録";
}

export default function UsageEventLedgerClient() {
  const [payload, setPayload] = useState<UsageEventsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadEvents() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<UsageEventsPayload>("/api/usage/events");
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "利用履歴を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  return (
    <section className="border border-[#d9ded3] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
        <div>
          <p className="text-sm font-bold text-[#2f5d50]">Usage Ledger</p>
          <h2 className="mt-1 text-xl font-bold">利用枠の増減履歴</h2>
        </div>
        <button
          type="button"
          onClick={loadEvents}
          disabled={loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#d9ded3] text-[#2f5d50] disabled:opacity-60"
          aria-label="利用履歴を再読み込み"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </button>
      </div>
      <div className="space-y-4 p-5">
        {loading && !payload ? (
          <p className="text-sm font-semibold text-[#6b7280]">
            利用履歴を読み込み中
          </p>
        ) : null}

        {error ? (
          <p className="border border-[#f1c9c3] bg-[#fff5f2] px-3 py-2 text-sm font-semibold text-[#b42318]">
            {error}
          </p>
        ) : null}

        {payload ? (
          <>
            <dl className="grid gap-2 text-center text-sm sm:grid-cols-3">
              <div className="border border-[#e1e6dc] p-3">
                <dt className="text-xs font-bold text-[#6b7280]">今月消費</dt>
                <dd className="mt-1 text-lg font-bold">
                  {payload.summary.consumed_current_period}件
                </dd>
              </div>
              <div className="border border-[#e1e6dc] p-3">
                <dt className="text-xs font-bold text-[#6b7280]">今月追加</dt>
                <dd className="mt-1 text-lg font-bold text-[#2f5d50]">
                  {payload.summary.purchased_current_period}件
                </dd>
              </div>
              <div className="border border-[#e1e6dc] p-3">
                <dt className="text-xs font-bold text-[#6b7280]">今月返却</dt>
                <dd className="mt-1 text-lg font-bold">
                  {payload.summary.refunded_current_period}件
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              {payload.events.length === 0 ? (
                <p className="text-sm font-semibold text-[#6b7280]">
                  利用履歴はまだありません。
                </p>
              ) : (
                payload.events.map((event) => {
                  const view = eventView(event);
                  const Icon = view.Icon;
                  return (
                    <div key={event.id} className="border border-[#e1e6dc] p-3">
                      <div className="flex items-start gap-3">
                        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${view.className}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-bold">{view.label}</p>
                              <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                                {formatDateTime(event.created_at)} /{" "}
                                {formatDate(event.period_start)} -{" "}
                                {formatDate(event.period_end)}
                              </p>
                            </div>
                            <p className={`text-lg font-bold ${view.className}`}>
                              {view.value}
                            </p>
                          </div>

                          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-[#6b7280]">
                            <span>{reasonLabel(event.reason)}</span>
                            <span>
                              実行者: {event.actor_name ?? event.actor_email ?? "システム"}
                            </span>
                          </div>

                          {event.document_id ? (
                            <Link
                              href={`/documents/${event.document_id}/review`}
                              className="mt-2 inline-flex text-xs font-bold text-[#2f5d50]"
                            >
                              {event.document_title ?? "対象書類を開く"}
                            </Link>
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
