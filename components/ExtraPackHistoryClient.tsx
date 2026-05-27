"use client";

import { useEffect, useState } from "react";
import { PackagePlus, RefreshCw } from "lucide-react";

type ExtraPackHistoryItem = {
  id: string;
  pack_code: string;
  pack_name: string;
  purchased_count: number;
  price_yen: number;
  purchased_at: string;
  period_start: string;
  period_end: string;
};

type ExtraPackHistoryPayload = {
  summary: {
    total_count: number;
    total_purchased_count: number;
    total_price_yen: number;
    current_period_purchased_count: number;
  };
  items: ExtraPackHistoryItem[];
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
    year: "numeric",
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

function formatYen(value: number) {
  return `${value.toLocaleString("ja-JP")}円`;
}

export default function ExtraPackHistoryClient() {
  const [payload, setPayload] = useState<ExtraPackHistoryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHistory() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson<ExtraPackHistoryPayload>("/api/billing/extra-packs");
      setPayload(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加パック履歴を読み込めませんでした");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

  return (
    <section className="border border-[#d9ded3] bg-white">
      <div className="flex items-start justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
        <div>
          <p className="text-sm font-bold text-[#2f5d50]">Extra Pack History</p>
          <h2 className="mt-1 text-xl font-bold">追加パック購入履歴</h2>
        </div>
        <button
          type="button"
          onClick={loadHistory}
          disabled={loading}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[#d9ded3] text-[#2f5d50] disabled:opacity-60"
          aria-label="追加パック履歴を再読み込み"
        >
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </button>
      </div>
      <div className="space-y-4 p-5">
        {loading && !payload ? (
          <p className="text-sm font-semibold text-[#6b7280]">
            追加パック履歴を読み込み中
          </p>
        ) : null}

        {error ? (
          <p className="border border-[#f1c9c3] bg-[#fff5f2] px-3 py-2 text-sm font-semibold text-[#b42318]">
            {error}
          </p>
        ) : null}

        {payload ? (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center text-sm">
              <div className="border border-[#e1e6dc] p-2">
                <dt className="text-xs font-bold text-[#6b7280]">今月反映</dt>
                <dd className="mt-1 font-bold">
                  {payload.summary.current_period_purchased_count}件
                </dd>
              </div>
              <div className="border border-[#e1e6dc] p-2">
                <dt className="text-xs font-bold text-[#6b7280]">累計件数</dt>
                <dd className="mt-1 font-bold">
                  {payload.summary.total_purchased_count}件
                </dd>
              </div>
              <div className="border border-[#e1e6dc] p-2">
                <dt className="text-xs font-bold text-[#6b7280]">累計金額</dt>
                <dd className="mt-1 font-bold">
                  {formatYen(payload.summary.total_price_yen)}
                </dd>
              </div>
            </dl>

            <div className="space-y-2">
              {payload.items.length === 0 ? (
                <p className="text-sm font-semibold text-[#6b7280]">
                  追加パックの購入履歴はまだありません。
                </p>
              ) : (
                payload.items.map((item) => (
                  <div key={item.id} className="border border-[#e1e6dc] p-3">
                    <div className="flex items-start gap-2">
                      <PackagePlus className="mt-0.5 h-4 w-4 shrink-0 text-[#2f5d50]" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <p className="text-sm font-bold">{item.pack_name}</p>
                          <p className="shrink-0 text-sm font-bold text-[#2f5d50]">
                            {formatYen(item.price_yen)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                          {item.purchased_count}件追加 / {formatDateTime(item.purchased_at)}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                          対象期間: {formatDate(item.period_start)} -{" "}
                          {formatDate(item.period_end)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}
