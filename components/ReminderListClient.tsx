"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, FileText, RefreshCw } from "lucide-react";

type ReminderItem = {
  id: string;
  task_id: string;
  task_title: string;
  task_status: string;
  task_due_date: string | null;
  document_id: string | null;
  document_title: string | null;
  recipient_member_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  channel: string;
  remind_at: string;
  status: string;
  created_at: string;
};

type ApiList<T> = {
  data: T[];
};

const statusLabels: Record<string, string> = {
  scheduled: "予定",
  sent: "送信済み",
  canceled: "キャンセル",
  failed: "失敗",
};

const timingLabels: Record<string, string> = {
  all: "すべて",
  overdue: "未通知の過去分",
  today: "今日",
  week: "7日以内",
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
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getReminderTone(value: string) {
  const remindAt = new Date(value);
  const now = new Date();
  if (remindAt < now) {
    return "text-[#b42318]";
  }
  const diffDays = Math.ceil((remindAt.getTime() - now.getTime()) / 86400000);
  return diffDays <= 7 ? "text-[#9a5b13]" : "text-[#2f5d50]";
}

export default function ReminderListClient() {
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("scheduled");
  const [timingFilter, setTimingFilter] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReminders = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        status: statusFilter,
        timing: timingFilter,
      });
      const payload = await fetchJson<ApiList<ReminderItem>>(
        `/api/reminders?${params.toString()}`
      );
      setReminders(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, timingFilter]);

  useEffect(() => {
    void loadReminders();
  }, [loadReminders]);

  const counts = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);
    return {
      total: reminders.length,
      overdue: reminders.filter((item) => new Date(item.remind_at) < now).length,
      today: reminders.filter((item) => {
        const remindAt = new Date(item.remind_at);
        return remindAt >= todayStart && remindAt < tomorrowStart;
      }).length,
    };
  }, [reminders]);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-3">
        {[
          ["全て", counts.total],
          ["期限切れ", counts.overdue],
          ["本日", counts.today],
        ].map(([label, value]) => (
          <div key={label} className="border border-[#d9ded3] bg-white p-4">
            <p className="text-xs font-bold text-[#5f6b5f]">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section className="border border-[#d9ded3] bg-white p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <label className="block">
              <span className="text-xs font-bold text-[#4b5563]">状態</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="mt-1 h-10 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm"
              >
                <option value="all">すべて</option>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-[#4b5563]">時期</span>
              <select
                value={timingFilter}
                onChange={(event) => setTimingFilter(event.target.value)}
                className="mt-1 h-10 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm"
              >
                {Object.entries(timingLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void loadReminders()}
            className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
          >
            <RefreshCw className="h-4 w-4" />
            更新
          </button>
        </div>
        {error ? (
          <p className="mt-3 border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
            {error}
          </p>
        ) : null}
      </section>

      <section className="border border-[#d9ded3] bg-white">
        <div className="border-b border-[#e5e9df] px-5 py-4">
          <p className="text-sm font-bold text-[#2f5d50]">Reminder List</p>
          <h2 className="mt-1 text-xl font-bold">予定リマインド</h2>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm text-[#5f6b5f]">
              読み込み中
            </div>
          ) : reminders.length === 0 ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
              リマインドはありません
            </div>
          ) : (
            <div className="space-y-3">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="border border-[#e1e6dc] p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                      {statusLabels[reminder.status] ?? reminder.status}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-bold ${getReminderTone(reminder.remind_at)}`}
                    >
                      <CalendarClock className="h-3.5 w-3.5" />
                      {formatDateTime(reminder.remind_at)}
                    </span>
                    <span className="text-xs font-semibold text-[#6b7280]">
                      {reminder.channel}
                    </span>
                  </div>
                  <h3 className="mt-2 break-words text-base font-bold">
                    {reminder.task_title}
                  </h3>
                  {reminder.document_title ? (
                    <p className="mt-1 break-words text-xs font-semibold text-[#6b7280]">
                      書類: {reminder.document_title}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#6b7280]">
                    <span>
                      通知先:{" "}
                      {reminder.recipient_name ?? reminder.recipient_email ?? "未設定"}
                    </span>
                    {reminder.task_due_date ? (
                      <span>タスク期限: {reminder.task_due_date}</span>
                    ) : null}
                    {reminder.document_id ? (
                      <Link
                        href={`/documents/${reminder.document_id}/review`}
                        className="inline-flex items-center gap-1 text-[#2f5d50]"
                      >
                        <FileText className="h-3.5 w-3.5" />
                        確認
                      </Link>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
