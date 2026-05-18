import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireMasterDataWrite } from "@/lib/master_data";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonString(value: unknown) {
  return JSON.stringify(value ?? null);
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireMasterDataWrite(currentOrganization);

    const result = await query<{ id: string; title: string }>(
      `UPDATE documents
       SET deleted_at = now(),
           status = 'archived',
           updated_at = now()
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
       RETURNING id, title`,
      [currentOrganization.organization_id, id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "document not found");
    }

    await query(
      `UPDATE document_files
       SET deleted_at = now()
       WHERE organization_id = $1
         AND document_id = $2
         AND deleted_at IS NULL`,
      [currentOrganization.organization_id, id]
    );

    await query(
      `UPDATE tasks
       SET deleted_at = now(),
           updated_at = now()
       WHERE organization_id = $1
         AND document_id = $2
         AND deleted_at IS NULL`,
      [currentOrganization.organization_id, id]
    );

    await query(
      `INSERT INTO audit_logs (
         organization_id,
         actor_member_id,
         action,
         target_type,
         target_id,
         after_json
       )
       VALUES ($1, $2, 'document.deleted', 'document', $3, $4::jsonb)`,
      [
        currentOrganization.organization_id,
        currentOrganization.member_id,
        id,
        jsonString({ document: result.rows[0] }),
      ]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return jsonApiError(error);
  }
}
