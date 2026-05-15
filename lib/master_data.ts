import { query } from "@/lib/db";
import type { CurrentOrganization } from "@/lib/current_organization";
import { ApiError } from "@/lib/api_errors";

export const ASSET_TYPES = [
  "property",
  "facility",
  "store",
  "tenant",
  "office",
  "other",
] as const;

export const COUNTERPARTY_TYPES = [
  "municipality",
  "tenant",
  "owner",
  "vendor",
  "insurer",
  "leasing_company",
  "maintenance_company",
  "other",
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];
export type CounterpartyType = (typeof COUNTERPARTY_TYPES)[number];

export function requireMasterDataWrite(current: CurrentOrganization) {
  if (!["owner", "admin", "member"].includes(current.role)) {
    throw new ApiError(403, "Insufficient permissions");
  }
}

export function normalizeNullableText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeRequiredText(value: unknown, label: string) {
  const text = normalizeNullableText(value);
  if (!text) {
    throw new ApiError(400, `${label} is required`);
  }
  return text;
}

export function normalizeAssetType(value: unknown): AssetType {
  return ASSET_TYPES.includes(value as AssetType) ? (value as AssetType) : "facility";
}

export function normalizeCounterpartyType(value: unknown): CounterpartyType {
  return COUNTERPARTY_TYPES.includes(value as CounterpartyType)
    ? (value as CounterpartyType)
    : "other";
}

export async function assertManagedAssetBelongsToOrganization(
  organizationId: string,
  assetId: string
) {
  const result = await query<{ id: string }>(
    `SELECT id
     FROM managed_assets
     WHERE id = $1
       AND organization_id = $2
       AND deleted_at IS NULL
     LIMIT 1`,
    [assetId, organizationId]
  );

  return result.rows.length > 0;
}

export async function assertCounterpartyBelongsToOrganization(
  organizationId: string,
  counterpartyId: string
) {
  const result = await query<{ id: string }>(
    `SELECT id
     FROM counterparties
     WHERE id = $1
       AND organization_id = $2
       AND deleted_at IS NULL
     LIMIT 1`,
    [counterpartyId, organizationId]
  );

  return result.rows.length > 0;
}
