import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { getR2DocumentsBucket } from "@/lib/r2_documents";

type RouteContext = {
  params: Promise<{ id: string; fileId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id, fileId } = await context.params;
    const { currentOrganization } = await requireApiContext();

    const file = await query<{
      storage_key: string;
      mime_type: string;
      original_filename: string | null;
    }>(
      `SELECT storage_key, mime_type, original_filename
       FROM document_files
       WHERE organization_id = $1
         AND document_id = $2
         AND id = $3
         AND deleted_at IS NULL
       LIMIT 1`,
      [currentOrganization.organization_id, id, fileId]
    );

    if (!file.rows[0]) {
      throw new ApiError(404, "file not found");
    }

    const bucket = await getR2DocumentsBucket();
    if (!bucket?.get) {
      throw new ApiError(500, "R2 bucket get is not configured");
    }
    const object = await bucket.get(file.rows[0].storage_key);
    if (!object) {
      throw new ApiError(404, "file object not found");
    }

    const bytes = await object.arrayBuffer();
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": file.rows[0].mime_type || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(
          file.rows[0].original_filename ?? "document"
        )}"`,
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
