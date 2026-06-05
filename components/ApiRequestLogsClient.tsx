"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";

type ApiRequestLog = {
  id: string;
  api_key_id: string | null;
  api_key_name: string | null;
  method: string;
  path: string;
  query_string: string | null;
  required_scope: string | null;
  status_code: number;
  duration_ms: number;
  ip_address: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
};

type ApiList<T> = {
  data: T[];
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

function formatDateTime(value: string) {
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

function statusClassName(statusCode: number) {
  if (statusCode >= 200 && statusCode < 300) {
    return "bg-[#edf7ef] text-[#24613f]";
  }
  if (statusCode >= 400 && statusCode < 500) {
    return "bg-[#fff8eb] text-[#9a5b13]";
  }
  return "bg-[#fff1f0] text-[#9f352c]";
}

export default function ApiRequestLogsClient() {
  const [logs, setLogs] = useState<ApiRequestLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const payload = await fetchJson<ApiList<ApiRequestLog>>(
        "/api/api-request-logs?limit=100"
      );
      setLogs(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "API利用ログを読み込めませんでした");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  return (
    <section className="border border-[#d9ded3] bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
        <div>
          <p className="text-sm font-bold text-[#2f5d50]">API Usage Logs</p>
          <h2 className="mt-1 text-xl font-bold">API利用ログ</h2>
          <p className="mt-2 text-sm leading-6 text-[#4b5563]">
            APIキー経由の外部APIアクセスを記録します。監査と連携先の切り分けに使います。
          </p>
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
        <p className="mx-5 mt-4 border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
          {error}
        </p>
      ) : null}

      <div className="space-y-3 p-5">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm text-[#5f6b5f]">
            <Loader2 className="h-4 w-4 animate-spin" />
            読み込み中
          </div>
        ) : logs.length === 0 ? (
          <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
            API利用ログはまだありません
          </div>
        ) : (
          logs.map((log) => (
            <article key={log.id} className="border border-[#e1e6dc] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {log.status_code >= 200 && log.status_code < 300 ? (
                      <CheckCircle2 className="h-4 w-4 text-[#24613f]" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-[#9a5b13]" />
                    )}
                    <span
                      className={`rounded px-2 py-1 text-xs font-bold ${statusClassName(
                        log.status_code
                      )}`}
                    >
                      HTTP {log.status_code}
                    </span>
                    <span className="rounded bg-[#edf2e8] px-2 py-1 font-mono text-xs font-bold text-[#2f5d50]">
                      {log.method}
                    </span>
                    {log.required_scope ? (
                      <span className="rounded bg-[#f3f4f6] px-2 py-1 font-mono text-xs font-bold text-[#4b5563]">
                        {log.required_scope}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-2 break-all font-mono text-sm font-bold">
                    {log.path}
                    {log.query_string ? `?${log.query_string}` : ""}
                  </h3>
                  <p className="mt-2 text-xs leading-5 text-[#6b7280]">
                    {log.api_key_name ?? "APIキー不明"} / {log.duration_ms}ms /{" "}
                    {formatDateTime(log.created_at)}
                  </p>
                  {log.error_message ? (
                    <p className="mt-2 break-words text-xs font-semibold text-[#9f352c]">
                      {log.error_message}
                    </p>
                  ) : null}
                </div>
                {log.ip_address ? (
                  <p className="shrink-0 font-mono text-xs text-[#6b7280]">
                    {log.ip_address}
                  </p>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
