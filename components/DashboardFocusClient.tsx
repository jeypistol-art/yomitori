"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  MailPlus,
  RefreshCw,
  UploadCloud,
} from "lucide-react";

type NextAction = {
  kind: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  severity: "urgent" | "warning" | "normal" | "complete";
};

type DashboardStats = {
  documents_need_ai: number;
  documents_need_review: number;
  failed_documents: number;
  active_tasks: number;
  overdue_tasks: number;
  today_tasks: number;
  week_tasks: number;
  unassigned_tasks: number;
  due_reminders: number;
  failed_reminders: number;
};

type DashboardActivity = {
  documents_registered_7d: number;
  documents_approved_7d: number;
  tasks_done_7d: number;
  reminders_sent_7d: number;
};

type RecentDocument = {
  id: string;
  title: string;
  suggested_title: string | null;
  summary: string | null;
  due_date: string | null;
  status: string;
  document_type: string;
  created_at: string;
};

type DashboardSummary = {
  next_action: NextAction;
  stats: DashboardStats;
  activity: DashboardActivity;
  recent_documents: RecentDocument[];
};

type ApiItem<T> = {
  data: T;
};

const severityClasses: Record<NextAction["severity"], string> = {
  urgent: "border-[#f1c9c3] bg-[#fff5f2]",
  warning: "border-[#f0d6a8] bg-[#fff8eb]",
  normal: "border-[#d9ded3] bg-white",
  complete: "border-[#cde5d5] bg-[#f1faf4]",
};

const statusLabels: Record<string, string> = {
  uploaded: "登録済み",
  processing: "処理中",
  needs_review: "確認待ち",
  action_required: "要対応",
  approved: "承認済み",
  completed: "完了",
  failed: "失敗",
  archived: "削除済み",
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NextActionIcon({ severity }: { severity: NextAction["severity"] }) {
  if (severity === "urgent" || severity === "warning") {
    return <AlertTriangle className="h-5 w-5" />;
  }
  return <CheckCircle2 className="h-5 w-5" />;
}

export default function DashboardFocusClient() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSummary() {
    setIsLoading(true);
    setError("");
    try {
      const payload = await fetchJson<ApiItem<DashboardSummary>>(
        "/api/dashboard/summary"
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

  if (error) {
    return (
      <section className="border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
        {error}
      </section>
    );
  }

  if (isLoading || !summary) {
    return (
      <section className="border border-[#d9ded3] bg-white px-5 py-8 text-sm font-semibold text-[#6b7280]">
        ダッシュボードを読み込み中
      </section>
    );
  }

  const { next_action: nextAction, stats, activity, recent_documents: recentDocuments } =
    summary;

  return (
    <div className="space-y-5">
      <section className={`border p-5 ${severityClasses[nextAction.severity]}`}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 flex-1 gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#2f5d50]">
              <NextActionIcon severity={nextAction.severity} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
                Next Action
              </p>
              <h2 className="mt-1 break-words text-2xl font-bold">
                {nextAction.title}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5563]">
                {nextAction.body}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadSummary()}
              title="更新"
              className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-[#d9ded3] bg-white text-[#2f5d50]"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <Link
              href={nextAction.href}
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white"
            >
              {nextAction.cta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="border border-[#d9ded3] bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
                Activity
              </p>
              <h2 className="mt-1 text-xl font-bold">今週の活動</h2>
            </div>
            <Link
              href="/audit-logs"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
            >
              監査ログ
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["登録", activity.documents_registered_7d, "書類"],
              ["承認", activity.documents_approved_7d, "書類"],
              ["完了", activity.tasks_done_7d, "タスク"],
              ["送信", activity.reminders_sent_7d, "通知"],
            ].map(([label, value, unit]) => (
              <div key={label} className="border border-[#e1e6dc] bg-[#fbfcf8] p-3">
                <p className="text-xs font-bold text-[#6b7280]">{label}</p>
                <p className="mt-1 text-2xl font-bold">
                  {value}
                  <span className="ml-1 text-sm font-semibold text-[#6b7280]">
                    {unit}
                  </span>
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-[#d9ded3] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
            Quick Add
          </p>
          <h2 className="mt-1 text-xl font-bold">書類をすぐ入れる</h2>
          <div className="mt-4 grid gap-3">
            <Link
              href="/documents/new"
              className="flex items-center justify-between gap-3 border border-[#e1e6dc] px-3 py-3 text-sm font-bold text-[#1f2933]"
            >
              <span className="inline-flex items-center gap-2">
                <UploadCloud className="h-4 w-4 text-[#2f5d50]" />
                PDF・画像を登録
              </span>
              <ArrowRight className="h-4 w-4 text-[#2f5d50]" />
            </Link>
            <Link
              href="/documents/new"
              className="flex items-center justify-between gap-3 border border-[#e1e6dc] px-3 py-3 text-sm font-bold text-[#1f2933]"
            >
              <span className="inline-flex items-center gap-2">
                <MailPlus className="h-4 w-4 text-[#2f5d50]" />
                メール本文を貼り付け
              </span>
              <ArrowRight className="h-4 w-4 text-[#2f5d50]" />
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="border border-[#d9ded3] bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
            Queue
          </p>
          <h2 className="mt-1 text-xl font-bold">いまの滞留</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["承認待ち", stats.documents_need_review],
              ["期限切れ", stats.overdue_tasks],
              ["本日期限", stats.today_tasks],
              ["未割当", stats.unassigned_tasks],
            ].map(([label, value]) => (
              <div key={label} className="border border-[#e1e6dc] bg-[#fbfcf8] p-3">
                <p className="text-xs font-bold text-[#6b7280]">{label}</p>
                <p className="mt-1 text-xl font-bold">{value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="border border-[#d9ded3] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
                Recent Documents
              </p>
              <h2 className="mt-1 text-xl font-bold">最近の書類</h2>
            </div>
            <Link
              href="/documents/new"
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
            >
              一覧
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="p-5">
            {recentDocuments.length === 0 ? (
              <div className="border border-dashed border-[#cfd6ca] px-4 py-8 text-center text-sm font-semibold text-[#5f6b5f]">
                書類はまだ登録されていません
              </div>
            ) : (
              <div className="space-y-3">
                {recentDocuments.map((document) => (
                  <Link
                    key={document.id}
                    href={`/documents/${document.id}/review`}
                    className="block border border-[#e1e6dc] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                        {statusLabels[document.status] ?? document.status}
                      </span>
                      {document.due_date ? (
                        <span className="text-xs font-bold text-[#9a5b13]">
                          期限 {document.due_date}
                        </span>
                      ) : null}
                      <span className="text-xs font-semibold text-[#6b7280]">
                        {formatDateTime(document.created_at)}
                      </span>
                    </div>
                    <h3 className="mt-2 break-words text-base font-bold">
                      {document.suggested_title ?? document.title}
                    </h3>
                    {document.summary ? (
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#4b5563]">
                        {document.summary}
                      </p>
                    ) : null}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
