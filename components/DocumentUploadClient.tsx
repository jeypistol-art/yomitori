"use client";

import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  FileText,
  Sparkles,
  Loader2,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import UsageSummaryClient from "@/components/UsageSummaryClient";

type ManagedAsset = {
  id: string;
  asset_type: string;
  name: string;
  code: string | null;
};

type Counterparty = {
  id: string;
  counterparty_type: string;
  name: string;
};

type DocumentItem = {
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
  created_at: string;
};

type ApiList<T> = {
  data: T[];
};

type UploadResponse = {
  data: {
    id: string;
    title: string;
    status: string;
    file_count: number;
    duplicates?: Array<{ id: string; title: string }>;
  };
};

class ClientApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

const assetTypeLabels: Record<string, string> = {
  property: "物件",
  facility: "施設",
  store: "店舗",
  tenant: "テナント",
  office: "事務所",
  other: "その他",
};

const counterpartyTypeLabels: Record<string, string> = {
  municipality: "行政・自治体",
  tenant: "テナント",
  owner: "オーナー",
  vendor: "業者",
  insurer: "保険会社",
  leasing_company: "リース会社",
  maintenance_company: "メンテナンス会社",
  other: "その他",
};

const documentUploadDraftStorageKey = "yomitori.document_upload_draft.v1";

