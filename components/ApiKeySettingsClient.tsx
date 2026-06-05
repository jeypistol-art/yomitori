"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Copy,
  KeyRound,
  Loader2,
  Pencil,
  RefreshCw,
  Save,
  Trash2,
  X,
} from "lucide-react";

type ApiKeyScope = "documents:read" | "tasks:read" | "webhooks:read";

type ApiKey = {
  id: string;
  name: string;
  key_preview: string | null;
  scopes: ApiKeyScope[];
  is_enabled: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  new_key?: string;
};

type ApiList<T> = {
  data: T[];
};

type ApiItem<T> = {
  data: T;
};

const apiScopes: Array<{
  scope: ApiKeyScope;
  label: string;
  description: string;
}> = [
  {
    scope: "documents:read",
    label: "書類の参照",
    description: "書類メタデータを外部システムから参照します。",
  },
  {
    scope: "tasks:read",
    label: "タスクの参照",
    description: "タスク一覧と対応状況を外部システムから参照します。",
  },
  {
    scope: "webhooks:read",
    label: "Webhook履歴の参照",
    description: "配信履歴と連携状態を外部システムから参照します。",
  },
];

const emptyForm = {
  name: "",
  scopes: ["documents:read", "tasks:read"] as ApiKeyScope[],
  is_enabled: true,
  expires_at: "",
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

function formatDate(value: string | null) {
  if (!value) {
    return "未設定";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString().slice(0, 10);
}

export default function ApiKeySettingsClient() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await fetchJson<ApiList<ApiKey>>("/api/api-keys");
      setApiKeys(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "APIキーを読み込めませんでした");
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

  function editApiKey(apiKey: ApiKey) {
    setEditingId(apiKey.id);
    setForm({
      name: apiKey.name,
      scopes: apiKey.scopes,
      is_enabled: apiKey.is_enabled,
      expires_at: toDateInputValue(apiKey.expires_at),
    });
  }

  function toggleScope(scope: ApiKeyScope) {
    setForm((current) => {
      const exists = current.scopes.includes(scope);
      return {
        ...current,
        scopes: exists
          ? current.scopes.filter((item) => item !== scope)
          : [...current.scopes, scope],
      };
    });
  }

  async function saveApiKey() {
    setIsSaving(true);
    setError("");
    setMessage("");
    setNewKey("");
    try {
      const method = editingId ? "PATCH" : "POST";
      const url = editingId ? `/api/api-keys/${editingId}` : "/api/api-keys";
      const payload = await fetchJson<ApiItem<ApiKey>>(url, {
        method,
        body: JSON.stringify({
          ...form,
          expires_at: form.expires_at || null,
        }),
      });
      setApiKeys((current) => {
        if (editingId) {
          return current.map((item) =>
            item.id === editingId ? payload.data : item
          );
        }
        return [payload.data, ...current];
      });
      if (payload.data.new_key) {
        setNewKey(payload.data.new_key);
      }
      setMessage(editingId ? "APIキーを更新しました" : "APIキーを作成しました");
      if (!editingId) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function revokeApiKey(apiKey: ApiKey) {
    if (!window.confirm(`${apiKey.name} を失効しますか。`)) {
      return;
    }
    setWorkingId(apiKey.id);
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/api-keys/${apiKey.id}`, { method: "DELETE" });
      setApiKeys((current) => current.filter((item) => item.id !== apiKey.id));
      setMessage("APIキーを失効しました");
      if (editingId === apiKey.id) {
        resetForm();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "失効に失敗しました");
    } finally {
      setWorkingId(null);
    }
  }

  async function copyNewKey() {
    if (!newKey) {
      return;
    }
    await navigator.clipboard.writeText(newKey);
    setMessage("APIキーをコピーしました");
  }

  return (
    <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
      <div className="space-y-5">
        <section className="border border-[#d9ded3] bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[#2f5d50]">API Keys</p>
              <h2 className="mt-1 text-xl font-bold">
                {editingId ? "APIキーを編集" : "APIキーを作成"}
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
                placeholder="例: 社内BI連携"
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
            </label>

            <fieldset>
              <legend className="text-sm font-semibold">権限スコープ</legend>
              <div className="mt-2 grid gap-2">
                {apiScopes.map((item) => (
                  <label
                    key={item.scope}
                    className="rounded-md border border-[#e1e6dc] px-3 py-2 text-sm"
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      <input
                        type="checkbox"
                        checked={form.scopes.includes(item.scope)}
                        onChange={() => toggleScope(item.scope)}
                        className="h-4 w-4"
                      />
                      {item.label}
                    </span>
                    <span className="mt-1 block pl-6 font-mono text-xs text-[#6b7280]">
                      {item.scope}
                    </span>
                    <span className="mt-1 block pl-6 text-xs leading-5 text-[#6b7280]">
                      {item.description}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="block text-sm font-semibold">
              有効期限
              <input
                type="date"
                value={form.expires_at}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expires_at: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
              <span className="mt-1 block text-xs leading-5 text-[#6b7280]">
                空欄の場合、有効期限なしで作成します。
              </span>
            </label>

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
              onClick={() => void saveApiKey()}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {editingId ? "保存" : "作成"}
            </button>
          </div>
        </section>

        {newKey ? (
          <section className="border border-[#f0d6a8] bg-[#fff8eb] p-5">
            <p className="text-sm font-bold text-[#9a5b13]">新しいAPIキー</p>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              この値は今だけ表示されます。連携先へ設定したら、安全な場所に保管してください。
            </p>
            <code className="mt-3 block break-all border border-[#f0d6a8] bg-white px-3 py-2 text-xs font-bold text-[#1f2933]">
              {newKey}
            </code>
            <button
              type="button"
              onClick={() => void copyNewKey()}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-[#f0d6a8] bg-white px-3 text-sm font-bold text-[#9a5b13]"
            >
              <Copy className="h-4 w-4" />
              コピー
            </button>
          </section>
        ) : null}
      </div>

      <section className="border border-[#d9ded3] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
          <div>
            <p className="text-sm font-bold text-[#2f5d50]">Keys</p>
            <h2 className="mt-1 text-xl font-bold">APIキー一覧</h2>
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
          ) : apiKeys.length === 0 ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
              APIキーは未作成です
            </div>
          ) : (
            apiKeys.map((apiKey) => (
              <article
                key={apiKey.id}
                className={
                  editingId === apiKey.id
                    ? "border-2 border-[#2f5d50] bg-[#f1faf4] p-4"
                    : "border border-[#e1e6dc] bg-white p-4"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <KeyRound className="h-4 w-4 text-[#2f5d50]" />
                      <h3 className="break-words text-base font-bold">
                        {apiKey.name}
                      </h3>
                      <span
                        className={
                          apiKey.is_enabled
                            ? "rounded bg-[#edf7ef] px-2 py-1 text-xs font-bold text-[#24613f]"
                            : "rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#6b7280]"
                        }
                      >
                        {apiKey.is_enabled ? "有効" : "停止中"}
                      </span>
                    </div>
                    <p className="mt-2 font-mono text-xs font-bold text-[#6b7280]">
                      {apiKey.key_preview}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {apiKey.scopes.map((scope) => (
                        <span
                          key={scope}
                          className="rounded bg-[#edf2e8] px-2 py-1 font-mono text-xs font-bold text-[#2f5d50]"
                        >
                          {scope}
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 text-xs text-[#6b7280]">
                      最終利用: {formatDate(apiKey.last_used_at)} / 有効期限:{" "}
                      {formatDate(apiKey.expires_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      title="編集"
                      onClick={() => editApiKey(apiKey)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d9ded3] text-[#2f5d50]"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      title="失効"
                      disabled={workingId === apiKey.id}
                      onClick={() => void revokeApiKey(apiKey)}
                      className="flex h-9 w-9 items-center justify-center rounded-md border border-[#f1c9c3] text-[#b42318] disabled:opacity-60"
                    >
                      {workingId === apiKey.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </section>
  );
}
