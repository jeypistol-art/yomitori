"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";

type JsonRecord = Record<string, unknown>;

type ReviewFile = {
  id: string;
  original_filename: string | null;
  mime_type: string;
  size_bytes: number | null;
};

type Member = {
  id: string;
  role: string;
  name: string | null;
  email: string;
};

type ReviewPayload = {
  document: {
    id: string;
    title: string;
    suggested_title: string | null;
    document_type: string;
    source_type: string;
    status: string;
    due_date: string | null;
    summary: string | null;
    created_at: string;
    approved_at: string | null;
  };
  files: ReviewFile[];
  assets: Array<{ id: string; name: string; asset_type: string }>;
  latest_extraction: {
    id: string;
    status: string;
    model: string;
    normalized_output: JsonRecord | null;
    overall_confidence: number | null;
  } | null;
  review_draft: {
    id: string;
    draft_json: JsonRecord;
    version: number;
    updated_at: string;
  } | null;
  members: Member[];
};

type ApiItem<T> = {
  data: T;
};

const documentTypeLabels: Record<string, string> = {
  municipal_notice: "行政・自治体通知",
  contract_renewal: "契約更新案内",
  lease_renewal: "リース契約更新",
  insurance_renewal: "保険満期案内",
  tenant_contract_renewal: "テナント契約更新",
  legal_change_notice: "法改正に伴う提出物",
  inspection_report: "点検報告",
  other: "その他",
  unknown: "未分類",
};

const priorityLabels: Record<string, string> = {
  low: "低",
  normal: "通常",
  high: "高",
  urgent: "至急",
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.map(asRecord) : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildInitialDraft(payload: ReviewPayload): JsonRecord {
  const source =
    payload.review_draft?.draft_json ??
    payload.latest_extraction?.normalized_output ??
    {};
  const draft = { ...source };
  const summary = { ...asRecord(draft.document_summary) };
  if (!summary.title_candidate) {
    summary.title_candidate = payload.document.suggested_title ?? payload.document.title;
  }
  if (!summary.one_line_summary && payload.document.summary) {
    summary.one_line_summary = payload.document.summary;
  }
  draft.document_summary = summary;

  const classification = { ...asRecord(draft.document_classification) };
  if (!classification.document_type) {
    classification.document_type = payload.document.document_type;
  }
  draft.document_classification = classification;
  return draft;
}

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

function DraftTextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#4b5563]">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full border border-[#d9ded3] bg-white px-3 text-sm outline-none focus:border-[#2f5d50]"
      />
    </label>
  );
}

function DraftTextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-[#4b5563]">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="mt-1 w-full resize-y border border-[#d9ded3] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2f5d50]"
      />
    </label>
  );
}

