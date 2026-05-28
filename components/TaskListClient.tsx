"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

type Member = {
  id: string;
  role: string;
  name: string | null;
  email: string;
};

type TaskItem = {
  id: string;
  document_id: string | null;
  document_title: string | null;
  document_status: string | null;
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

type ApiList<T> = {
  data: T[];
};

const statusLabels: Record<string, string> = {
  todo: "未着手",
  in_progress: "対応中",
  waiting_review: "確認待ち",
  done: "完了",
  unnecessary: "不要",
  canceled: "中止",
};

const priorityLabels: Record<string, string> = {
  low: "低",
  normal: "通常",
  high: "高",
  urgent: "至急",
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

function getDueTone(task: TaskItem) {
  if (!task.due_date || ["done", "unnecessary", "canceled"].includes(task.status)) {
    return "text-[#6b7280]";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${task.due_date}T00:00:00`);
  if (due < today) {
    return "text-[#b42318]";
  }
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / 86400000);
  return diffDays <= 7 ? "text-[#9a5b13]" : "text-[#2f5d50]";
}

type TaskListClientProps = {
  canAssignTeamTasks: boolean;
  initialAssigneeFilter?: string;
  initialDueFilter?: string;
  initialStatusFilter?: string;
};

export default function TaskListClient({
  canAssignTeamTasks,
  initialAssigneeFilter = "all",
  initialDueFilter = "all",
  initialStatusFilter = "active",
}: TaskListClientProps) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [statusFilter, setStatusFilter] = useState(initialStatusFilter);
  const [dueFilter, setDueFilter] = useState(initialDueFilter);
  const [assigneeFilter, setAssigneeFilter] = useState(initialAssigneeFilter);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "normal",
    assignee_member_id: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const apiStatusFilter = statusFilter === "active" ? "all" : statusFilter;

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("status", apiStatusFilter);
      params.set("due", dueFilter);
      params.set("assignee", canAssignTeamTasks ? assigneeFilter : "all");
      const [taskPayload, memberPayload] = await Promise.all([
        fetchJson<ApiList<TaskItem>>(`/api/tasks?${params.toString()}`),
        fetchJson<ApiList<Member>>("/api/members"),
      ]);
      const nextTasks =
        statusFilter === "active"
          ? taskPayload.data.filter(
              (task) => !["done", "unnecessary", "canceled"].includes(task.status)
            )
          : taskPayload.data;
      setTasks(nextTasks);
      setMembers(memberPayload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [apiStatusFilter, assigneeFilter, canAssignTeamTasks, dueFilter, statusFilter]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const counts = useMemo(() => {
    return {
      total: tasks.length,
      overdue: tasks.filter((task) => getDueTone(task) === "text-[#b42318]").length,
      unassigned: tasks.filter((task) => !task.assignee_member_id).length,
    };
  }, [tasks]);

  function startEdit(task: TaskItem) {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      due_date: task.due_date ?? "",
      priority: task.priority,
      assignee_member_id: task.assignee_member_id ?? "",
    });
  }

  async function patchTask(id: string, body: Record<string, unknown>) {
    setSavingTaskId(id);
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setMessage("タスクを更新しました");
      setEditingTaskId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSavingTaskId(null);
    }
  }

  async function deleteTask(task: TaskItem) {
    if (!window.confirm(`${task.title} を削除しますか。`)) {
      return;
    }
    setSavingTaskId(task.id);
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/tasks/${task.id}`, { method: "DELETE" });
      setMessage("タスクを削除しました");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setSavingTaskId(null);
    }
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        <div className="border border-[#d9ded3] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#2f5d50]">
            Total
          </p>
          <p className="mt-2 text-2xl font-bold">{counts.total}</p>
        </div>
        <div className="border border-[#d9ded3] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a5b13]">
            Overdue
          </p>
          <p className="mt-2 text-2xl font-bold">{counts.overdue}</p>
        </div>
        <div className="border border-[#d9ded3] bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6b7280]">
            Unassigned
          </p>
          <p className="mt-2 text-2xl font-bold">{counts.unassigned}</p>
        </div>
      </section>

      <section className="border border-[#d9ded3] bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="text-xs font-bold text-[#4b5563]">状態</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-1 h-10 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm"
            >
              <option value="active">未完了</option>
              <option value="all">すべて</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold text-[#4b5563]">期限</span>
            <select
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value)}
              className="mt-1 h-10 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm"
            >
              <option value="all">すべて</option>
              <option value="overdue">期限超過</option>
              <option value="week">7日以内</option>
              <option value="none">期限なし</option>
            </select>
          </label>
          {canAssignTeamTasks ? (
            <label className="block">
              <span className="text-xs font-bold text-[#4b5563]">担当者</span>
              <select
                value={assigneeFilter}
                onChange={(event) => setAssigneeFilter(event.target.value)}
                className="mt-1 h-10 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm"
              >
                <option value="all">すべて</option>
                <option value="unassigned">未設定</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name ?? member.email}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div className="block">
              <span className="text-xs font-bold text-[#4b5563]">担当者</span>
              <div className="mt-1 flex h-10 items-center rounded-md border border-[#cfd6ca] bg-[#f4f5f1] px-3 text-sm font-semibold text-[#6b7280]">
                Business以上で利用可能
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => void loadAll()}
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
      </section>

      <section className="border border-[#d9ded3] bg-white">
        <div className="border-b border-[#e5e9df] px-5 py-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
            Task List
          </p>
          <h2 className="mt-1 text-xl font-bold">対応タスク</h2>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm text-[#5f6b5f]">
              読み込み中
            </div>
          ) : tasks.length === 0 ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
              タスクはありません
            </div>
          ) : (
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="border border-[#e1e6dc] p-4">
                  {editingTaskId === task.id ? (
                    <div className="grid gap-3">
                      <input
                        value={editForm.title}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className="h-10 border border-[#d9ded3] px-3 text-sm font-bold"
                      />
                      <textarea
                        value={editForm.description}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        rows={3}
                        className="border border-[#d9ded3] px-3 py-2 text-sm leading-6"
                      />
                      <div className="grid gap-2 md:grid-cols-3">
                        <input
                          value={editForm.due_date}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              due_date: event.target.value,
                            }))
                          }
                          placeholder="YYYY-MM-DD"
                          className="h-10 border border-[#d9ded3] px-3 text-sm"
                        />
                        <select
                          value={editForm.priority}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              priority: event.target.value,
                            }))
                          }
                          className="h-10 border border-[#d9ded3] bg-white px-3 text-sm"
                        >
                          {Object.entries(priorityLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        {canAssignTeamTasks ? (
                          <select
                            value={editForm.assignee_member_id}
                            onChange={(event) =>
                              setEditForm((current) => ({
                                ...current,
                                assignee_member_id: event.target.value,
                              }))
                            }
                            className="h-10 border border-[#d9ded3] bg-white px-3 text-sm"
                          >
                            <option value="">未設定</option>
                            {members.map((member) => (
                              <option key={member.id} value={member.id}>
                                {member.name ?? member.email}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="flex h-10 items-center border border-[#d9ded3] bg-[#f4f5f1] px-3 text-sm text-[#6b7280]">
                            担当者割当はBusiness以上
                          </div>
                        )}
                      </div>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingTaskId(null)}
                          className="h-9 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#4b5563]"
                        >
                          キャンセル
                        </button>
                        <button
                          type="button"
                          disabled={savingTaskId === task.id}
                          onClick={() =>
                            void patchTask(task.id, {
                              title: editForm.title,
                              description: editForm.description,
                              due_date: editForm.due_date,
                              priority: editForm.priority,
                              ...(canAssignTeamTasks
                                ? { assignee_member_id: editForm.assignee_member_id }
                                : {}),
                            })
                          }
                          className="inline-flex h-9 items-center gap-2 rounded-md bg-[#2f5d50] px-3 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {savingTaskId === task.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          保存
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                            {statusLabels[task.status] ?? task.status}
                          </span>
                          <span className="rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#4b5563]">
                            {priorityLabels[task.priority] ?? task.priority}
                          </span>
                          {task.due_date ? (
                            <span className={`text-xs font-bold ${getDueTone(task)}`}>
                              期限 {task.due_date}
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-[#6b7280]">
                              期限なし
                            </span>
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
                        <h3 className="mt-2 break-words text-base font-bold">
                          {task.title}
                        </h3>
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
                              {task.document_title ?? "書類"}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-start justify-end gap-2">
                        {task.status !== "done" ? (
                          <button
                            type="button"
                            disabled={savingTaskId === task.id}
                            onClick={() => void patchTask(task.id, { status: "done" })}
                            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#cde5d5] px-3 text-sm font-bold text-[#24613f] disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            完了
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={savingTaskId === task.id}
                            onClick={() => void patchTask(task.id, { status: "todo" })}
                            className="h-9 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
                          >
                            未着手へ戻す
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => startEdit(task)}
                          className="h-9 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
                        >
                          編集
                        </button>
                        <button
                          type="button"
                          disabled={savingTaskId === task.id}
                          onClick={() => void deleteTask(task)}
                          className="inline-flex h-9 items-center gap-2 rounded-md border border-[#f1c9c3] px-3 text-sm font-bold text-[#9a3412] disabled:opacity-60"
                        >
                          <Trash2 className="h-4 w-4" />
                          削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
