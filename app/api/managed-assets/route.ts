import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, hasDbCode, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import {
  assertManagedAssetBelongsToOrganization,
  normalizeAssetType,
  normalizeNullableText,
  normalizeRequiredText,
  requireMasterDataWrite,
} from "@/lib/master_data";

type ManagedAssetRow = {
  id: string;
  parent_id: string | null;
  asset_type: string;
  name: string;
  code: string | null;
  address: string | null;
  memo: string | null;
  created_at: string;
  updated_at: string;
};

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON");
  }
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const result = await query<ManagedAssetRow>(
      `SELECT
         id,
         parent_id,
         asset_type::text AS asset_type,
         name,
         code,
         address,
         memo,
         created_at,
         updated_at
       FROM managed_assets
       WHERE organization_id = $1
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [currentOrganization.organization_id]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    requireMasterDataWrite(currentOrganization);

    const body = await readJson(request);
    const parentId = normalizeNullableText(body.parent_id);
    if (
      parentId &&
      !(await assertManagedAssetBelongsToOrganization(
        currentOrganization.organization_id,
        parentId
      ))
    ) {
      throw new ApiError(400, "parent_id is invalid");
    }

    const result = await query<ManagedAssetRow>(
      `INSERT INTO managed_assets (
         organization_id,
         parent_id,
         asset_type,
         name,
         code,
         address,
         memo
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING
         id,
         parent_id,
         asset_type::text AS asset_type,
         name,
         code,
         address,
         memo,
         created_at,
         updated_at`,
      [
        currentOrganization.organization_id,
        parentId,
        normalizeAssetType(body.asset_type),
        normalizeRequiredText(body.name, "name"),
        normalizeNullableText(body.code),
        normalizeNullableText(body.address),
        normalizeNullableText(body.memo),
      ]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    if (hasDbCode(error, "23505")) {
      return NextResponse.json(
        { error: "code already exists" },
        { status: 409 }
      );
    }
    return jsonApiError(error);
  }
}
