import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { runDocumentAiExtraction } from "@/lib/document_ai_extraction";
import { requireOperationalWrite } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireOperationalWrite(currentOrganization);

    const document = await query<{ id: string }>(
      `SELECT id
       FROM documents
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [currentOrganization.organization_id, id]
    );

    if (!document.rows[0]) {
      throw new ApiError(404, "document not found");
    }

    await query(
      `INSERT INTO processing_jobs (
         organization_id,
         document_id,
         job_type,
         status,
         started_at
       )
       VALUES ($1, $2, 'ai_extract', 'running', now())`,
      [currentOrganization.organization_id, id]
    );

    const result = await runDocumentAiExtraction({
      organizationId: currentOrganization.organization_id,
      documentId: id,
      memberId: currentOrganization.member_id,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return jsonApiError(error);
  }
}
