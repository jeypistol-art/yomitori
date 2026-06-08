import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireOperationalWrite } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type CustomTypeOptionRow = {
  id: string;
  option_kind: string;
  label: string;
};

async function clearCustomTypeUsage(args: {
  organizationId: string;
  optionKind: string;
  label: string;
}) {
  if (args.optionKind === "asset_type") {
    await query(
      `UPDATE managed_assets
       SET asset_type_label = NULL,
           updated_at = now()
       WHERE organization_id = $1
         AND deleted_at IS NULL
         AND lower(coalesce(asset_type_label, '')) = lower($2)`,
      [args.organizationId, args.label]
    );
    return;
  }

  if (args.optionKind === "counterparty_type") {
    await query(
      `UPDATE counterparties
       SET counterparty_type_label = NULL,
           updated_at = now()
       WHERE organization_id = $1
         AND deleted_at IS NULL
         AND lower(coalesce(counterparty_type_label, '')) = lower($2)`,
      [args.organizationId, args.label]
    );
    return;
  }

  await query(
    `UPDATE documents
     SET metadata = metadata - 'document_type_label',
         updated_at = now()
     WHERE organization_id = $1
       AND deleted_at IS NULL
       AND lower(coalesce(metadata->>'document_type_label', '')) = lower($2)`,
    [args.organizationId, args.label]
  );
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireOperationalWrite(currentOrganization);

    const option = await query<CustomTypeOptionRow>(
      `UPDATE custom_type_options
       SET deleted_at = now(),
           updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL
       RETURNING id, option_kind, label`,
      [id, currentOrganization.organization_id]
    );

    if (!option.rows[0]) {
      throw new ApiError(404, "custom type option not found");
    }

    await clearCustomTypeUsage({
      organizationId: currentOrganization.organization_id,
      optionKind: option.rows[0].option_kind,
      label: option.rows[0].label,
    });

    return NextResponse.json({ data: option.rows[0] });
  } catch (error) {
    return jsonApiError(error);
  }
}
