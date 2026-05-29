"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
} from "lucide-react";

type PendingDocument = {
  id: string;
  title: string;
  suggested_title: string | null;
  summary: string | null;
  due_date: string | null;
  document_type: string;
  source_type: string;
  status: string;
  file_count: number;
  duplicate_count: number;
  priority_rank: number;
  priority_label: string;
  priority_reason: string;
  created_at: string;
  updated_at: string;
};

type PendingTask = {
  id: string;
  document_id: string | null;
  document_title: string | null;
  title: string;
  description: string | null;
  assignee_member_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  reminder_count: number;
  next_remind_at: string | null;
  created_at: string;
  updated_at: string;
};

type QueueStats = {
  documents_need_ai: number;
  documents_need_review: number;
  failed_documents: number;
  active_tasks: number;
  overdue_tasks: number;
  unassigned_tasks: number;
};

type QueuePayload = {
  data: {
    documents: PendingDocument[];
    tasks: PendingTask[];
    stats: QueueStats;
    features: {
      priority_processing: boolean;
    };
  };
};

const documentStatusLabels: Record<string, string> = {
  uploaded: "AI未抽出",
  processing: "処理中",
  needs_review: "確認待ち",
  action_required: "対応要",
  failed: "失敗",
};

const taskStatusLabels: Record<string, string> = {
  todo: "未着手",
  in_progress: "対応中",
  waiting_review: "確認待ち",
};

const priorityLabels: Record<string, string> = {
  low: "低",
  normal: "通常",
  high: "高",
  urgent: "至急",
};

const documentPriorityClassNames: Record<string, string> = {
  至急: "bg-[#fff1f0] text-[#9f352c]",
  高: "bg-[#fff8eb] text-[#9a5b13]",
  通常: "bg-[#edf2e8] text-[#2f5d50]",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string" ? payload.error : "Request failed"
    );
  }
  return payload as T;
}

