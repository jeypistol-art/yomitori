import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, hasDbCode, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import {
  assertManagedAssetBelongsToOrganization,
  normalizeAssetType,
  normalizeNullableText,
  normalizeRequiredText,
} from "@/lib/master_data";
import { requireAdminWrite } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

async function assertParentDoesNotCreateCycle(args: {
  organizationId: string;
  assetId: string;
  parentId: string;
}) {
  const result = await query<{ id: string }>(
    `WITH RECURSIVE descendants AS (
       SELECT id
       FROM managed_assets
       WHERE organization_id = $1
         AND parent_id = $2
         AND deleted_at IS NULL
       UNION ALL
       SELECT ma.id
       FROM managed_assets ma
       JOIN descendants d
         ON ma.parent_id = d.id
       WHERE ma.organization_id = $1
         AND ma.deleted_at IS NULL
     )
     SELECT id
     FROM descendants
     WHERE id = $3
     LIMIT 1`,
    [args.organizationId, args.assetId, args.parentId]
  );

  if (result.rows[0]) {
    throw new ApiError(400, "parent_id cannot be a descendant");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);
    requireFeatureAccess(currentOrganization.plan_code, "shared_ledger");

    const body = await readJson(request);
    const parentId = normalizeNullableText(body.parent_id);
    if (parentId) {
      requireFeatureAccess(currentOrganization.plan_code, "branch_ledgers");
    }
    if (parentId === id) {
      throw new ApiError(400, "parent_id cannot be self");
    }
    if (parentId) {
      await assertParentDoesNotCreateCycle({
        organizationId: currentOrganization.organization_id,
        assetId: id,
        parentId,
      });
    }
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
      `UPDATE managed_assets
       SET
         parent_id = $3,
         asset_type = $4,
         name = $5,
         code = $6,
         address = $7,
         memo = $8,
         updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL
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
        id,
        currentOrganization.organization_id,
        parentId,
        normalizeAssetType(body.asset_type),
        normalizeRequiredText(body.name, "name"),
        normalizeNullableText(body.code),
        normalizeNullableText(body.address),
        normalizeNullableText(body.memo),
      ]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "managed asset not found");
    }

    return NextResponse.json({ data: result.rows[0] });
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);
    requireFeatureAccess(currentOrganization.plan_code, "shared_ledger");

    const result = await query<{ id: string }>(
      `UPDATE managed_assets
       SET deleted_at = now(),
           updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL
       RETURNING id`,
      [id, currentOrganization.organization_id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "managed asset not found");
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    return jsonApiError(error);
  }
}
