"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  CheckCircle2,
  FileText,
  Sparkles,
  Loader2,
  Upload,
  Users,
  X,
} from "lucide-react";

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
  status: string;
  file_count: number;
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
  };
};

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

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(
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

export default function DocumentUploadClient() {
  const [assets, setAssets] = useState<ManagedAsset[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [title, setTitle] = useState("");
  const [counterpartyId, setCounterpartyId] = useState("");
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [extractingDocumentId, setExtractingDocumentId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedFileSize = useMemo(
    () => files.reduce((total, file) => total + file.size, 0),
    [files]
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [assetPayload, counterpartyPayload, documentPayload] =
        await Promise.all([
          fetchJson<ApiList<ManagedAsset>>("/api/managed-assets"),
          fetchJson<ApiList<Counterparty>>("/api/counterparties"),
          fetchJson<ApiList<DocumentItem>>("/api/documents"),
        ]);
      setAssets(assetPayload.data);
      setCounterparties(counterpartyPayload.data);
      setDocuments(documentPayload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  function setFileList(fileList: FileList | null) {
    const nextFiles = Array.from(fileList ?? []);
    setFiles(nextFiles);
    if (!title && nextFiles[0]) {
      setTitle(nextFiles[0].name.replace(/\.[^.]+$/, ""));
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
    setMessage("");
    if (files.length === 0) {
      setError("ファイルを選択してください");
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.set("title", title);
      formData.set("counterparty_id", counterpartyId);
      selectedAssetIds.forEach((id) => formData.append("managed_asset_ids", id));
      files.forEach((file) => formData.append("files", file));

      const payload = await fetchJson<UploadResponse>("/api/documents", {
        method: "POST",
        body: formData,
      });

      setMessage(
        `${payload.data.title} を登録しました。OCR処理ジョブをキューに追加しています。`
      );
      setTitle("");
      setCounterpartyId("");
      setSelectedAssetIds([]);
      setFiles([]);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "アップロードに失敗しました");
    } finally {
      setIsUploading(false);
    }
  }

  async function extractDocument(document: DocumentItem) {
    setExtractingDocumentId(document.id);
    setError("");
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
          <label className="block text-sm font-semibold">
            タイトル
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
            />
          </label>

          <label className="block text-sm font-semibold">
            取引先
            <select
              value={counterpartyId}
              onChange={(event) => setCounterpartyId(event.target.value)}
              className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] bg-white px-3"
            >
              <option value="">未選択</option>
              {counterparties.map((counterparty) => (
                <option key={counterparty.id} value={counterparty.id}>
                  {counterparty.name}
                </option>
              ))}
            </select>
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold">管理対象</p>
              <Link
                href="/master-data"
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

          <div>
            <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center border border-dashed border-[#aeb9aa] bg-[#fbfcf8] px-4 py-8 text-center">
              <Upload className="h-8 w-8 text-[#2f5d50]" />
              <span className="mt-3 text-sm font-bold">
                PDF・画像ファイルを選択
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
              {error}
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
                        {document.file_count}ファイル
                      </span>
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
