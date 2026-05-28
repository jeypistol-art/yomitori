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

type CounterpartyRow = {
  id: string;
  counterparty_type: string;
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

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const result = await query<CounterpartyRow>(
      `SELECT
         id,
         counterparty_type::text AS counterparty_type,
         name,
         contact_name,
         email,
         phone,
         address,
         memo,
         created_at,
         updated_at
       FROM counterparties
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
    requireAdminWrite(currentOrganization);
    requireFeatureAccess(currentOrganization.plan_code, "shared_ledger");

    const body = await readJson(request);
    const result = await query<CounterpartyRow>(
      `INSERT INTO counterparties (
         organization_id,
         counterparty_type,
         name,
         contact_name,
         email,
         phone,
         address,
         memo
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING
         id,
         counterparty_type::text AS counterparty_type,
         name,
         contact_name,
         email,
         phone,
         address,
         memo,
         created_at,
         updated_at`,
      [
        currentOrganization.organization_id,
        normalizeCounterpartyType(body.counterparty_type),
        normalizeRequiredText(body.name, "name"),
        normalizeNullableText(body.contact_name),
        normalizeNullableText(body.email),
        normalizeNullableText(body.phone),
        normalizeNullableText(body.address),
        normalizeNullableText(body.memo),
      ]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return jsonApiError(error);
  }
}