function getDueTone(dueDate: string | null) {
  if (!dueDate) {
    return "text-[#6b7280]";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${dueDate}T00:00:00`);
  if (due < today) {
    return "text-[#b42318]";
  }
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  return diffDays <= 7 ? "text-[#9a5b13]" : "text-[#2f5d50]";
}

export default function UnprocessedQueueClient() {
  const [documents, setDocuments] = useState<PendingDocument[]>([]);
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [stats, setStats] = useState<QueueStats>({
    documents_need_ai: 0,
    documents_need_review: 0,
    failed_documents: 0,
    active_tasks: 0,
    overdue_tasks: 0,
    unassigned_tasks: 0,
  });
  const [features, setFeatures] = useState({
    priority_processing: false,
  });
  const [view, setView] = useState<"all" | "documents" | "tasks">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await fetchJson<QueuePayload>("/api/work-queue");
      setDocuments(payload.data.documents);
      setTasks(payload.data.tasks);
      setStats(payload.data.stats);
      setFeatures(payload.data.features);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const totals = useMemo(
    () => ({
      all: documents.length + tasks.length,
      documents: documents.length,
      tasks: tasks.length,
    }),
    [documents.length, tasks.length]
  );

  async function extractDocument(document: PendingDocument) {
    setWorkingId(document.id);
    setMessage("");
    setError("");
    try {
      await fetchJson(`/api/documents/${document.id}/extract`, { method: "POST" });
      setMessage(`${document.suggested_title ?? document.title} のAI抽出が完了しました`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI抽出に失敗しました");
    } finally {
      setWorkingId(null);
    }
  }

  async function completeTask(task: PendingTask) {
    setWorkingId(task.id);
    setMessage("");
    setError("");
    try {
      await fetchJson(`/api/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
      setMessage(`${task.title} を完了にしました`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスク更新に失敗しました");
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteDocument(document: PendingDocument) {
    if (!window.confirm(`${document.suggested_title ?? document.title} を削除しますか。`)) {
      return;
    }
    setWorkingId(document.id);
    setMessage("");
    setError("");
    try {
      await fetchJson(`/api/documents/${document.id}`, { method: "DELETE" });
      setMessage(`${document.suggested_title ?? document.title} を削除しました`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "書類削除に失敗しました");
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteTask(task: PendingTask) {
    if (!window.confirm(`${task.title} を削除しますか。`)) {
      return;
    }
    setWorkingId(task.id);
    setMessage("");
    setError("");
    try {
      await fetchJson(`/api/tasks/${task.id}`, { method: "DELETE" });
      setMessage(`${task.title} を削除しました`);
      await loadQueue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "タスク削除に失敗しました");
    } finally {
      setWorkingId(null);
    }
  }

  const showDocuments = view === "all" || view === "documents";
  const showTasks = view === "all" || view === "tasks";

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          ["AI未抽出", stats.documents_need_ai],
          ["承認待ち", stats.documents_need_review],
          ["抽出失敗", stats.failed_documents],
          ["未完了タスク", stats.active_tasks],
          ["期限超過", stats.overdue_tasks],
          ["担当未設定", stats.unassigned_tasks],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#d9ded3] bg-white p-4">
            <p className="text-xs font-bold text-[#5f6b5f]">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="border border-[#d9ded3] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {[
              ["all", `すべて ${totals.all}`],
              ["documents", `書類 ${totals.documents}`],
              ["tasks", `タスク ${totals.tasks}`],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setView(value as "all" | "documents" | "tasks")}
                className={
                  view === value
                    ? "h-10 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white"
                    : "h-10 rounded-md border border-[#d9ded3] px-4 text-sm font-bold text-[#2f5d50]"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void loadQueue()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
          >
            <RefreshCw className="h-4 w-4" />
            更新
          </button>
        </div>
        {message ? (
          <p className="mt-3 border border-[#cde5d5] bg-[#f1faf4] px-4 py-3 text-sm font-semibold text-[#24613f]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
            {error}
          </p>
        ) : null}
        {features.priority_processing ? (
          <p className="mt-3 border border-[#cde5d5] bg-[#f1faf4] px-4 py-3 text-sm font-semibold text-[#24613f]">
            優先処理が有効です。期限切れ、期限接近、対応タスクあり、注意点ありの順に重要度を付けて表示しています。
          </p>
        ) : (
          <p className="mt-3 border border-[#e1e6dc] bg-[#fbfcf8] px-4 py-3 text-sm leading-6 text-[#5f6b5f]">
            優先処理はProプラン以上で利用できます。期限や注意点をもとに、重要な書類から並べ替えます。
            <Link href="/usage" className="ml-2 font-bold text-[#2f5d50]">
              プランを見る
            </Link>
          </p>
        )}
      </section>

      {isLoading ? (
        <section className="border border-dashed border-[#cfd6ca] bg-white px-4 py-10 text-center text-sm text-[#5f6b5f]">
          読み込み中
        </section>
      ) : totals.all === 0 ? (
        <section className="border border-dashed border-[#cfd6ca] bg-white px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
          未処理はありません
        </section>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {showDocuments ? (
            <section className="border border-[#d9ded3] bg-white">
              <div className="border-b border-[#e5e9df] px-5 py-4">
                <p className="text-sm font-bold text-[#2f5d50]">書類</p>
                <h2 className="mt-1 text-xl font-bold">確認・抽出待ち</h2>
              </div>
              <div className="space-y-3 p-5">
                {documents.length === 0 ? (
                  <div className="border border-dashed border-[#cfd6ca] px-4 py-8 text-center text-sm text-[#5f6b5f]">
                    未処理の書類はありません
                  </div>
                ) : (
                  documents.map((document) => (
                    <div key={document.id} className="border border-[#e1e6dc] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                          {documentStatusLabels[document.status] ?? document.status}
                        </span>
                        <span className="rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#4b5563]">
                          {document.document_type}
                        </span>
                        {features.priority_processing ? (
                          <span
                            className={`rounded px-2 py-1 text-xs font-bold ${
                              documentPriorityClassNames[document.priority_label] ??
                              "bg-[#edf2e8] text-[#2f5d50]"
                            }`}
                          >
                            優先 {document.priority_label}
                          </span>
                        ) : null}
                        <span className="text-xs font-semibold text-[#6b7280]">
                          {document.file_count > 0 ? `${document.file_count}ファイル` : "本文"}
                        </span>
                        {document.duplicate_count > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#fff8eb] px-2 py-1 text-xs font-bold text-[#9a5b13]">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            重複候補 {document.duplicate_count}件
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 break-words text-base font-bold">
                        {document.suggested_title ?? document.title}
                      </h3>
                      {document.summary ? (
                        <p className="mt-2 break-words text-sm leading-6 text-[#4b5563]">
                          {document.summary}
                        </p>
                      ) : null}
                      {document.due_date ? (
                        <p className={`mt-2 text-sm font-bold ${getDueTone(document.due_date)}`}>
                          期限 {document.due_date}
                        </p>
                      ) : null}
                      {features.priority_processing ? (
                        <p className="mt-2 text-xs font-semibold text-[#6b7280]">
                          優先理由: {document.priority_reason}
                        </p>
                      ) : null}
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Link
                          href={`/documents/${document.id}/review`}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
                        >
                          <FileText className="h-4 w-4" />
                          確認
                        </Link>
                        {["uploaded", "failed"].includes(document.status) ? (
                          <button
                            type="button"
                            disabled={workingId === document.id}
                            onClick={() => void extractDocument(document)}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
                          >
                            {workingId === document.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Sparkles className="h-4 w-4" />
                            )}
                            AI抽出
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={workingId === document.id}
                          onClick={() => void deleteDocument(document)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#f1c9c3] px-3 text-sm font-bold text-[#9a3412] disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          削除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}

          {showTasks ? (
            <section className="border border-[#d9ded3] bg-white">
              <div className="border-b border-[#e5e9df] px-5 py-4">
                <p className="text-sm font-bold text-[#2f5d50]">タスク</p>
                <h2 className="mt-1 text-xl font-bold">未完了タスク</h2>
              </div>
              <div className="space-y-3 p-5">
                {tasks.length === 0 ? (
                  <div className="border border-dashed border-[#cfd6ca] px-4 py-8 text-center text-sm text-[#5f6b5f]">
                    未完了タスクはありません
                  </div>
                ) : (
                  tasks.map((task) => (
                    <div key={task.id} className="border border-[#e1e6dc] p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                          {taskStatusLabels[task.status] ?? task.status}
                        </span>
                        <span className="rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#4b5563]">
                          {priorityLabels[task.priority] ?? task.priority}
                        </span>
                        {task.due_date ? (
                          <span className={`text-xs font-bold ${getDueTone(task.due_date)}`}>
                            期限 {task.due_date}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-[#6b7280]">期限なし</span>
                        )}
                        {task.reminder_count > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#6b7280]">
                            <CalendarClock className="h-3.5 w-3.5" />
                            {task.reminder_count}件
                            {task.next_remind_at
                              ? ` / 次回 ${new Date(task.next_remind_at).toLocaleDateString("ja-JP")}`
                              : ""}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 break-words text-base font-bold">{task.title}</h3>
                      {task.document_title ? (
                        <p className="mt-1 break-words text-xs font-semibold text-[#6b7280]">
                          書類: {task.document_title}
                        </p>
                      ) : null}
                      {task.description ? (
                        <p className="mt-2 break-words text-sm leading-6 text-[#4b5563]">
                          {task.description}
                        </p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#6b7280]">
                        <span>
                          担当: {task.assignee_name ?? task.assignee_email ?? "未設定"}
                        </span>
                        {task.document_id ? (
                          <Link
                            href={`/documents/${task.document_id}/review`}
                            className="inline-flex items-center gap-1 text-[#2f5d50]"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            確認
                          </Link>
                        ) : null}
                      </div>
                      <div className="mt-4 flex flex-wrap justify-end gap-2">
                        <Link
                          href="/tasks"
                          className="h-9 rounded-md border border-[#d9ded3] px-3 py-2 text-sm font-bold text-[#2f5d50]"
                        >
                          編集
                        </Link>
                        <button
                          type="button"
                          disabled={workingId === task.id}
                          onClick={() => void completeTask(task)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#cde5d5] px-3 text-sm font-bold text-[#24613f] disabled:opacity-60"
                        >
                          {workingId === task.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          完了
                        </button>
                        <button
                          type="button"
                          disabled={workingId === task.id}
                          onClick={() => void deleteTask(task)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#f1c9c3] px-3 text-sm font-bold text-[#9a3412] disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          削除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
