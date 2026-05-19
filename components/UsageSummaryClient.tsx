"use client";

import { useEffect, useState } from "react";

type UsageSummary = {
  period_start: string;
  period_end: string;
  plan_code: string;
  included_count: number;
  purchased_extra_count: number;
  used_count: number;
  remaining_count: number;
};

type ApiItem<T> = {
  data: T;
};

const planLabels: Record<string, string> = {
  personal: "Personal",
  business: "Business",
  pro: "Pro",
  enterprise: "Enterprise",
};

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Request failed"
    );
  }
  return payload as T;
}

export default function UsageSummaryClient({ compact = false }: { compact?: boolean }) {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let canceled = false;
    fetchJson<ApiItem<UsageSummary>>("/api/usage/current")
      .then((payload) => {
        if (!canceled) {
          setUsage(payload.data);
          setError("");
        }
      })
      .catch((err) => {
        if (!canceled) {
          setError(err instanceof Error ? err.message : "利用状況を読み込めませんでした");
        }
      });
    return () => {
      canceled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
        {error}
      </div>
    );
  }

  if (!usage) {
    return (
      <div className="border border-[#d9ded3] bg-white px-4 py-3 text-sm text-[#6b7280]">
        利用状況を読み込み中
      </div>
    );
  }

  const limit = usage.included_count + usage.purchased_extra_count;
  const percentage = limit > 0 ? Math.min(100, Math.round((usage.used_count / limit) * 100)) : 0;

  return (
    <section className="border border-[#d9ded3] bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-[#2f5d50]">今月の利用状況</p>
          <h2 className={compact ? "mt-1 text-lg font-bold" : "mt-1 text-xl font-bold"}>
            {usage.used_count} / {limit} 件
          </h2>
          <p className="mt-1 text-xs font-semibold text-[#6b7280]">
            {planLabels[usage.plan_code] ?? usage.plan_code} / 残り {usage.remaining_count}件
          </p>
        </div>
        <div className="text-right text-xs font-semibold text-[#6b7280]">
          <p>{usage.period_start}</p>
          <p>{usage.period_end}</p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf2e8]">
        <div
          className={
            usage.remaining_count <= 0
              ? "h-full bg-[#b42318]"
              : percentage >= 80
                ? "h-full bg-[#9a5b13]"
                : "h-full bg-[#2f5d50]"
          }
          style={{ width: `${percentage}%` }}
        />
      </div>
    </section>
  );
}
