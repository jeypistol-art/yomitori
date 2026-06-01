"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  GitBranch,
  LockKeyhole,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Users,
  X,
} from "lucide-react";

type ManagedAsset = {
  id: string;
  parent_id: string | null;
  asset_type: string;
  name: string;
  code: string | null;
  address: string | null;
  memo: string | null;
};

type Counterparty = {
  id: string;
  counterparty_type: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  memo: string | null;
};

type ApiList<T> = {
  data: T[];
};

type ApiItem<T> = {
  data: T;
};

const assetTypeLabels: Record<string, string> = {
  property: "物件",
  facility: "施設",
  store: "店舗",
  tenant: "テナント",
  office: "事務所",
  other: "その他",
};

const branchParentAssetTypes = new Set(["property", "facility", "store", "office"]);

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

const emptyAssetForm = {
  parent_id: "",
  asset_type: "facility",
  name: "",
  code: "",
  address: "",
  memo: "",
};

const emptyCounterpartyForm = {
  counterparty_type: "municipality",
  name: "",
  contact_name: "",
  email: "",
  phone: "",
  address: "",
  memo: "",
};

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
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

export default function MasterDataClient({
  canUseBranchLedgers,
}: {
  canUseBranchLedgers: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"assets" | "counterparties">("assets");
  const [assetView, setAssetView] = useState<"list" | "branch">("list");
  const [assets, setAssets] = useState<ManagedAsset[]>([]);
  const [counterparties, setCounterparties] = useState<Counterparty[]>([]);
  const [assetForm, setAssetForm] = useState(emptyAssetForm);
  const [counterpartyForm, setCounterpartyForm] = useState(emptyCounterpartyForm);
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingCounterpartyId, setEditingCounterpartyId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const assetOptions = useMemo(
    () => Object.entries(assetTypeLabels),
    []
  );
  const assetById = useMemo(
    () => new Map(assets.map((asset) => [asset.id, asset])),
    [assets]
  );
  const descendantAssetIds = useMemo(() => {
    const descendants = new Set<string>();
    if (!editingAssetId) {
      return descendants;
    }
    const queue = [editingAssetId];
    while (queue.length > 0) {
      const parentId = queue.shift();
      for (const asset of assets) {
        if (asset.parent_id === parentId && !descendants.has(asset.id)) {
          descendants.add(asset.id);
          queue.push(asset.id);
        }
      }
    }
    return descendants;
  }, [assets, editingAssetId]);
  const branchParentOptions = useMemo(
    () =>
      assets.filter(
        (asset) =>
          asset.id !== editingAssetId &&
          !descendantAssetIds.has(asset.id) &&
          branchParentAssetTypes.has(asset.asset_type)
      ),
    [assets, descendantAssetIds, editingAssetId]
  );
  const rootAssets = useMemo(
    () =>
      assets.filter((asset) => !asset.parent_id || !assetById.has(asset.parent_id)),
    [assetById, assets]
  );
  const childAssetsByParentId = useMemo(() => {
    const grouped = new Map<string, ManagedAsset[]>();
    for (const asset of assets) {
      if (!asset.parent_id || !assetById.has(asset.parent_id)) {
        continue;
      }
      grouped.set(asset.parent_id, [...(grouped.get(asset.parent_id) ?? []), asset]);
    }
    return grouped;
  }, [assetById, assets]);
  const counterpartyOptions = useMemo(
    () => Object.entries(counterpartyTypeLabels),
    []
  );

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [assetPayload, counterpartyPayload] = await Promise.all([
        fetchJson<ApiList<ManagedAsset>>("/api/managed-assets"),
        fetchJson<ApiList<Counterparty>>("/api/counterparties"),
      ]);
      setAssets(assetPayload.data);
      setCounterparties(counterpartyPayload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み込みに失敗しました");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!canUseBranchLedgers) {
      setAssetView("list");
    }
  }, [canUseBranchLedgers]);

  function resetAssetForm() {
    setAssetForm(emptyAssetForm);
    setEditingAssetId(null);
  }

  function resetCounterpartyForm() {
    setCounterpartyForm(emptyCounterpartyForm);
    setEditingCounterpartyId(null);
  }

  async function saveAsset() {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const url = editingAssetId
        ? `/api/managed-assets/${editingAssetId}`
        : "/api/managed-assets";
      const method = editingAssetId ? "PATCH" : "POST";
      const payload = await fetchJson<ApiItem<ManagedAsset>>(url, {
        method,
        body: JSON.stringify(assetForm),
      });
      setAssets((current) => {
        if (editingAssetId) {
          return current.map((item) =>
            item.id === editingAssetId ? payload.data : item
          );
        }
        return [payload.data, ...current];
      });
      setMessage(editingAssetId ? "管理対象を更新しました" : "管理対象を追加しました");
      resetAssetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteAsset(id: string) {
    if (!window.confirm("この管理対象を削除しますか。")) {
      return;
    }
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/managed-assets/${id}`, { method: "DELETE" });
      setAssets((current) => current.filter((item) => item.id !== id));
      if (editingAssetId === id) {
        resetAssetForm();
      }
      setMessage("管理対象を削除しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  async function saveCounterparty() {
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const url = editingCounterpartyId
        ? `/api/counterparties/${editingCounterpartyId}`
        : "/api/counterparties";
      const method = editingCounterpartyId ? "PATCH" : "POST";
      const payload = await fetchJson<ApiItem<Counterparty>>(url, {
        method,
        body: JSON.stringify(counterpartyForm),
      });
      setCounterparties((current) => {
        if (editingCounterpartyId) {
          return current.map((item) =>
            item.id === editingCounterpartyId ? payload.data : item
          );
        }
        return [payload.data, ...current];
      });
      setMessage(
        editingCounterpartyId ? "取引先を更新しました" : "取引先を追加しました"
      );
      resetCounterpartyForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteCounterparty(id: string) {
    if (!window.confirm("この取引先を削除しますか。")) {
      return;
    }
    setError("");
    setMessage("");
    try {
      await fetchJson(`/api/counterparties/${id}`, { method: "DELETE" });
      setCounterparties((current) => current.filter((item) => item.id !== id));
      if (editingCounterpartyId === id) {
        resetCounterpartyForm();
      }
      setMessage("取引先を削除しました");
    } catch (err) {
      setError(err instanceof Error ? err.message : "削除に失敗しました");
    }
  }

  function editAsset(asset: ManagedAsset) {
    setActiveTab("assets");
    setEditingAssetId(asset.id);
    setAssetForm({
      parent_id: asset.parent_id ?? "",
      asset_type: asset.asset_type,
      name: asset.name,
      code: asset.code ?? "",
      address: asset.address ?? "",
      memo: asset.memo ?? "",
    });
  }

  function editCounterparty(counterparty: Counterparty) {
    setActiveTab("counterparties");
    setEditingCounterpartyId(counterparty.id);
    setCounterpartyForm({
      counterparty_type: counterparty.counterparty_type,
      name: counterparty.name,
      contact_name: counterparty.contact_name ?? "",
      email: counterparty.email ?? "",
      phone: counterparty.phone ?? "",
      address: counterparty.address ?? "",
      memo: counterparty.memo ?? "",
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <section className="border border-[#d9ded3] bg-white p-5">
        <div className="mb-5 flex rounded-md border border-[#d9ded3] bg-[#f7f8f5] p-1">
          <button
            type="button"
            onClick={() => setActiveTab("assets")}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded px-3 text-sm font-semibold ${
              activeTab === "assets"
                ? "bg-white text-[#1f2933] shadow-sm"
                : "text-[#5f6b5f]"
            }`}
          >
            <Building2 className="h-4 w-4" />
            管理対象
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("counterparties")}
            className={`flex h-10 flex-1 items-center justify-center gap-2 rounded px-3 text-sm font-semibold ${
              activeTab === "counterparties"
                ? "bg-white text-[#1f2933] shadow-sm"
                : "text-[#5f6b5f]"
            }`}
          >
            <Users className="h-4 w-4" />
            取引先
          </button>
        </div>

        {activeTab === "assets" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">
                {editingAssetId ? "管理対象を編集" : "管理対象を追加"}
              </h2>
              {editingAssetId ? (
                <button
                  type="button"
                  title="編集を解除"
                  onClick={resetAssetForm}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d9ded3] text-[#4b5563]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <label className="block text-sm font-semibold">
              種別
              <select
                value={assetForm.asset_type}
                onChange={(event) =>
                  setAssetForm((form) => ({
                    ...form,
                    asset_type: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] bg-white px-3"
              >
                {assetOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {canUseBranchLedgers ? (
              <label className="block text-sm font-semibold">
                上位管理対象
                <select
                  value={assetForm.parent_id}
                  onChange={(event) =>
                    setAssetForm((form) => ({
                      ...form,
                      parent_id: event.target.value,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] bg-white px-3"
                >
                  <option value="">設定なし</option>
                  {branchParentOptions.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.name}
                      {asset.code ? ` / ${asset.code}` : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-xs leading-5 text-[#6b7280]">
                  施設、店舗、テナントなどを上位拠点に紐づけて整理できます。
                </span>
              </label>
            ) : (
              <div className="rounded-md border border-[#e1e6dc] bg-[#f4f5f1] px-3 py-3 text-sm leading-6 text-[#5f6b5f]">
                <div className="flex gap-2">
                  <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>上位管理対象の紐づけはProプラン以上で利用できます。</span>
                </div>
              </div>
            )}
            <label className="block text-sm font-semibold">
              名称
              <input
                value={assetForm.name}
                onChange={(event) =>
                  setAssetForm((form) => ({ ...form, name: event.target.value }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
            </label>
            <label className="block text-sm font-semibold">
              コード
              <input
                value={assetForm.code}
                onChange={(event) =>
                  setAssetForm((form) => ({ ...form, code: event.target.value }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
            </label>
            <label className="block text-sm font-semibold">
              住所
              <input
                value={assetForm.address}
                onChange={(event) =>
                  setAssetForm((form) => ({
                    ...form,
                    address: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
            </label>
            <label className="block text-sm font-semibold">
              メモ
              <textarea
                value={assetForm.memo}
                onChange={(event) =>
                  setAssetForm((form) => ({ ...form, memo: event.target.value }))
                }
                rows={4}
                className="mt-2 w-full resize-none rounded-md border border-[#cfd6ca] px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={isSaving}
              onClick={saveAsset}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {editingAssetId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingAssetId ? "保存" : "追加"}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-bold">
                {editingCounterpartyId ? "取引先を編集" : "取引先を追加"}
              </h2>
              {editingCounterpartyId ? (
                <button
                  type="button"
                  title="編集を解除"
                  onClick={resetCounterpartyForm}
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d9ded3] text-[#4b5563]"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <label className="block text-sm font-semibold">
              種別
              <select
                value={counterpartyForm.counterparty_type}
                onChange={(event) =>
                  setCounterpartyForm((form) => ({
                    ...form,
                    counterparty_type: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] bg-white px-3"
              >
                {counterpartyOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              名称
              <input
                value={counterpartyForm.name}
                onChange={(event) =>
                  setCounterpartyForm((form) => ({
                    ...form,
                    name: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
            </label>
            <label className="block text-sm font-semibold">
              担当者
              <input
                value={counterpartyForm.contact_name}
                onChange={(event) =>
                  setCounterpartyForm((form) => ({
                    ...form,
                    contact_name: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-semibold">
                メール
                <input
                  value={counterpartyForm.email}
                  onChange={(event) =>
                    setCounterpartyForm((form) => ({
                      ...form,
                      email: event.target.value,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
                />
              </label>
              <label className="block text-sm font-semibold">
                電話
                <input
                  value={counterpartyForm.phone}
                  onChange={(event) =>
                    setCounterpartyForm((form) => ({
                      ...form,
                      phone: event.target.value,
                    }))
                  }
                  className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
                />
              </label>
            </div>
            <label className="block text-sm font-semibold">
              住所
              <input
                value={counterpartyForm.address}
                onChange={(event) =>
                  setCounterpartyForm((form) => ({
                    ...form,
                    address: event.target.value,
                  }))
                }
                className="mt-2 h-11 w-full rounded-md border border-[#cfd6ca] px-3"
              />
            </label>
            <label className="block text-sm font-semibold">
              メモ
              <textarea
                value={counterpartyForm.memo}
                onChange={(event) =>
                  setCounterpartyForm((form) => ({
                    ...form,
                    memo: event.target.value,
                  }))
                }
                rows={4}
                className="mt-2 w-full resize-none rounded-md border border-[#cfd6ca] px-3 py-2"
              />
            </label>
            <button
              type="button"
              disabled={isSaving}
              onClick={saveCounterparty}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-md bg-[#2f5d50] px-4 text-sm font-bold text-white disabled:opacity-60"
            >
              {editingCounterpartyId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {editingCounterpartyId ? "保存" : "追加"}
            </button>
          </div>
        )}
      </section>

      <section className="min-h-[520px] border border-[#d9ded3] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9df] px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">
              {activeTab === "assets" ? "管理対象一覧" : "取引先一覧"}
            </h2>
            <p className="mt-1 text-sm text-[#5f6b5f]">
              {activeTab === "assets"
                ? `${assets.length}件`
                : `${counterparties.length}件`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "assets" && canUseBranchLedgers ? (
              <div className="flex rounded-md border border-[#d9ded3] bg-[#f7f8f5] p-1">
                {[
                  ["list", "一覧"],
                  ["branch", "拠点別"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAssetView(value as "list" | "branch")}
                    className={`h-9 rounded px-3 text-sm font-bold ${
                      assetView === value
                        ? "bg-white text-[#1f2933] shadow-sm"
                        : "text-[#5f6b5f]"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              title="再読み込み"
              onClick={loadAll}
              className="flex h-10 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-semibold text-[#2f5d50]"
            >
              <RefreshCw className="h-4 w-4" />
              更新
            </button>
          </div>
        </div>

        {message ? (
          <div className="mx-5 mt-4 border border-[#cde5d5] bg-[#f1faf4] px-4 py-3 text-sm font-semibold text-[#24613f]">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="mx-5 mt-4 border border-[#f1c9c3] bg-[#fff5f2] px-4 py-3 text-sm font-semibold text-[#9a3412]">
            {error}
          </div>
        ) : null}

        <div className="p-5">
          {isLoading ? (
            <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm text-[#5f6b5f]">
              読み込み中
            </div>
          ) : activeTab === "assets" ? (
            <div className="space-y-3">
              {assets.length === 0 ? (
                <EmptyState text="管理対象は未登録です" />
              ) : canUseBranchLedgers && assetView === "branch" ? (
                rootAssets.map((asset) => {
                  const children = childAssetsByParentId.get(asset.id) ?? [];
                  return (
                    <div key={asset.id} className="border border-[#e1e6dc]">
                      <div className="border-b border-[#edf0e8] bg-[#fbfcf8] p-4">
                        <div className="mb-3 flex items-center gap-2 text-xs font-bold text-[#2f5d50]">
                          <GitBranch className="h-3.5 w-3.5" />
                          {children.length}件の下位管理対象
                        </div>
                        <AssetCard
                          asset={asset}
                          onDelete={() => void deleteAsset(asset.id)}
                          onEdit={() => editAsset(asset)}
                        />
                      </div>
                      {children.length > 0 ? (
                        <div className="space-y-3 p-4">
                          {children.map((child) => (
                            <AssetCard
                              key={child.id}
                              asset={child}
                              parent={asset}
                              onDelete={() => void deleteAsset(child.id)}
                              onEdit={() => editAsset(child)}
                            />
                          ))}
                        </div>
                      ) : (
                        <p className="px-4 py-4 text-sm text-[#6b7280]">
                          下位管理対象は未設定です。
                        </p>
                      )}
                    </div>
                  );
                })
              ) : (
                assets.map((asset) => (
                  <AssetCard
                    key={asset.id}
                    asset={asset}
                    parent={
                      asset.parent_id ? assetById.get(asset.parent_id) : undefined
                    }
                    onDelete={() => void deleteAsset(asset.id)}
                    onEdit={() => editAsset(asset)}
                  />
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {counterparties.length === 0 ? (
                <EmptyState text="取引先は未登録です" />
              ) : (
                counterparties.map((counterparty) => (
                  <div
                    key={counterparty.id}
                    className="grid gap-4 border border-[#e1e6dc] p-4 md:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
                          {counterpartyTypeLabels[counterparty.counterparty_type] ??
                            counterparty.counterparty_type}
                        </span>
                        {counterparty.contact_name ? (
                          <span className="text-xs font-semibold text-[#6b7280]">
                            {counterparty.contact_name}
                          </span>
                        ) : null}
                      </div>
                      <h3 className="mt-2 break-words text-base font-bold">
                        {counterparty.name}
                      </h3>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#4b5563]">
                        {counterparty.email ? <span>{counterparty.email}</span> : null}
                        {counterparty.phone ? <span>{counterparty.phone}</span> : null}
                      </div>
                      {counterparty.address ? (
                        <p className="mt-1 break-words text-sm text-[#4b5563]">
                          {counterparty.address}
                        </p>
                      ) : null}
                      {counterparty.memo ? (
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#6b7280]">
                          {counterparty.memo}
                        </p>
                      ) : null}
                    </div>
                    <RowActions
                      onEdit={() => editCounterparty(counterparty)}
                      onDelete={() => void deleteCounterparty(counterparty.id)}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function AssetCard({
  asset,
  onDelete,
  onEdit,
  parent,
}: {
  asset: ManagedAsset;
  onDelete: () => void;
  onEdit: () => void;
  parent?: ManagedAsset;
}) {
  return (
    <div className="grid gap-4 border border-[#e1e6dc] bg-white p-4 md:grid-cols-[1fr_auto]">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-[#edf2e8] px-2 py-1 text-xs font-bold text-[#2f5d50]">
            {assetTypeLabels[asset.asset_type] ?? asset.asset_type}
          </span>
          {asset.code ? (
            <span className="font-mono text-xs text-[#6b7280]">
              {asset.code}
            </span>
          ) : null}
          {parent ? (
            <span className="inline-flex items-center gap-1 rounded bg-[#f3f4f6] px-2 py-1 text-xs font-bold text-[#4b5563]">
              <GitBranch className="h-3.5 w-3.5" />
              {parent.name}
            </span>
          ) : null}
        </div>
        <h3 className="mt-2 break-words text-base font-bold">{asset.name}</h3>
        {asset.address ? (
          <p className="mt-1 break-words text-sm text-[#4b5563]">
            {asset.address}
          </p>
        ) : null}
        {asset.memo ? (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#6b7280]">
            {asset.memo}
          </p>
        ) : null}
      </div>
      <RowActions onDelete={onDelete} onEdit={onEdit} />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="border border-dashed border-[#cfd6ca] px-4 py-10 text-center text-sm font-semibold text-[#5f6b5f]">
      {text}
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start gap-2 md:justify-end">
      <button
        type="button"
        title="編集"
        onClick={onEdit}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d9ded3] text-[#2f5d50]"
      >
        <Pencil className="h-4 w-4" />
      </button>
      <button
        type="button"
        title="削除"
        onClick={onDelete}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[#f1c9c3] text-[#b42318]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
