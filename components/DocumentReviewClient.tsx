"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  GitCompareArrows,
  LockKeyhole,
  Loader2,
  RefreshCw,
  Save,
  Sparkles,
  Trash2,
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

type ManagedAsset = {
  id: string;
  asset_type: string;
  name: string;
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
    source_text: string | null;
    created_at: string;
    approved_at: string | null;
    duplicate_count?: number;
  };
  files: ReviewFile[];
  assets: Array<{ id: string; name: string; asset_type: string }>;
  managed_assets: ManagedAsset[];
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

type DocumentDiffStatus = "added" | "removed" | "changed" | "unchanged";

type DocumentDiffMatch = {
  reason: string;
  asset_overlap_count: number;
  same_counterparty: boolean;
  same_type: boolean;
  manual: boolean;
};

type DocumentDiffCandidate = {
  id: string;
  title: string;
  document_type: string;
  status: string;
  created_at: string;
  approved_at: string | null;
  counterparty_name: string | null;
  match: DocumentDiffMatch;
};

type DocumentDiffPayload = {
  previous_document: {
    id: string;
    title: string;
    document_type: string;
    status: string;
    created_at: string;
    approved_at: string | null;
    counterparty_name: string | null;
    assets: Array<{ id: string; name: string; asset_type: string }>;
  } | null;
  candidates: DocumentDiffCandidate[];
  match: DocumentDiffMatch | null;
  scalar_changes: Array<{
    key: string;
    label: string;
    previous: string;
    current: string;
    status: DocumentDiffStatus;
  }>;
  list_changes: Array<{
    key: string;
    label: string;
    added: string[];
    removed: string[];
    unchanged: string[];
    previous_count: number;
    current_count: number;
  }>;
  summary: {
    changed_count: number;
    added_count: number;
    removed_count: number;
    unchanged_count: number;
  };
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

const assetTypeLabels: Record<string, string> = {
  property: "物件",
  facility: "施設",
  store: "店舗",
  tenant: "テナント",
  office: "事務所",
  other: "その他",
};

const diffStatusLabels: Record<DocumentDiffStatus, string> = {
  added: "追加",
  removed: "削除",
  changed: "変更",
  unchanged: "同じ",
};

const diffStatusClassNames: Record<DocumentDiffStatus, string> = {
  added: "bg-[#edf7ef] text-[#24613f]",
  removed: "bg-[#fff1f0] text-[#9f352c]",
  changed: "bg-[#fff8eb] text-[#9a5b13]",
  unchanged: "bg-[#f3f4f6] text-[#4b5563]",
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

function asUnknownArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function firstString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return "";
}

function firstDateString(record: JsonRecord) {
  return firstString(record, ["date", "due_date", "deadline", "期限", "重要な日付"]);
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDateTime(value: string | null) {
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

function noticeText(value: unknown) {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (isRecord(parsed)) {
        return noticeText(parsed);
      }
    } catch {
      return value;
    }
    return value;
  }
  return (
    firstString(asRecord(value), [
      "message",
      "warning",
      "text",
      "description",
      "note",
      "content",
      "risk",
      "注意",
      "理由",
    ]) || JSON.stringify(value)
  );
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

function stripTeamAssignees(draft: JsonRecord): JsonRecord {
  const next = { ...draft };
  for (const key of ["task_candidates", "required_actions"]) {
    const items = asArray(next[key]);
    if (items.length > 0) {
      next[key] = items.map((item) => ({
        ...item,
        assignee_member_id: "",
      }));
    }
  }
  return next;
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

function DocumentDiffPanel({
  canUseDocumentDiff,
  diff,
  error,
  isLoading,
  onSelectCompareDocumentId,
  selectedCompareDocumentId,
}: {
  canUseDocumentDiff: boolean;
  diff: DocumentDiffPayload | null;
  error: string;
  isLoading: boolean;
  onSelectCompareDocumentId: (documentId: string) => void;
  selectedCompareDocumentId: string;
}) {
  if (!canUseDocumentDiff) {
    return (
      <div className="border border-[#e1e6dc] bg-[#f4f5f1] p-4">
        <div className="flex items-start gap-3">
          <LockKeyhole className="mt-0.5 h-5 w-5 text-[#5f6b5f]" />
          <div>
            <h3 className="text-base font-bold">過去書類との差分</h3>
            <p className="mt-2 text-sm leading-6 text-[#5f6b5f]">
              前回書類との差分確認はProプラン以上で利用できます。
              期限、提出物、注意点の変化を承認画面で確認できる機能です。
            </p>
            <Link
              href="/usage"
              className="mt-3 inline-flex text-sm font-bold text-[#2f5d50]"
            >
              プランを見る
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="border border-[#d9ded3] bg-white p-4">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-[#2f5d50]">
          <Loader2 className="h-4 w-4 animate-spin" />
          過去書類との差分を確認中
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-[#f1c9c3] bg-[#fff5f2] p-4">
        <h3 className="text-base font-bold text-[#9a3412]">過去書類との差分</h3>
        <p className="mt-2 text-sm leading-6 text-[#9a3412]">{error}</p>
      </div>
    );
  }

  const candidates = diff?.candidates ?? [];
  const candidateSelector = candidates.length > 0 ? (
    <label className="mt-4 block">
      <span className="text-xs font-bold text-[#4b5563]">比較対象を選択</span>
      <select
        value={selectedCompareDocumentId}
        onChange={(event) => onSelectCompareDocumentId(event.target.value)}
        className="mt-1 h-10 w-full border border-[#d9ded3] bg-white px-3 text-sm outline-none focus:border-[#2f5d50]"
      >
        <option value="">自動選択</option>
        {candidates.map((candidate) => (
          <option key={candidate.id} value={candidate.id}>
            {formatDateTime(candidate.created_at)} / {candidate.title} /{" "}
            {candidate.match.reason}
          </option>
        ))}
      </select>
    </label>
  ) : null;

  if (!diff?.previous_document) {
    return (
      <div className="border border-[#d9ded3] bg-white p-4">
        <div className="flex items-start gap-3">
          <GitCompareArrows className="mt-0.5 h-5 w-5 text-[#2f5d50]" />
          <div>
            <h3 className="text-base font-bold">過去書類との差分</h3>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              {candidates.length > 0
                ? "自動で一致する過去書類は見つかりませんでした。必要に応じて比較対象を手動で選択できます。"
                : "比較できる過去書類はまだありません。同じ管理対象、取引先、書類種別の過去書類が登録されると、ここに差分が表示されます。"}
            </p>
          </div>
        </div>
        {candidateSelector}
      </div>
    );
  }

  const changedScalars = diff.scalar_changes.filter(
    (item) => item.status !== "unchanged"
  );
  const changedLists = diff.list_changes.filter(
    (item) => item.added.length > 0 || item.removed.length > 0
  );
  const hasChanges = changedScalars.length > 0 || changedLists.length > 0;

  return (
    <div className="border border-[#d9ded3] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <GitCompareArrows className="mt-0.5 h-5 w-5 text-[#2f5d50]" />
          <div>
            <h3 className="text-base font-bold">過去書類との差分</h3>
            <p className="mt-1 text-sm leading-6 text-[#4b5563]">
              比較対象:
              <Link
                href={`/documents/${diff.previous_document.id}/review`}
                className="ml-1 font-bold text-[#2f5d50]"
              >
                {diff.previous_document.title}
              </Link>
            </p>
            <p className="text-xs font-semibold text-[#6b7280]">
              {formatDateTime(diff.previous_document.created_at)}
              {diff.match?.reason ? ` / ${diff.match.reason}` : ""}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
          <div className="bg-[#fff8eb] px-2 py-1 text-[#9a5b13]">
            変更 {diff.summary.changed_count}
          </div>
          <div className="bg-[#edf7ef] px-2 py-1 text-[#24613f]">
            追加 {diff.summary.added_count}
          </div>
          <div className="bg-[#fff1f0] px-2 py-1 text-[#9f352c]">
            削除 {diff.summary.removed_count}
          </div>
        </div>
      </div>

      {candidateSelector}

      {!hasChanges ? (
        <p className="mt-4 border border-[#e1e6dc] bg-[#fbfcf8] px-3 py-3 text-sm leading-6 text-[#4b5563]">
          主要項目の差分は見つかりませんでした。原本の文面や添付ファイルは必要に応じて確認してください。
        </p>
      ) : null}

      {changedScalars.length > 0 ? (
        <div className="mt-4 space-y-2">
          {changedScalars.map((item) => (
            <div key={item.key} className="border border-[#e5e9df] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-bold">{item.label}</p>
                <span
                  className={`rounded px-2 py-1 text-xs font-bold ${diffStatusClassNames[item.status]}`}
                >
                  {diffStatusLabels[item.status]}
                </span>
              </div>
              <div className="mt-2 grid gap-2 text-sm leading-6 md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold text-[#6b7280]">前回</p>
                  <p className="break-words text-[#4b5563]">
                    {item.previous || "未設定"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#6b7280]">今回</p>
                  <p className="break-words text-[#1f2933]">
                    {item.current || "未設定"}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {changedLists.length > 0 ? (
        <div className="mt-4 space-y-3">
          {changedLists.map((section) => (
            <div key={section.key} className="border border-[#e5e9df] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{section.label}</p>
                <p className="text-xs font-semibold text-[#6b7280]">
                  前回 {section.previous_count} / 今回 {section.current_count}
                </p>
              </div>
              {section.added.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-bold text-[#24613f]">追加</p>
                  <ul className="mt-1 space-y-1 text-sm leading-6 text-[#24613f]">
                    {section.added.slice(0, 5).map((item) => (
                      <li key={item}>+ {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {section.removed.length > 0 ? (
                <div className="mt-3">
                  <p className="text-xs font-bold text-[#9f352c]">前回のみ</p>
                  <ul className="mt-1 space-y-1 text-sm leading-6 text-[#9f352c]">
                    {section.removed.slice(0, 5).map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type DocumentReviewClientProps = {
  canAssignTeamTasks: boolean;
  canUseDocumentDiff: boolean;
  canUseSharedLedger: boolean;
  documentId: string;
};

export default function DocumentReviewClient({
  canAssignTeamTasks,
  canUseDocumentDiff,
  canUseSharedLedger,
  documentId,
}: DocumentReviewClientProps) {
  const [payload, setPayload] = useState<ReviewPayload | null>(null);
  const [draft, setDraft] = useState<JsonRecord>({});
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDiffLoading, setIsDiffLoading] = useState(false);
  const [documentDiff, setDocumentDiff] = useState<DocumentDiffPayload | null>(null);
  const [diffError, setDiffError] = useState("");
  const [selectedCompareDocumentId, setSelectedCompareDocumentId] = useState("");
  const [createdTasks, setCreatedTasks] = useState<Array<{ id: string; title: string }>>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadDocumentDiff = useCallback(
    async (compareDocumentId = "") => {
      if (!canUseDocumentDiff) {
        setDocumentDiff(null);
        setDiffError("");
        return;
      }

      setIsDiffLoading(true);
      setDiffError("");
      try {
        const params = new URLSearchParams();
        if (compareDocumentId) {
          params.set("compare_document_id", compareDocumentId);
        }
        const diffResult = await fetchJson<ApiItem<DocumentDiffPayload>>(
          `/api/documents/${documentId}/diff${
            params.toString() ? `?${params.toString()}` : ""
          }`
        );
        setDocumentDiff(diffResult.data);
      } catch (diffLoadError) {
        setDocumentDiff(null);
        setDiffError(
          diffLoadError instanceof Error
            ? diffLoadError.message
            : "差分の読み込みに失敗しました"
        );
      } finally {
        setIsDiffLoading(false);
      }
    },
    [canUseDocumentDiff, documentId]
  );

  const loadReview = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setDiffError("");
    try {
      const result = await fetchJson<ApiItem<ReviewPayload>>(
        `/api/documents/${documentId}/review`
      );
      setPayload(result.data);
      setDraft(buildInitialDraft(result.data));
      setSelectedAssetIds(result.data.assets.map((asset) => asset.id));
      setSelectedFileId(result.data.files[0]?.id ?? null);

      if (canUseDocumentDiff) {
        setSelectedCompareDocumentId("");
        await loadDocumentDiff();
      } else {
        setDocumentDiff(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [canUseDocumentDiff, documentId, loadDocumentDiff]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const handleSelectCompareDocumentId = useCallback(
    (compareDocumentId: string) => {
      setSelectedCompareDocumentId(compareDocumentId);
      void loadDocumentDiff(compareDocumentId);
    },
    [loadDocumentDiff]
  );

  const selectedFile = useMemo(
    () => payload?.files.find((file) => file.id === selectedFileId) ?? payload?.files[0],
    [payload, selectedFileId]
  );

  const summary = asRecord(draft.document_summary);
  const classification = asRecord(draft.document_classification);
  const importantDates = asArray(draft.important_dates);
  const primaryDueDate =
    firstDateString(
      importantDates.find((item) => item.is_primary_due_date === true) ?? {}
    ) || firstDateString(importantDates[0] ?? {});
  const requiredDocuments = asArray(draft.required_documents);
  const taskCandidates = asArray(draft.task_candidates).length
    ? asArray(draft.task_candidates)
    : asArray(draft.required_actions);
  const risks = asArray(draft.risks_and_notes);
  const warnings = [
    ...asUnknownArray(draft.warnings).map(noticeText),
    ...asUnknownArray(draft.missing_information).map(noticeText),
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

  function toggleAsset(id: string) {
    if (!canUseSharedLedger) {
      return;
    }
    setSelectedAssetIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id]
    );
  }

  async function saveManagedAssets() {
    if (!canUseSharedLedger) {
      setError("共有台帳はBusinessプラン以上で利用できます。");
      return;
    }
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/documents/${documentId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ managed_asset_ids: selectedAssetIds }),
      });
      setMessage("管理対象を保存しました");
      await loadReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "管理対象の保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDraft() {
    const submittedDraft = canAssignTeamTasks ? draft : stripTeamAssignees(draft);
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/documents/${documentId}/review`, {
        method: "PATCH",
        body: JSON.stringify({ draft: submittedDraft }),
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
    const submittedDraft = canAssignTeamTasks ? draft : stripTeamAssignees(draft);
    setIsApproving(true);
    setError("");
    setMessage("");
    setCreatedTasks([]);
    try {
      const result = await fetchJson<
        ApiItem<{ document: { status: string }; created_tasks: Array<{ id: string; title: string }> }>
      >(`/api/documents/${documentId}/approve`, {
        method: "POST",
        body: JSON.stringify({ draft: submittedDraft, create_tasks: true }),
      });
      setCreatedTasks(result.data.created_tasks);
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
    setIsExtracting(true);
    try {
      await fetchJson(`/api/documents/${documentId}/extract`, { method: "POST" });
      setMessage("AI抽出を再実行しました");
      await loadReview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI抽出に失敗しました");
    } finally {
      setIsExtracting(false);
    }
  }

  async function deleteDocument() {
    if (!window.confirm(`${payload?.document.title ?? "この書類"} を削除しますか。`)) {
      return;
    }
    setError("");
    setMessage("");
    setIsDeleting(true);
    try {
      await fetchJson(`/api/documents/${documentId}`, { method: "DELETE" });
      window.location.href = "/documents/new";
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
      setIsDeleting(false);
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
              disabled={isExtracting}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
            >
              {isExtracting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              {isExtracting ? "再解析中" : "再解析"}
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
            <button
              type="button"
              onClick={() => void deleteDocument()}
              disabled={isDeleting}
              className="inline-flex h-10 items-center gap-2 rounded-md border border-[#f1c9c3] px-3 text-sm font-bold text-[#9a3412] disabled:opacity-60"
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              削除
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
        {createdTasks.length > 0 ? (
          <div className="mt-3 border border-[#cde5d5] bg-[#f1faf4] px-3 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-bold text-[#24613f]">
                作成されたタスクを確認できます
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/tasks?status=todo"
                  className="h-9 rounded-md bg-[#2f5d50] px-3 py-2 text-sm font-bold text-white"
                >
                  タスク一覧へ
                </Link>
                <Link
                  href="/unprocessed"
                  className="h-9 rounded-md border border-[#cde5d5] bg-white px-3 py-2 text-sm font-bold text-[#24613f]"
                >
                  未処理一覧へ
                </Link>
              </div>
            </div>
            <ul className="mt-2 space-y-1 text-sm leading-6 text-[#24613f]">
              {createdTasks.map((task) => (
                <li key={task.id}>{task.title}</li>
              ))}
            </ul>
          </div>
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
              payload.document.source_text ? (
                <div className="min-h-[680px] border border-[#d9ded3] bg-white p-4">
                  <div className="mb-3 inline-flex items-center gap-2 rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                    <FileText className="h-4 w-4" />
                    貼り付け本文
                  </div>
                  <pre className="whitespace-pre-wrap break-words text-sm leading-7 text-[#1f2933]">
                    {payload.document.source_text}
                  </pre>
                </div>
              ) : (
                <div className="flex h-[680px] items-center justify-center border border-dashed border-[#cfd6ca] bg-white text-sm text-[#5f6b5f]">
                  原本ファイルまたは貼り付け本文がありません
                </div>
              )
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
          {warnings.length > 0 || payload.assets.length === 0 || (payload.document.duplicate_count ?? 0) > 0 ? (
            <div className="border border-[#f1d3a8] bg-[#fff8eb] p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-[#9a5b13]" />
                <div>
                  <h3 className="text-sm font-bold text-[#7c4a10]">要確認</h3>
                  <ul className="mt-2 space-y-1 text-sm leading-6 text-[#6b4a1f]">
                    {payload.assets.length === 0 ? (
                      <li>管理対象が未設定です。台帳で探しにくくなる可能性があります。</li>
                    ) : null}
                    {(payload.document.duplicate_count ?? 0) > 0 ? (
                      <li>
                        同一または類似の登録済み書類が {payload.document.duplicate_count}
                        件あります。
                      </li>
                    ) : null}
                    {warnings.slice(0, 5).map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <DocumentDiffPanel
            canUseDocumentDiff={canUseDocumentDiff}
            diff={documentDiff}
            error={diffError}
            isLoading={isDiffLoading}
            onSelectCompareDocumentId={handleSelectCompareDocumentId}
            selectedCompareDocumentId={selectedCompareDocumentId}
          />

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
                  .map((point) =>
                    firstString(point, [
                      "text",
                      "key_point",
                      "point",
                      "content",
                      "内容",
                      "title",
                      "description",
                    ])
                  )
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
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-bold">管理対象</h3>
              <button
                type="button"
                onClick={() => void saveManagedAssets()}
                disabled={isSaving || !canUseSharedLedger}
                className="rounded-md border border-[#d9ded3] px-3 py-2 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
              >
                保存
              </button>
            </div>
            <div className="mt-3">
              {!canUseSharedLedger ? (
                <div className="border border-[#e1e6dc] bg-[#f4f5f1] px-3 py-4 text-sm leading-6 text-[#5f6b5f]">
                  共有台帳への紐づけはBusinessプラン以上で利用できます。
                  <Link href="/usage" className="ml-2 font-bold text-[#2f5d50]">
                    プランを見る
                  </Link>
                </div>
              ) : payload.managed_assets.length === 0 ? (
                <div className="border border-dashed border-[#cfd6ca] px-3 py-5 text-center text-sm text-[#5f6b5f]">
                  管理対象は未登録です
                </div>
              ) : (
                <div className="max-h-44 space-y-2 overflow-auto border border-[#e1e6dc] p-2">
                  {payload.managed_assets.map((asset) => (
                    <label
                      key={asset.id}
                      className="flex cursor-pointer items-start gap-3 rounded px-2 py-2 hover:bg-[#f7f8f5]"
                    >
                      <input
                        type="checkbox"
                        checked={selectedAssetIds.includes(asset.id)}
                        onChange={() => toggleAsset(asset.id)}
                        className="mt-1 h-4 w-4"
                      />
                      <span className="min-w-0">
                        <span className="block break-words text-sm font-bold">
                          {asset.name}
                        </span>
                        <span className="mt-1 block text-xs text-[#6b7280]">
                          {assetTypeLabels[asset.asset_type] ?? asset.asset_type}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <Link
                href="/master-data"
                className="mt-2 inline-flex text-xs font-bold text-[#2f5d50]"
              >
                台帳設定へ
              </Link>
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
                      value={firstString(item, ["date", "due_date", "deadline", "期限", "重要な日付"])}
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
                      value={firstString(item, [
                        "name",
                        "document_name",
                        "document",
                        "document_type",
                        "label",
                      ])}
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
                      value={firstString(task, [
                        "title",
                        "task",
                        "task_description",
                        "action",
                        "action_description",
                        "label",
                      ])}
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
                      value={firstString(task, [
                        "description",
                        "detail",
                        "reason",
                        "task_description",
                        "action_description",
                      ])}
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
                        value={firstDateString(task) || primaryDueDate}
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
                        <span className="flex h-4 items-center justify-between gap-2 text-xs font-bold leading-4 text-[#4b5563]">
                          担当者
                          {canAssignTeamTasks ? (
                            <a href="/team" className="text-[#2f5d50]">
                              担当者設定
                            </a>
                          ) : (
                            <Link href="/usage" className="text-[#2f5d50]">
                              Business以上
                            </Link>
                          )}
                        </span>
                        {canAssignTeamTasks ? (
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
                        ) : (
                          <div className="mt-1 flex h-10 items-center border border-[#d9ded3] bg-[#f4f5f1] px-3 text-sm text-[#6b7280]">
                            担当者割当はBusinessプラン以上
                          </div>
                        )}
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