type DocumentUploadDraft = {
  title: string;
  counterpartyId: string;
  selectedAssetIds: string[];
  sourceText: string;
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ClientApiError(
      response.status,
      typeof payload.error === "string" ? payload.error : "Request failed"
    );
  }
  return payload as T;
}

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(1)} MB`;
  }
  return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function readDocumentUploadDraft(): DocumentUploadDraft | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.sessionStorage.getItem(documentUploadDraftStorageKey);
  if (!raw) {
    return null;
  }
  try {
    const value = JSON.parse(raw) as Partial<DocumentUploadDraft>;
    return {
      title: typeof value.title === "string" ? value.title : "",
      counterpartyId:
        typeof value.counterpartyId === "string" ? value.counterpartyId : "",
      selectedAssetIds: Array.isArray(value.selectedAssetIds)
        ? value.selectedAssetIds.filter((id): id is string => typeof id === "string")
        : [],
      sourceText: typeof value.sourceText === "string" ? value.sourceText : "",
    };
  } catch {
    return null;
  }
}

function writeDocumentUploadDraft(draft: DocumentUploadDraft) {
  if (typeof window === "undefined") {
    return;
  }
  const hasDraft =
    draft.title.trim().length > 0 ||
    draft.counterpartyId.length > 0 ||
    draft.selectedAssetIds.length > 0 ||
    draft.sourceText.trim().length > 0;
  if (!hasDraft) {
    window.sessionStorage.removeItem(documentUploadDraftStorageKey);
    return;
  }
  window.sessionStorage.setItem(
    documentUploadDraftStorageKey,
    JSON.stringify(draft)
  );
}

function clearDocumentUploadDraft() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(documentUploadDraftStorageKey);
  }
}

export default function DocumentUploadClient({
  canUseSharedLedger,
}: {
  canUseSharedLedger: boolean;
}) {
  const [assets, setAssets] = useState<ManagedAsset[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [sourceText, setSourceText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [extractingDocumentId, setExtractingDocumentId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLimitError, setIsLimitError] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);

  const selectedFileSize = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files]
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    setIsLimitError(false);
    try {
      const documentPromise = fetchJson<ApiList<DocumentItem>>("/api/documents");
      if (canUseSharedLedger) {
        const [assetPayload, counterpartyPayload, documentPayload] =
          await Promise.all([
            fetchJson<ApiList<ManagedAsset>>("/api/managed-assets"),
            fetchJson<ApiList<Counterparty>>("/api/counterparties"),
            documentPromise,
          ]);
        setAssets(assetPayload.data);
        setCounterparties(counterpartyPayload.data);
        setDocuments(documentPayload.data);
      } else {
        const documentPayload = await documentPromise;
        setAssets([]);
        setCounterparties([]);
        setCounterpartyId("");
        setSelectedAssetIds([]);
        setDocuments(documentPayload.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, [canUseSharedLedger]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const draft = readDocumentUploadDraft();
    if (!draft) {
      setHasRestoredDraft(true);
      return;
    }
    setTitle(draft.title);
    setCounterpartyId(draft.counterpartyId);
    setSelectedAssetIds(draft.selectedAssetIds);
    setSourceText(draft.sourceText);
    setMessage("前回の入力途中の内容を復元しました。ファイルは必要に応じて再選択してください。");
    setHasRestoredDraft(true);
  }, []);

  useEffect(() => {
    if (!hasRestoredDraft) {
      return;
    }
    writeDocumentUploadDraft({
      title,
      counterpartyId: canUseSharedLedger ? counterpartyId : "",
      selectedAssetIds: canUseSharedLedger ? selectedAssetIds : [],
      sourceText,
    });
  }, [
    canUseSharedLedger,
    counterpartyId,
    hasRestoredDraft,
    selectedAssetIds,
    sourceText,
    title,
  ]);

  useEffect(() => {
    if (!canUseSharedLedger || isLoading) {
      return;
    }
    const validAssetIds = new Set(assets.map((asset) => asset.id));
    setSelectedAssetIds((current) =>
      current.filter((id) => validAssetIds.has(id))
    );
  }, [assets, canUseSharedLedger, isLoading]);

  useEffect(() => {
    if (!canUseSharedLedger || isLoading || !counterpartyId) {
      return;
    }
    if (!counterparties.some((counterparty) => counterparty.id === counterpartyId)) {
      setCounterpartyId("");
    }
  }, [canUseSharedLedger, counterparties, counterpartyId, isLoading]);

  function setFilesFromArray(nextFiles: File[]) {
    setFiles(nextFiles);
    if (!title && nextFiles[0]) {
      setTitle(nextFiles[0].name.replace(/\.[^.]+$/, ""));
    }
  }

  function setFileList(fileList: FileList | null) {
    setFilesFromArray(Array.from(fileList ?? []));
  }

  function handleFileDrag(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.types.includes("Files")) {
      setIsDraggingFiles(true);
    }
  }

  function handleFileDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDraggingFiles(false);
    }
  }

  function handleFileDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFiles(false);
    const droppedFiles = Array.from(event.dataTransfer.files ?? []);
    if (droppedFiles.length > 0) {
      setFilesFromArray(droppedFiles);
    }
  }

  function toggleAsset(id: string) {
    setSelectedAssetIds((current) =>
      current.includes(id)
        ? current.filter((currentId) => currentId !== id)
        : [...current, id]
    );
  }

  async function uploadDocument() {
    setError("");
    setIsLimitError(false);
    setMessage("");
    if (files.length === 0 && sourceText.trim().length === 0) {
      setError("ファイルを選択するか、メール本文・通知文を貼り付けてください");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("counterparty_id", canUseSharedLedger ? counterpartyId : "");
      formData.set("source_text", sourceText);
      if (canUseSharedLedger) {
        selectedAssetIds.forEach((id) => formData.append("managed_asset_ids", id));
      }
      files.forEach((file) => formData.append("files", file));

      const payload = await fetchJson<UploadResponse>("/api/documents", {
        method: "POST",
        body: formData,
      });

      setMessage(
        payload.data.duplicates && payload.data.duplicates.length > 0
          ? `${payload.data.title} を登録しました。既存の類似/同一書類が ${payload.data.duplicates.length}件あります。`
          : `${payload.data.title} を登録しました。OCR処理ジョブをキューに追加しています。`
      );
      setTitle("");
      setCounterpartyId("");
      setSelectedAssetIds([]);
      setFiles([]);
      setSourceText("");
      clearDocumentUploadDraft();
      await loadAll();
    } catch (err) {
      setIsLimitError(err instanceof ClientApiError && err.status === 402);
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  }

  async function extractDocument(document: DocumentItem) {
    setExtractingDocumentId(document.id);
    setError("");
    setIsLimitError(false);
    setMessage("");
    try {
      await fetchJson(`/api/documents/${document.id}/extract`, {
        method: "POST",
      });
      setMessage(`${document.title} のAI抽出が完了しました`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI抽出に失敗しました");
    } finally {
      setExtractingDocumentId(null);
    }
  }

  async function deleteDocument(document: DocumentItem) {
    if (!window.confirm(`${document.title} を削除しますか。`)) {
      return;
    }
    setError("");
    setIsLimitError(false);
    setMessage("");
    try {
      await fetchJson(`/api/documents/${document.id}`, { method: "DELETE" });
      setMessage(`${document.title} を削除しました`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
      <section className="border border-[#d9ded3] bg-white p-5">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
            Upload
          </p>
          <h2 className="mt-1 text-xl font-bold">書類を登録</h2>
        </div>

        <div className="space-y-5">
          <UsageSummaryClient compact />

          <label className="block text-sm font-semibold">
            タイトル
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
            />
          </label>

          {canUseSharedLedger ? (
            <>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">取引先</p>
                  <Link
                    href="/master-data?tab=counterparties&return_to=/documents/new"
                    className="text-xs font-bold text-[#2f5d50]"
                  >
                    取引先設定
                  </Link>
                </div>
                <select
                  value={counterpartyId}
                  onChange={(event) => setCounterpartyId(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#cfd6ca] bg-white px-3"
                >
                  <option value="">未選択</option>
                  {counterparties.map((counterparty) => (
                    <option key={counterparty.id} value={counterparty.id}>
                      {counterparty.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold">管理対象</p>
                  <Link
                    href="/master-data?tab=assets&return_to=/documents/new"
                    className="text-xs font-bold text-[#2f5d50]"
                  >
                    台帳設定
                  </Link>
                </div>
                {assets.length === 0 ? (
                  <div className="border border-dashed border-[#cfd6ca] px-3 py-5 text-center text-sm text-[#5f6b5f]">
                    管理対象は未登録です
                  </div>
                ) : (
                  <div className="max-h-44 space-y-2 overflow-auto border border-[#e1e6dc] p-2">
                    {assets.map((asset) => (
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
                            {asset.code ? ` / ${asset.code}` : ""}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="border border-[#e1e6dc] bg-[#f4f5f1] px-4 py-3 text-sm leading-6 text-[#5f6b5f]">
              <p className="font-bold text-[#4b5563]">取引先・管理対象の紐づけ</p>
              <p className="mt-1">
                共有台帳はBusinessプラン以上で利用できます。このプランでは書類本文とファイルのみ登録できます。
              </p>
              <Link href="/usage" className="mt-2 inline-flex font-bold text-[#2f5d50]">
                プランを見る
              </Link>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold">
              メール本文・通知文の貼り付け
              <textarea
                value={sourceText}
                onChange={(event) => {
                  setSourceText(event.target.value);
                  if (!title) {
                    const firstLine = event.target.value
                      .split(/\r?\n/)
                      .map((line) => line.trim())
                      .find(Boolean);
                    if (firstLine) {
                      setTitle(firstLine.slice(0, 80));
                    }
                  }
                }}
                rows={8}
                placeholder="メール本文、自治体からの通知文、チャットで届いた依頼文などを貼り付け"
                className="mt-2 w-full resize-y rounded-md border border-[#cfd6ca] px-3 py-2 text-sm leading-6"
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-[#6b7280]">
              PDF/画像がなくても、この本文だけで登録・AI抽出できます。
            </p>
          </div>

          <div>
            <label
              onDragEnter={handleFileDrag}
              onDragOver={handleFileDrag}
              onDragLeave={handleFileDragLeave}
              onDrop={handleFileDrop}
              className={`flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-8 text-center transition ${
                isDraggingFiles
                  ? "border-[#2f5d50] bg-[#edf7ef] ring-2 ring-[#2f5d50]/20"
                  : "border-[#aeb9aa] bg-[#fbfcf8]"
              }`}
            >
              <Upload className="h-8 w-8 text-[#2f5d50]" />
              <span className="mt-3 text-sm font-bold">
                PDF・画像ファイルを選択 / ドロップ
              </span>
              <span className="mt-1 text-xs text-[#6b7280]">
                PDF, PNG, JPEG, WebP, HEIC / 1ファイル30MBまで
              </span>
              <input
                type="file"
                multiple
                accept="application/pdf,image/png,image/jpeg,image/webp,image/heic,image/heif"
                onChange={(event) => setFileList(event.target.files)}
                className="hidden"
              />
            </label>
            {files.length > 0 ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-[#5f6b5f]">
                  <span>{files.length}件</span>
                  <span>{formatFileSize(selectedFileSize)}</span>
                </div>
                {files.map((file) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="flex items-center justify-between gap-3 border border-[#e1e6dc] px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate">{file.name}</span>
                    <span className="shrink-0 text-xs text-[#6b7280]">
                      {formatFileSize(file.size)}
                    </span>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setFiles([])}
                  className="inline-flex h-8 items-center gap-2 text-xs font-bold text-[#8a3a2b]"
                >
                  <X className="h-4 w-4" />
                  選択を解除
                </button>
              </div>
            ) : null}
          </div>

          {message ? (
            <div className="border border-[#cde5d5] bg-[#f1faf4] px-4 py-3 text-sm font-semibold text-[#24613f]">
              {message}
            </div>
          ) : null}
          {error ? (
            <div className="border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
              <p>{error}</p>
              {isLimitError ? (
                <Link
                  href="/usage"
                  className="mt-3 inline-flex h-9 items-center rounded-md border border-[#f1c9c3] bg-white px-3 text-xs font-bold text-[#9a3412]"
                >
                  利用状況・追加パックを確認
                </Link>
              ) : null}
            </div>
          ) : null}

          <button
            type="button"
            onClick={uploadDocument}
            disabled={isUploading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            登録する
          </button>
        </div>
      </section>

      <section className="border border-[#d9ded3] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
              Documents
            </p>
            <h2 className="mt-1 text-xl font-bold">登録済み書類</h2>
          </div>
          <button
            type="button"
            onClick={loadAll}
            className="rounded-md border border-[#d9ded3] px-3 py-2 text-sm font-bold text-[#2f5d50]"
          >
            更新
          </button>
        </div>

        <div className="p-5">
          {isLoading ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm text-[#5f6b5f]">
              読み込み中
            </div>
          ) : documents.length === 0 ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
              書類は未登録です
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="grid gap-4 border border-[#e1e6dc] p-4 md:grid-cols-[1fr_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                        {document.status}
                      </span>
                      <span className="rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#4b5563]">
                        {document.document_type}
                      </span>
                      <span className="text-xs font-semibold text-[#6b7280]">
                        {document.file_count > 0
                          ? `${document.file_count}ファイル`
                          : "本文"}
                      </span>
                      {document.duplicate_count > 0 ? (
                        <span className="rounded bg-[#fff8eb] px-2 py-1 text-xs font-bold text-[#9a5b13]">
                          重複候補 {document.duplicate_count}件
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 break-words text-base font-bold">
                      {document.suggested_title ?? document.title}
                    </h3>
                    {document.suggested_title ? (
                      <p className="mt-1 break-words text-xs text-[#6b7280]">
                        元タイトル: {document.title}
                      </p>
                    ) : null}
                    {document.summary ? (
                      <p className="mt-2 break-words text-sm leading-6 text-[#4b5563]">
                        {document.summary}
                      </p>
                    ) : null}
                    {document.due_date ? (
                      <p className="mt-2 text-sm font-bold text-[#8a3a2b]">
                        期限: {document.due_date}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-[#6b7280]">
                      {new Date(document.created_at).toLocaleString("ja-JP")}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-start gap-2 text-[#2f5d50] md:justify-end">
                    <Link
                      href={`/documents/${document.id}/review`}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
                    >
                      確認
                    </Link>
                    <button
                      type="button"
                      onClick={() => void extractDocument(document)}
                      disabled={extractingDocumentId === document.id}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50] disabled:opacity-60"
                    >
                      {extractingDocumentId === document.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      AI抽出
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteDocument(document)}
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-[#f1c9c3] px-3 text-sm font-bold text-[#9a3412]"
                    >
                      <Trash2 className="h-4 w-4" />
                      削除
                    </button>
                    <FileText className="h-5 w-5" />
                    <CheckCircle2 className="h-5 w-5" />
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