export default function DocumentReviewClient({ documentId }: { documentId: string }) {
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [draft, setDraft] = useState<JsonRecord>({});
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadReview = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const result = await fetchJson<ApiItem<ReviewPayload>>(
        `/api/documents/${documentId}/review`
      );
      setPayload(result.data);
      setDraft(buildInitialDraft(result.data));
      setSelectedFileId(result.data.files[0]?.id ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const selectedFile = useMemo(
    () => payload?.files.find((file) => file.id === selectedFileId) ?? payload?.files[0],
    [payload, selectedFileId]
  );

  const summary = asRecord(draft.document_summary);
  const classification = asRecord(draft.document_classification);
  const importantDates = asArray(draft.important_dates);
  const requiredDocuments = asArray(draft.required_documents);
  const taskCandidates = asArray(draft.task_candidates).length
    ? asArray(draft.task_candidates)
    : asArray(draft.required_actions);
  const risks = asArray(draft.risks_and_notes);
  const warnings = [
    ...asArray(draft.warnings).map((item) => asString(item.message) || JSON.stringify(item)),
    ...asArray(draft.missing_information).map(
      (item) => asString(item.message) || JSON.stringify(item)
    ),
  ].filter(Boolean);

  function updateSummary(key: string, value: unknown) {
    setDraft((current) => ({
      ...current,
      document_summary: {
        ...asRecord(current.document_summary),
        [key]: value,
      },
    }));
  }

  function updateClassification(key: string, value: unknown) {
    setDraft((current) => ({
      ...current,
      document_classification: {
        ...asRecord(current.document_classification),
        [key]: value,
      },
    }));
  }

  function updateArrayItem(arrayKey: string, index: number, key: string, value: unknown) {
    setDraft((current) => {
      const next = asArray(current[arrayKey]);
      next[index] = { ...next[index], [key]: value };
      return { ...current, [arrayKey]: next };
    });
  }

  function addTask() {
    setDraft((current) => ({
      ...current,
      task_candidates: [
        ...asArray(current.task_candidates),
        {
          title: "",
          description: "",
          due_date: "",
          priority: "normal",
          create_by_default: true,
          reminder_days_before: [7, 3, 1],
        },
      ],
    }));
  }

  async function saveDraft() {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/documents/${documentId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ draft }),
      });
      setMessage("下書きを保存しました");
      await loadReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function approveDocument() {
    setIsApproving(true);
    setError("");
    setMessage("");
    try {
      const result = await fetchJson<
        ApiItem<{ document: { status: string }; created_tasks: Array<{ id: string }> }>
      >(`/api/documents/${documentId}/approve`, {
        method: "POST",
        body: JSON.stringify({ draft, create_tasks: true }),
      });
      setMessage(
        `承認しました。作成タスク: ${result.data.created_tasks.length}件`
      );
      await loadReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "承認に失敗しました");
    } finally {
      setIsApproving(false);
    }
  }

  async function rerunExtraction() {
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/documents/${documentId}/extract`, { method: "POST" });
      setMessage("AI抽出を再実行しました");
      await loadReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI抽出に失敗しました");
    }
  }

  if (isLoading) {
    return (
      <div className="border border-dashed border-[#cfd6ca] bg-white px-4 py-16 text-center text-sm text-[#5f6b5f]">
        読み込み中
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
        {error || "書類を読み込めませんでした"}
      </div>
    );
  }

  const fileUrl = selectedFile
    ? `/api/documents/${documentId}/files/${selectedFile.id}`
    : "";

  return (
    <div className="space-y-4">
      <section className="sticky top-0 z-10 border border-[#d9ded3] bg-white px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                {payload.document.status}
              </span>
              <span className="rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#4b5563]">
                {documentTypeLabels[asString(classification.document_type)] ?? "未分類"}
              </span>
              {payload.latest_extraction?.overall_confidence ? (
                <span className="text-xs font-semibold text-[#6b7280]">
                  confidence {Math.round(payload.latest_extraction.overall_confidence * 100)}%
                </span>
              ) : null}
            </div>
            <h2 className="mt-2 break-words text-lg font-bold">
              {asString(summary.title_candidate) || payload.document.title}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void rerunExtraction()}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
            >
              <Sparkles className="h-4 w-4" />
              再解析
            </button>
            <button
              type="button"
              onClick={() => void saveDraft()}
              disabled={isSaving}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              下書き保存
            </button>
            <button
              type="button"
              onClick={() => void approveDocument()}
              disabled={isApproving}
              className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {isApproving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              承認してタスク作成
            </button>
          </div>
        </div>
        {message ? (
          <p className="mt-3 border border-[#cfe4d8] bg-[#f1faf4] px-3 py-2 text-sm font-semibold text-[#2f5d50]">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-3 border border-[#f1c9c3] bg-[#fff5f2] px-3 py-2 text-sm font-semibold text-[#9a3412]">
            {error}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(420px,0.85fr)]">
        <section className="border border-[#d9ded3] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9df] px-4 py-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
                Original
              </p>
              <h3 className="mt-1 text-base font-bold">原本プレビュー</h3>
            </div>
            <button
              type="button"
              onClick={() => void loadReview()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
            >
              <RefreshCw className="h-4 w-4" />
              更新
            </button>
          </div>

          {payload.files.length > 1 ? (
            <div className="flex flex-wrap gap-2 border-b border-[#e5e9df] px-4 py-3">
              {payload.files.map((file) => (
                <button
                  key={file.id}
                  type="button"
                  onClick={() => setSelectedFileId(file.id)}
                  className={`rounded-md border px-3 py-2 text-sm font-bold ${
                    selectedFile?.id === file.id
                      ? "border-[#2f5d50] bg-[#edf2e8] text-[#2f5d50]"
                      : "border-[#d9ded3] bg-white text-[#4b5563]"
                  }`}
                >
                  {file.original_filename ?? "原本"}
                </button>
              ))}
            </div>
          ) : null}

          <div className="min-h-[720px] bg-[#eef1ea] p-3">
            {!selectedFile ? (
              <div className="flex h-[680px] items-center justify-center border border-dashed border-[#cfd6ca] bg-white text-sm text-[#5f6b5f]">
                原本ファイルがありません
              </div>
            ) : selectedFile.mime_type === "application/pdf" ? (
              <iframe
                title="原本PDF"
                src={fileUrl}
                className="h-[720px] w-full border border-[#d9ded3] bg-white"
              />
            ) : selectedFile.mime_type.startsWith("image/") ? (
              <div className="flex min-h-[720px] items-start justify-center bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fileUrl}
                  alt={selectedFile.original_filename ?? "原本画像"}
                  className="max-h-[720px] max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-[680px] items-center justify-center border border-dashed border-[#cfd6ca] bg-white text-sm text-[#5f6b5f]">
                このファイル形式はプレビュー対象外です
              </div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          {warnings.length > 0 || payload.assets.length === 0 ? (
            <div className="border border-[#f1d3a8] bg-[#fff8eb] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-[#9a5b13]" />
                <div>
                  <h3 className="text-sm font-bold text-[#7c4a10]">要確認</h3>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-[#6b4a1f]">
                    {payload.assets.length === 0 ? (
                      <li>管理対象が未設定です。台帳で探しにくくなる可能性があります。</li>
                    ) : null}
                    {warnings.slice(0, 5).map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <div className="border border-[#d9ded3] bg-white p-4">
            <h3 className="text-base font-bold">書類基本情報</h3>
            <div className="mt-4 grid gap-3">
              <DraftTextField
                label="書類タイトル"
                value={asString(summary.title_candidate)}
                onChange={(value) => updateSummary("title_candidate", value)}
              />
              <label className="block">
                <span className="text-xs font-bold text-[#4b5563]">書類種別</span>
                <select
                  value={asString(classification.document_type) || "unknown"}
                  onChange={(event) =>
                    updateClassification("document_type", event.target.value)
                  }
                  className="mt-1 h-10 w-full border border-[#d9ded3] bg-white px-3 text-sm outline-none focus:border-[#2f5d50]"
                >
                  {Object.entries(documentTypeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <DraftTextArea
                label="要約"
                value={asString(summary.one_line_summary)}
                onChange={(value) => updateSummary("one_line_summary", value)}
                rows={3}
              />
              <DraftTextArea
                label="重要事項"
                value={asArray(summary.key_points)
                  .map((point) => asString(point.text))
                  .filter(Boolean)
                  .join("\n")}
                onChange={(value) =>
                  updateSummary(
                    "key_points",
                    splitLines(value).map((text) => ({ text }))
                  )
                }
                rows={5}
              />
            </div>
          </div>

          <div className="border border-[#d9ded3] bg-white p-4">
            <h3 className="text-base font-bold">期限</h3>
            <div className="mt-3 space-y-3">
              {importantDates.length === 0 ? (
                <p className="text-sm text-[#6b7280]">期限候補はありません</p>
              ) : (
                importantDates.map((item, index) => (
                  <div key={index} className="grid gap-2 border border-[#e5e9df] p-3">
                    <DraftTextField
                      label="ラベル"
                      value={asString(item.label)}
                      onChange={(value) =>
                        updateArrayItem("important_dates", index, "label", value)
                      }
                    />
                    <DraftTextField
                      label="日付"
                      value={asString(item.date)}
                      onChange={(value) =>
                        updateArrayItem("important_dates", index, "date", value)
                      }
                      placeholder="YYYY-MM-DD"
                    />
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#4b5563]">
                      <input
                        type="checkbox"
                        checked={item.is_primary_due_date === true}
                        onChange={(event) =>
                          updateArrayItem(
                            "important_dates",
                            index,
                            "is_primary_due_date",
                            event.target.checked
                          )
                        }
                      />
                      主期限として採用
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border border-[#d9ded3] bg-white p-4">
            <h3 className="text-base font-bold">提出物</h3>
            <div className="mt-3 space-y-3">
              {requiredDocuments.length === 0 ? (
                <p className="text-sm text-[#6b7280]">提出物候補はありません</p>
              ) : (
                requiredDocuments.map((item, index) => (
                  <div key={index} className="grid gap-2 border border-[#e5e9df] p-3">
                    <DraftTextField
                      label="提出物名"
                      value={asString(item.name)}
                      onChange={(value) =>
                        updateArrayItem("required_documents", index, "name", value)
                      }
                    />
                    <DraftTextField
                      label="提出先"
                      value={asString(item.submit_to)}
                      onChange={(value) =>
                        updateArrayItem("required_documents", index, "submit_to", value)
                      }
                    />
                    <DraftTextField
                      label="期限"
                      value={asString(item.due_date)}
                      onChange={(value) =>
                        updateArrayItem("required_documents", index, "due_date", value)
                      }
                      placeholder="YYYY-MM-DD"
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border border-[#d9ded3] bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold">タスク候補</h3>
              <button
                type="button"
                onClick={addTask}
                className="rounded-md border border-[#d9ded3] px-3 py-2 text-sm font-bold text-[#2f5d50]"
              >
                追加
              </button>
            </div>
            <div className="mt-3 space-y-3">
              {taskCandidates.length === 0 ? (
                <p className="text-sm text-[#6b7280]">タスク候補はありません</p>
              ) : (
                taskCandidates.map((task, index) => (
                  <div key={index} className="grid gap-2 border border-[#e5e9df] p-3">
                    <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#4b5563]">
                      <input
                        type="checkbox"
                        checked={task.create_by_default !== false}
                        onChange={(event) =>
                          updateArrayItem(
                            asArray(draft.task_candidates).length
                              ? "task_candidates"
                              : "required_actions",
                            index,
                            "create_by_default",
                            event.target.checked
                          )
                        }
                      />
                      承認時に作成
                    </label>
                    <DraftTextField
                      label="タスク名"
                      value={asString(task.title)}
                      onChange={(value) =>
                        updateArrayItem(
                          asArray(draft.task_candidates).length
                            ? "task_candidates"
                            : "required_actions",
                          index,
                          "title",
                          value
                        )
                      }
                    />
                    <DraftTextArea
                      label="説明"
                      value={asString(task.description)}
                      onChange={(value) =>
                        updateArrayItem(
                          asArray(draft.task_candidates).length
                            ? "task_candidates"
                            : "required_actions",
                          index,
                          "description",
                          value
                        )
                      }
                      rows={2}
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <DraftTextField
                        label="期限"
                        value={asString(task.due_date)}
                        onChange={(value) =>
                          updateArrayItem(
                            asArray(draft.task_candidates).length
                              ? "task_candidates"
                              : "required_actions",
                            index,
                            "due_date",
                            value
                          )
                        }
                        placeholder="YYYY-MM-DD"
                      />
                      <label className="block">
                        <span className="text-xs font-bold text-[#4b5563]">優先度</span>
                        <select
                          value={asString(task.priority) || "normal"}
                          onChange={(event) =>
                            updateArrayItem(
                              asArray(draft.task_candidates).length
                                ? "task_candidates"
                                : "required_actions",
                              index,
                              "priority",
                              event.target.value
                            )
                          }
                          className="mt-1 h-10 w-full border border-[#d9ded3] bg-white px-3 text-sm outline-none focus:border-[#2f5d50]"
                        >
                          {Object.entries(priorityLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs font-bold text-[#4b5563]">担当者</span>
                        <select
                          value={asString(task.assignee_member_id)}
                          onChange={(event) =>
                            updateArrayItem(
                              asArray(draft.task_candidates).length
                                ? "task_candidates"
                                : "required_actions",
                              index,
                              "assignee_member_id",
                              event.target.value
                            )
                          }
                          className="mt-1 h-10 w-full border border-[#d9ded3] bg-white px-3 text-sm outline-none focus:border-[#2f5d50]"
                        >
                          <option value="">未設定</option>
                          {payload.members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name ?? member.email}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="border border-[#d9ded3] bg-white p-4">
            <h3 className="text-base font-bold">リスク・注意点</h3>
            <DraftTextArea
              label="注意点"
              value={risks
                .map((risk) => asString(risk.title) || asString(risk.description))
                .filter(Boolean)
                .join("\n")}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  risks_and_notes: splitLines(value).map((title) => ({ title })),
                }))
              }
              rows={4}
            />
          </div>

          <div className="sticky bottom-0 border border-[#d9ded3] bg-white p-4 shadow-lg">
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => void saveDraft()}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                下書き保存
              </button>
              <button
                type="button"
                onClick={() => void approveDocument()}
                disabled={isApproving}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                承認してタスク作成
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
