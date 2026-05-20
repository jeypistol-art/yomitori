"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, RefreshCw, ShieldCheck } from "lucide-react";

type Actor = {
  id: string;
  name: string | null;
  email: string;
};

type AuditLog = {
  id: string;
  actor_member_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_title: string | null;
  before_json: unknown;
  after_json: unknown;
  created_at: string;
};

type AuditStats = {
  total_30d: number;
  approvals_30d: number;
  deletes_30d: number;
  reminder_sent_30d: number;
};

type AuditPayload = {
  data: {
    logs: AuditLog[];
    stats: AuditStats;
    actors: Actor[];
    actions: string[];
    target_types: string[];
  };
};

type AuditDetail = {
  label: string;
  value: string;
};

type AuditView = {
  summary: string;
  details: AuditDetail[];
};

const actionLabels: Record<string, string> = {
  "document.approved": "書類承認",
  "document.deleted": "書類削除",
  "review_draft.saved": "下書き保存",
  "reminder.sent": "リマインド送信",
  "reminder.retry_requested": "リマインド再送",
};

const targetTypeLabels: Record<string, string> = {
  document: "書類",
  task: "タスク",
  reminder: "リマインド",
};

const statusLabels: Record<string, string> = {
  draft: "下書き",
  uploaded: "登録済み",
  extracted: "抽出済み",
  reviewed: "確認済み",
  approved: "承認済み",
  archived: "削除済み",
};

const channelLabels: Record<string, string> = {
  email: "メール",
  in_app: "アプリ内",
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

function formatDateTimeValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }
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

