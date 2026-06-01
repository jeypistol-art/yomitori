"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";

type WebhookEventType =
  | "document.created"
  | "document.extraction_succeeded"
  | "document.approved"
  | "task.created"
  | "reminder.sent";

type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  event_types: WebhookEventType[];
  is_enabled: boolean;
  secret_preview: string | null;
  new_secret?: string;
  created_at: string;
  updated_at: string;
};

type WebhookDelivery = {
  id: string;
  endpoint_id: string;
  endpoint_name: string;
  event_id: string;
  event_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
  delivered_at: string | null;
  response_status: number | null;
  error_message: string | null;
  created_at: string;
};

type ApiList<T> = {
  data: T[];
};

type ApiItem<T> = {
  data: T;
};

const webhookEvents: Array<{
  event: WebhookEventType;
  label: string;
}> = [
  { event: "document.created", label: "書類登録" },
  { event: "document.extraction_succeeded", label: "AI抽出完了" },
  { event: "document.approved", label: "承認完了" },
  { event: "task.created", label: "タスク作成" },
  { event: "reminder.sent", label: "リマインド送信" },
];

const emptyForm = {
  name: "",
  url: "",
  event_types: ["document.approved", "task.created"] as WebhookEventType[],
  is_enabled: true,
};

const deliveryStatusLabels: Record<string, string> = {
  queued: "待機中",
  succeeded: "成功",
  failed: "再送待ち",
  dead: "停止",
};

