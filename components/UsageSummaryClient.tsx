"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, FileText } from "lucide-react";
import {
  EXTRA_PACK_CATALOG,
  getPlanCatalogItem,
} from "@/lib/usage_catalog";

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

export default function UsageSummaryClient({
  compact = false,
  showExtraPacks = true,
}: {
  compact?: boolean;
  showExtraPacks?: boolean;
}) {
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
  const plan = getPlanCatalogItem(usage.plan_code);
  const isLimitReached = usage.remaining_count <= 0;
  const isNearLimit = !isLimitReached && percentage >= 80;
  const statusClass = isLimitReached
    ? "border-[#f1c9c3] bg-[#fff5f2] text-[#9a3412]"
    : isNearLimit
      ? "border-[#f0d6a8] bg-[#fff8eb] text-[#9a5b13]"
      : "border-[#cde5d5] bg-[#f1faf4] text-[#24613f]";
  const statusMessage = isLimitReached
    ? "今月の登録上限に達しています。追加パックまたは上位プランを検討してください。"
    : isNearLimit
      ? "今月の登録数が上限に近づいています。追加登録が多い月は追加パックを検討してください。"
      : "今月の登録枠には余裕があります。";

  if (compact) {
    return (
      <section className="border border-[#d9ded3] bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-[#2f5d50]">今月の利用状況</p>
            <h2 className="mt-1 text-lg font-bold">
              {usage.used_count} / {limit} 件
            </h2>
            <p className="mt-1 text-xs font-semibold text-[#6b7280]">
              {plan.name} / 残り {usage.remaining_count}件
            </p>
          </div>
          <Link
            href="/usage"
            className="shrink-0 rounded-md border border-[#d9ded3] px-3 py-2 text-xs font-bold text-[#2f5d50]"
          >
            利用状況
          </Link>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf2e8]">
          <div
            className={
              isLimitReached
                ? "h-full bg-[#b42318]"
                : isNearLimit
                  ? "h-full bg-[#9a5b13]"
                  : "h-full bg-[#2f5d50]"
            }
            style={{ width: `${percentage}%` }}
          />
        </div>
        {isLimitReached || isNearLimit ? (
          <p className={`mt-3 border px-3 py-2 text-xs font-semibold ${statusClass}`}>
            {statusMessage}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="border border-[#d9ded3] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
            Usage
          </p>
          <h2 className="mt-1 text-xl font-bold">
            今月の利用状況
          </h2>
          <p className="mt-2 text-sm font-semibold text-[#4b5563]">
            {plan.name} / {plan.priceLabel} / {plan.audience}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold">
            {usage.used_count} / {limit}
            <span className="ml-1 text-base">件</span>
          </p>
          <p className="mt-1 text-xs font-semibold text-[#6b7280]">
            {formatDate(usage.period_start)} - {formatDate(usage.period_end)}
          </p>
        </div>
      </div>

      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf2e8]">
        <div
          className={
            isLimitReached
              ? "h-full bg-[#b42318]"
              : isNearLimit
                ? "h-full bg-[#9a5b13]"
                : "h-full bg-[#2f5d50]"
          }
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className={`mt-4 flex items-start gap-2 border px-4 py-3 text-sm font-semibold ${statusClass}`}>
        {isLimitReached || isNearLimit ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        )}
        <p>{statusMessage}</p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <div className="border border-[#e1e6dc] bg-[#fbfcf8] p-3">
          <p className="text-xs font-bold text-[#6b7280]">プラン内上限</p>
          <p className="mt-1 text-lg font-bold">{usage.included_count}件</p>
        </div>
        <div className="border border-[#e1e6dc] bg-[#fbfcf8] p-3">
          <p className="text-xs font-bold text-[#6b7280]">追加パック分</p>
          <p className="mt-1 text-lg font-bold">{usage.purchased_extra_count}件</p>
        </div>
        <div className="border border-[#e1e6dc] bg-[#fbfcf8] p-3">
          <p className="text-xs font-bold text-[#6b7280]">残り登録数</p>
          <p className="mt-1 text-lg font-bold">{usage.remaining_count}件</p>
        </div>
      </div>

      {showExtraPacks ? (
        <div className="mt-5 border-t border-[#e5e9df] pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold">追加パック</p>
              <p className="mt-1 text-xs font-semibold text-[#6b7280]">
                決済連携後、この枠から今月分の登録数を追加します。
              </p>
            </div>
            <Link
              href="/usage"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
            >
              <CreditCard className="h-4 w-4" />
              詳細
            </Link>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {EXTRA_PACK_CATALOG.map((pack) => (
              <div key={pack.code} className="flex items-center justify-between gap-3 border border-[#e1e6dc] px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-[#2f5d50]" />
                  <span className="text-sm font-bold">{pack.name}</span>
                </div>
                <span className="text-sm font-bold text-[#2f5d50]">
                  {pack.priceLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
