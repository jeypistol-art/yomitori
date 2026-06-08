import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import {
  normalizeCounterpartyType,
  normalizeNullableText,
  normalizeRequiredText,
} from "@/lib/master_data";
import { requireAdminWrite } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CounterpartyRow = {
  id: string;
  counterparty_type: string;
  counterparty_type_label: string | null;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);
    requireFeatureAccess(currentOrganization.plan_code, "shared_ledger");

    const body = await readJson(request);
    const requestedCounterpartyType = normalizeCounterpartyType(body.counterparty_type);
    const requestedCounterpartyTypeLabel = normalizeNullableText(
      body.counterparty_type_label
    );
    const counterpartyType = requestedCounterpartyTypeLabel
      ? "other"
      : requestedCounterpartyType;
    const result = await query<CounterpartyRow>(
      `UPDATE counterparties
       SET
         counterparty_type = $3,
         counterparty_type_label = $4,
         name = $5,
         contact_name = $6,
         email = $7,
         phone = $8,
         address = $9,
         memo = $10,
         updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL
       RETURNING
         id,
         counterparty_type::text AS counterparty_type,
         counterparty_type_label,
         name,
         contact_name,
         email,
         phone,
         address,
         memo,
         created_at,
         updated_at`,
      [
        id,
        currentOrganization.organization_id,
        counterpartyType,
        counterpartyType === "other" ? requestedCounterpartyTypeLabel : null,
        normalizeRequiredText(body.name, "name"),
        normalizeNullableText(body.contact_name),
        normalizeNullableText(body.email),
        normalizeNullableText(body.phone),
        normalizeNullableText(body.address),
        normalizeNullableText(body.memo),
      ]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "counterparty not found");
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
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
      `UPDATE counterparties
       SET deleted_at = now(),
           updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL
       RETURNING id`,
      [id, currentOrganization.organization_id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "counterparty not found");
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    return jsonApiError(error);
  }
}
