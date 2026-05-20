"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  Building2,
  CheckCircle2,
  Circle,
  FileText,
  RefreshCw,
  Users,
} from "lucide-react";

type DeliveryStatus = {
  mode: string;
  provider: string;
  from: string;
  from_configured: boolean;
  resend_configured: boolean;
  smtp_configured: boolean;
};

type OnboardingSummary = {
  managed_asset_count: number;
  counterparty_count: number;
  member_count: number;
  non_owner_member_count: number;
  document_count: number;
  approved_document_count: number;
  scheduled_reminder_count: number;
  failed_reminder_count: number;
  default_reminder_days_before: number[];
  delivery: DeliveryStatus;
};

type ApiItem<T> = {
  data: T;
};

const providerLabels: Record<string, string> = {
  resend: "Resend",
  smtp: "SMTP",
  log: "ログ出力",
  unconfigured: "未設定",
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

export default function OnboardingClient() {
  const [summary, setSummary] = useState<OnboardingSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSummary() {
    setIsLoading(true);
    setError("");
    try {
      const payload = await fetchJson<ApiItem<OnboardingSummary>>(
        "/api/onboarding/summary"
      );
      setSummary(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadSummary();
  }, []);

  const checklist = useMemo(() => {
    if (!summary) {
      return [];
    }
    return [
      {
        id: "assets",
        title: "管理対象を登録",
        body: "物件、施設、店舗、テナントなど、書類を紐づける対象を登録します。",
        done: summary.managed_asset_count > 0,
        count: `${summary.managed_asset_count}件`,
        href: "/master-data",
        action: "台帳設定へ",
        icon: Building2,
      },
      {
        id: "counterparties",
        title: "取引先を登録",
        body: "行政、自治体、保守会社、保険会社など、書類の発行元を登録します。",
        done: summary.counterparty_count > 0,
        count: `${summary.counterparty_count}件`,
        href: "/master-data",
        action: "取引先設定へ",
        icon: Building2,
      },
      {
        id: "members",
        title: "担当者を登録",
        body: "承認後のタスク割当とメール通知に使う担当者を登録します。",
        done: summary.non_owner_member_count > 0,
        count: `${summary.member_count}名`,
        href: "/team",
        action: "担当者設定へ",
        icon: Users,
      },
      {
        id: "delivery",
        title: "通知送信元を確認",
        body: "本番運用ではResendと送信元メールアドレスの設定を確認します。",
        done: summary.delivery.provider === "resend" && summary.delivery.from_configured,
        count: providerLabels[summary.delivery.provider] ?? summary.delivery.provider,
        href: "/reminders",
        action: "リマインドへ",
        icon: Bell,
      },
      {
        id: "documents",
        title: "初回書類を登録",
        body: "メール本文、PDF、画像のいずれかで書類を登録し、AI抽出を確認します。",
        done: summary.document_count > 0,
        count: `${summary.document_count}件`,
        href: "/documents/new",
        action: "書類登録へ",
        icon: FileText,
      },
    ];
  }, [summary]);

  const completedCount = checklist.filter((item) => item.done).length;
  const completionRate =
    checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <section className="border border-[#d9ded3] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
              Setup
            </p>
            <h2 className="mt-1 text-xl font-bold">初期設定チェックリスト</h2>
            <p className="mt-2 text-sm font-semibold text-[#4b5563]">
              {completedCount} / {checklist.length} 完了
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSummary()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
          >
            <RefreshCw className="h-4 w-4" />
            更新
          </button>
        </div>
        <div className="mt-4 h-3 overflow-hidden rounded-full bg-[#edf2e8]">
          <div
            className="h-full bg-[#2f5d50]"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </section>

      {error ? (
        <div className="border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="border border-dashed border-[#cfd6ca] bg-white px-4 py-10 text-center text-sm text-[#5f6b5f]">
          読み込み中
        </div>
      ) : (
        <section className="grid gap-3 md:grid-cols-2">
          {checklist.map((item) => {
            const Icon = item.icon;
            return (
              <article key={item.id} className="border border-[#d9ded3] bg-white p-5">
                <div className="flex items-start gap-3">
                  <div
                    className={
                      item.done
                        ? "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#edf2e8] text-[#2f5d50]"
                        : "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3f4f6] text-[#6b7280]"
                    }
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.done ? (
                        <CheckCircle2 className="h-4 w-4 text-[#2f5d50]" />
                      ) : (
                        <Circle className="h-4 w-4 text-[#9a5b13]" />
                      )}
                      <h3 className="text-base font-bold">{item.title}</h3>
                      <span className="rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#4b5563]">
                        {item.count}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#4b5563]">
                      {item.body}
                    </p>
                    <Link
                      href={item.href}
                      className="mt-4 inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
                    >
                      {item.action}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {summary ? (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="border border-[#d9ded3] bg-white p-5">
            <p className="text-sm font-bold text-[#2f5d50]">既定の通知ルール</p>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              承認時にタスク期限がある場合、期限の
              {summary.default_reminder_days_before.join("日前、")}日前にリマインドを作成します。
            </p>
          </div>
          <div className="border border-[#d9ded3] bg-white p-5">
            <p className="text-sm font-bold text-[#2f5d50]">現在の通知状況</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="border border-[#e1e6dc] bg-[#fbfcf8] p-3">
                <p className="text-xs font-bold text-[#6b7280]">予定</p>
                <p className="mt-1 text-lg font-bold">
                  {summary.scheduled_reminder_count}件
                </p>
              </div>
              <div className="border border-[#e1e6dc] bg-[#fbfcf8] p-3">
                <p className="text-xs font-bold text-[#6b7280]">失敗</p>
                <p className="mt-1 text-lg font-bold">
                  {summary.failed_reminder_count}件
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
}
