import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { normalizeNullableText, normalizeRequiredText } from "@/lib/master_data";
import { requireOperationalWrite } from "@/lib/permissions";

const optionKinds = new Set(["asset_type", "counterparty_type", "document_type"]);

type CustomTypeOptionRow = {
  id: string;
  option_kind: string;
  label: string;
  created_at: string;
  updated_at: string;
};

function normalizeOptionKind(value: unknown) {
  const text = normalizeRequiredText(value, "option_kind");
  if (!optionKinds.has(text)) {
    throw new ApiError(400, "option_kind is invalid");
  }
  return text;
}

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
    const result = await query<CustomTypeOptionRow>(
      `SELECT id, option_kind, label, created_at, updated_at
       FROM custom_type_options
       WHERE organization_id = $1
         AND deleted_at IS NULL
       ORDER BY option_kind ASC, label ASC`,
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
    requireOperationalWrite(currentOrganization);

    const body = await readJson(request);
    const optionKind = normalizeOptionKind(body.option_kind);
    const label = normalizeRequiredText(body.label, "label");

    const restored = await query<CustomTypeOptionRow>(
      `UPDATE custom_type_options
       SET label = $3,
           deleted_at = NULL,
           updated_at = now()
       WHERE organization_id = $1
         AND option_kind = $2
         AND lower(label) = lower($3)
       RETURNING id, option_kind, label, created_at, updated_at`,
      [currentOrganization.organization_id, optionKind, label]
    );

    if (restored.rows[0]) {
      return NextResponse.json({ data: restored.rows[0] }, { status: 201 });
    }

    const result = await query<CustomTypeOptionRow>(
      `INSERT INTO custom_type_options (
         organization_id,
         option_kind,
         label
       )
       VALUES ($1, $2, $3)
       RETURNING id, option_kind, label, created_at, updated_at`,
      [currentOrganization.organization_id, optionKind, label]
    );

    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return jsonApiError(error);
  }
}