function compactJson(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function textValue(value: unknown) {
  if (typeof value === "string") {
    return value.trim() || null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "はい" : "いいえ";
  }
  return null;
}

function numericValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function titleOf(log: AuditLog, document: Record<string, unknown> = {}) {
  return textValue(document.title) ?? log.target_title ?? log.target_id ?? "対象なし";
}

function addDetail(
  details: AuditDetail[],
  label: string,
  value: unknown,
  formatter?: (value: unknown) => string | null
) {
  const formatted = formatter ? formatter(value) : textValue(value);
  if (formatted) {
    details.push({ label, value: formatted });
  }
}

function buildAuditView(log: AuditLog): AuditView {
  const after = asRecord(log.after_json);
  const before = asRecord(log.before_json);

  if (log.action === "document.approved") {
    const document = asRecord(after.document);
    const createdTaskCount = numericValue(after.created_task_count);
    const details: AuditDetail[] = [];
    addDetail(details, "書類ID", document.id);
    addDetail(details, "ステータス", document.status, (value) => {
      const status = textValue(value);
      return status ? statusLabels[status] ?? status : null;
    });
    addDetail(details, "承認日時", document.approved_at, formatDateTimeValue);
    addDetail(details, "作成タスク数", after.created_task_count, (value) => {
      const count = numericValue(value);
      return count === null ? null : `${count}件`;
    });

    return {
      summary: `書類「${titleOf(log, document)}」を承認しました。${
        createdTaskCount === null ? "" : `タスクを${createdTaskCount}件作成しました。`
      }`,
      details,
    };
  }

  if (log.action === "document.deleted") {
    const document = asRecord(after.document);
    const details: AuditDetail[] = [];
    addDetail(details, "書類ID", document.id);
    addDetail(details, "ステータス", document.status, (value) => {
      const status = textValue(value);
      return status ? statusLabels[status] ?? status : null;
    });
    addDetail(details, "削除日時", document.updated_at, formatDateTimeValue);

    return {
      summary: `書類「${titleOf(log, document)}」を削除しました。`,
      details,
    };
  }

  if (log.action === "review_draft.saved") {
    const details: AuditDetail[] = [];
    addDetail(details, "下書きバージョン", after.draft_version);
    addDetail(details, "紐づけ管理対象数", after.managed_asset_count, (value) => {
      const count = numericValue(value);
      return count === null ? null : `${count}件`;
    });

    return {
      summary: `書類「${titleOf(log)}」のAI抽出確認内容を保存しました。`,
      details,
    };
  }

  if (log.action === "reminder.sent") {
    const details: AuditDetail[] = [];
    addDetail(details, "リマインドID", log.target_id);
    addDetail(details, "タスクID", after.task_id);
    addDetail(details, "通知方法", after.channel, (value) => {
      const channel = textValue(value);
      return channel ? channelLabels[channel] ?? channel : null;
    });
    addDetail(details, "送信プロバイダ", after.provider);

    return {
      summary: `「${titleOf(log)}」のリマインドを送信しました。`,
      details,
    };
  }

  if (log.action === "reminder.retry_requested") {
    const details: AuditDetail[] = [];
    addDetail(details, "リマインドID", log.target_id);
    addDetail(details, "変更前ステータス", before.status);
    addDetail(details, "変更後ステータス", after.status);

    return {
      summary: `「${titleOf(log)}」のリマインド再送を実行しました。`,
      details,
    };
  }

  const details: AuditDetail[] = [];
  for (const [key, value] of Object.entries(after).concat(Object.entries(before))) {
    if (details.length >= 6) {
      break;
    }
    const formatted = textValue(value);
    if (formatted) {
      details.push({ label: key, value: formatted });
    }
  }

  return {
    summary: `${actionLabels[log.action] ?? log.action}を記録しました。`,
    details,
  };
}

function targetHref(log: AuditLog) {
  if (!log.target_id) {
    return null;
  }
  if (log.target_type === "document") {
    return `/documents/${log.target_id}/review`;
  }
  if (log.target_type === "task") {
    return "/tasks";
  }
  if (log.target_type === "reminder") {
    return "/reminders";
  }
  return null;
}

export default function AuditLogsClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats>({
    total_30d: 0,
    approvals_30d: 0,
    deletes_30d: 0,
    reminder_sent_30d: 0,
  });
  const [actors, setActors] = useState<Actor[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [targetTypes, setTargetTypes] = useState<string[]>([]);
  const [actionFilter, setActionFilter] = useState("all");
  const [targetTypeFilter, setTargetTypeFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const params = useMemo(() => {
    const next = new URLSearchParams();
    next.set("action", actionFilter);
    next.set("target_type", targetTypeFilter);
    next.set("actor", actorFilter);
    return next;
  }, [actionFilter, actorFilter, targetTypeFilter]);

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await fetchJson<AuditPayload>(
        `/api/audit-logs?${params.toString()}`
      );
      setLogs(payload.data.logs);
      setStats(payload.data.stats);
      setActors(payload.data.actors);
      setActions(payload.data.actions);
      setTargetTypes(payload.data.target_types);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [params]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <div className="space-y-5">
      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["30日合計", stats.total_30d],
          ["承認", stats.approvals_30d],
          ["削除", stats.deletes_30d],
          ["通知送信", stats.reminder_sent_30d],
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
              <span className="text-xs font-bold text-[#4b5563]">操作</span>
              <select
                value={actionFilter}
                onChange={(event) => setActionFilter(event.target.value)}
                className="mt-1 h-10 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm"
              >
                <option value="all">すべて</option>
                {actions.map((action) => (
                  <option key={action} value={action}>
                    {actionLabels[action] ?? action}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-[#4b5563]">対象</span>
              <select
                value={targetTypeFilter}
                onChange={(event) => setTargetTypeFilter(event.target.value)}
                className="mt-1 h-10 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm"
              >
                <option value="all">すべて</option>
                {targetTypes.map((targetType) => (
                  <option key={targetType} value={targetType}>
                    {targetTypeLabels[targetType] ?? targetType}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-bold text-[#4b5563]">実行者</span>
              <select
                value={actorFilter}
                onChange={(event) => setActorFilter(event.target.value)}
                className="mt-1 h-10 rounded-md border border-[#cfd6ca] bg-white px-3 text-sm"
              >
                <option value="all">すべて</option>
                <option value="system">システム</option>
                {actors.map((actor) => (
                  <option key={actor.id} value={actor.id}>
                    {actor.name ?? actor.email}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            onClick={() => void loadLogs()}
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
          <p className="text-sm font-bold text-[#2f5d50]">Audit Logs</p>
          <h2 className="mt-1 text-xl font-bold">操作履歴</h2>
        </div>
        <div className="p-5">
          {isLoading ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm text-[#5f6b5f]">
              読み込み中
            </div>
          ) : logs.length === 0 ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
              監査ログはありません
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((log) => {
                const href = targetHref(log);
                const afterJson = compactJson(log.after_json);
                const beforeJson = compactJson(log.before_json);
                const auditView = buildAuditView(log);
                return (
                  <div key={log.id} className="border border-[#e1e6dc] p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        {actionLabels[log.action] ?? log.action}
                      </span>
                      <span className="rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#4b5563]">
                        {targetTypeLabels[log.target_type] ?? log.target_type}
                      </span>
                      <span className="text-xs font-semibold text-[#6b7280]">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    <h3 className="mt-2 break-words text-base font-bold">
                      {auditView.summary}
                    </h3>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-[#6b7280]">
                      <span>
                        実行者: {log.actor_name ?? log.actor_email ?? "システム"}
                      </span>
                      {href ? (
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1 text-[#2f5d50]"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          対象を開く
                        </Link>
                      ) : null}
                      {afterJson || beforeJson ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((current) => (current === log.id ? null : log.id))
                          }
                          className="text-[#2f5d50]"
                        >
                          詳細
                        </button>
                      ) : null}
                    </div>
                    {expandedId === log.id ? (
                      <div className="mt-4 space-y-4 border-t border-[#e5e9df] pt-4">
                        {auditView.details.length > 0 ? (
                          <dl className="grid gap-3 md:grid-cols-2">
                            {auditView.details.map((detail) => (
                              <div
                                key={`${log.id}-${detail.label}`}
                                className="border border-[#e5e9df] bg-[#fbfcf8] px-3 py-2"
                              >
                                <dt className="text-xs font-bold text-[#6b7280]">
                                  {detail.label}
                                </dt>
                                <dd className="mt-1 break-words text-sm font-semibold text-[#1f2933]">
                                  {detail.value}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="text-sm font-semibold text-[#6b7280]">
                            表示できる詳細項目はありません
                          </p>
                        )}
                        <details>
                          <summary className="cursor-pointer text-xs font-bold text-[#2f5d50]">
                            技術ログを表示
                          </summary>
                          <div className="mt-3 grid gap-3 lg:grid-cols-2">
                            {beforeJson ? (
                              <div>
                                <p className="mb-1 text-xs font-bold text-[#4b5563]">
                                  変更前
                                </p>
                                <pre className="max-h-72 overflow-auto border border-[#e5e9df] bg-[#f7f8f5] p-3 text-xs leading-5">
                                  {beforeJson}
                                </pre>
                              </div>
                            ) : null}
                            {afterJson ? (
                              <div>
                                <p className="mb-1 text-xs font-bold text-[#4b5563]">
                                  変更後
                                </p>
                                <pre className="max-h-72 overflow-auto border border-[#e5e9df] bg-[#f7f8f5] p-3 text-xs leading-5">
                                  {afterJson}
                                </pre>
                              </div>
                            ) : null}
                          </div>
                        </details>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