const deliveryStatusClassNames: Record<string, string> = {
  queued: "bg-[#edf0f2] text-[#4b5563]",
  succeeded: "bg-[#edf7ef] text-[#24613f]",
  failed: "bg-[#fff8eb] text-[#9a5b13]",
  dead: "bg-[#fff1f0] text-[#9f352c]",
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "未設定";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function WebhookSettingsClient() {
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSecret, setNewSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedEndpoint = useMemo(
    () => endpoints.find((endpoint) => endpoint.id === editingId) ?? null,
    [editingId, endpoints]
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [endpointPayload, deliveryPayload] = await Promise.all([
        fetchJson<ApiList<WebhookEndpoint>>("/api/webhook-endpoints"),
        fetchJson<ApiList<WebhookDelivery>>("/api/webhook-deliveries"),
      ]);
      setEndpoints(endpointPayload.data);
      setDeliveries(deliveryPayload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Webhook設定を読み込めませんでした");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function editEndpoint(endpoint: WebhookEndpoint) {
    setEditingId(endpoint.id);
    setForm({
      name: endpoint.name,
      url: endpoint.url,
      event_types: endpoint.event_types,
      is_enabled: endpoint.is_enabled,
    });
  }

  function toggleEvent(eventType: WebhookEventType) {
    setForm((current) => {
      const exists = current.event_types.includes(eventType);
      return {
        ...current,
        event_types: exists
          ? current.event_types.filter((item) => item !== eventType)
          : [...current.event_types, eventType],
      };
    });
  }

  async function saveEndpoint(rotateSecret = false) {
    setIsSaving(true);
    setError("");
    setMessage("");
    setNewSecret("");
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId
        ? `/api/webhook-endpoints/${editingId}`
        : "/api/webhook-endpoints";
      const payload = await fetchJson<ApiItem<WebhookEndpoint>>(url, {
        method,
        body: JSON.stringify({
          ...form,
          rotate_secret: rotateSecret,
        }),
      });
      setEndpoints((current) => {
        if (editingId) {
          return current.map((item) =>
            item.id === editingId ? payload.data : item
          );
        }
        return [payload.data, ...current];
      });
      if (payload.data.new_secret) {
        setNewSecret(payload.data.new_secret);
      }
      setMessage(editingId ? "Webhook送信先を更新しました" : "Webhook送信先を追加しました");
      if (!editingId) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteEndpoint(endpoint: WebhookEndpoint) {
    if (!window.confirm(`${endpoint.name} を削除しますか。`)) {
      return;
    }
    setWorkingId(endpoint.id);
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/webhook-endpoints/${endpoint.id}`, { method: "DELETE" });
      setEndpoints((current) => current.filter((item) => item.id !== endpoint.id));
      setMessage("Webhook送信先を削除しました");
      if (editingId === endpoint.id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    } finally {
      setWorkingId(null);
    }
  }

  async function retryDelivery(delivery: WebhookDelivery) {
    setWorkingId(delivery.id);
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/webhook-deliveries/${delivery.id}/retry`, {
        method: "POST",
      });
      setMessage("Webhook配信を再送待ちに戻しました");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "再送設定に失敗しました");
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <section className="border border-[#d9ded3] bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#2f5d50]">Endpoint</p>
              <h2 className="mt-1 text-xl font-bold">
                {editingId ? "送信先を編集" : "送信先を追加"}
              </h2>
            </div>
            {editingId ? (
              <button
                type="button"
                title="編集を解除"
                onClick={resetForm}
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d9ded3] text-[#4b5563]"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="space-y-4">
            <label className="block text-sm font-semibold">
              名前
              <input
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="例: 社内管理システム"
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
            </label>
            <label className="block text-sm font-semibold">
              送信先URL
              <input
                value={form.url}
                onChange={(event) =>
                  setForm((current) => ({ ...current, url: event.target.value }))
                }
                placeholder="https://example.com/webhooks/yomitori"
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
              <span className="mt-1 block text-xs leading-5 text-[#6b7280]">
                HTTPSのURLのみ登録できます。
              </span>
            </label>

            <fieldset>
              <legend className="text-sm font-semibold">通知イベント</legend>
              <div className="mt-2 grid gap-2">
                {webhookEvents.map((item) => (
                  <label
                    key={item.event}
                    className="flex items-center gap-2 rounded-md border border-[#e1e6dc] px-3 py-2 text-sm font-semibold"
                  >
                    <input
                      type="checkbox"
                      checked={form.event_types.includes(item.event)}
                      onChange={() => toggleEvent(item.event)}
                      className="h-4 w-4"
                    />
                    <span>{item.label}</span>
                    <span className="font-mono text-xs text-[#6b7280]">
                      {item.event}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={form.is_enabled}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    is_enabled: event.target.checked,
                  }))
                }
                className="h-4 w-4"
              />
              有効にする
            </label>

            <button
              type="button"
              disabled={isSaving}
              onClick={() => void saveEndpoint(false)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingId ? "保存" : "追加"}
            </button>

            {editingId ? (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => void saveEndpoint(true)}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-md border border-[#d9ded3] px-4 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
              >
                <KeyRound className="h-4 w-4" />
                シークレットを再発行して保存
              </button>
            ) : null}
          </div>
        </section>

        {newSecret ? (
          <section className="border border-[#f0d6a8] bg-[#fff8eb] p-5">
            <p className="text-sm font-bold text-[#9a5b13]">
              Webhookシークレット
            </p>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              この値は今だけ表示されます。受信側の署名検証に設定してください。
            </p>
            <code className="mt-3 block break-all border border-[#f0d6a8] bg-white px-3 py-2 text-xs font-bold text-[#1f2933]">
              {newSecret}
            </code>
          </section>
        ) : null}
      </div>

      <div className="space-y-5">
        <section className="border border-[#d9ded3] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
            <div>
              <p className="text-sm font-bold text-[#2f5d50]">Endpoints</p>
              <h2 className="mt-1 text-xl font-bold">送信先一覧</h2>
            </div>
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
            <p className="mx-5 mt-4 border border-[#cde5d5] bg-[#f1faf4] px-4 py-3 text-sm font-semibold text-[#24613f]">
              {message}
            </p>
          ) : null}
          {error ? (
            <p className="mx-5 mt-4 border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
              {error}
            </p>
          ) : null}
          <div className="space-y-3 p-5">
            {isLoading ? (
              <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm text-[#5f6b5f]">
                読み込み中
              </div>
            ) : endpoints.length === 0 ? (
              <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
                Webhook送信先は未登録です
              </div>
            ) : (
              endpoints.map((endpoint) => (
                <article
                  key={endpoint.id}
                  className={
                    selectedEndpoint?.id === endpoint.id
                      ? "border-2 border-[#2f5d50] bg-[#f1faf4] p-4"
                      : "border border-[#e1e6dc] bg-white p-4"
                  }
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-bold">
                          {endpoint.name}
                        </h3>
                        <span
                          className={
                            endpoint.is_enabled
                              ? "rounded bg-[#edf7ef] px-2 py-1 text-xs font-bold text-[#24613f]"
                              : "rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#6b7280]"
                          }
                        >
                          {endpoint.is_enabled ? "有効" : "停止中"}
                        </span>
                      </div>
                      <p className="mt-1 break-all text-xs font-semibold text-[#6b7280]">
                        {endpoint.url}
                      </p>
                      <p className="mt-2 text-xs font-semibold text-[#6b7280]">
                        Secret: {endpoint.secret_preview}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {endpoint.event_types.map((eventType) => (
                          <span
                            key={eventType}
                            className="rounded bg-[#edf2e8] px-2 py-1 font-mono text-xs font-bold text-[#2f5d50]"
                          >
                            {eventType}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        title="編集"
                        onClick={() => editEndpoint(endpoint)}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d9ded3] text-[#2f5d50]"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        title="削除"
                        disabled={workingId === endpoint.id}
                        onClick={() => void deleteEndpoint(endpoint)}
                        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#f1c9c3] text-[#b42318] disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="border border-[#d9ded3] bg-white">
          <div className="border-b border-[#e5e9df] px-5 py-4">
            <p className="text-sm font-bold text-[#2f5d50]">Deliveries</p>
            <h2 className="mt-1 text-xl font-bold">配信履歴</h2>
          </div>
          <div className="space-y-3 p-5">
            {deliveries.length === 0 ? (
              <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
                配信履歴はまだありません
              </div>
            ) : (
              deliveries.map((delivery) => (
                <article key={delivery.id} className="border border-[#e1e6dc] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-2 py-1 text-xs font-bold ${
                            deliveryStatusClassNames[delivery.status] ??
                            "bg-[#edf0f2] text-[#4b5563]"
                          }`}
                        >
                          {deliveryStatusLabels[delivery.status] ?? delivery.status}
                        </span>
                        {delivery.response_status ? (
                          <span className="text-xs font-bold text-[#6b7280]">
                            HTTP {delivery.response_status}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 font-mono text-xs font-bold text-[#2f5d50]">
                        {delivery.event_type}
                      </p>
                      <h3 className="mt-1 break-words text-sm font-bold">
                        {delivery.endpoint_name}
                      </h3>
                      <p className="mt-1 text-xs text-[#6b7280]">
                        {formatDateTime(delivery.created_at)} / {delivery.attempt_count}
                        /{delivery.max_attempts}回
                      </p>
                      {delivery.error_message ? (
                        <p className="mt-2 break-words text-xs font-semibold text-[#9f352c]">
                          {delivery.error_message}
                        </p>
                      ) : null}
                    </div>
                    {["failed", "dead"].includes(delivery.status) ? (
                      <button
                        type="button"
                        disabled={workingId === delivery.id}
                        onClick={() => void retryDelivery(delivery)}
                        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
                      >
                        {workingId === delivery.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                        再送待ちへ
                      </button>
                    ) : delivery.status === "succeeded" ? (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-[#24613f]" />
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </section>
  );
}
