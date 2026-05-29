import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { buildDocumentDiff } from "@/lib/document_diff";
import { requireFeatureAccess } from "@/lib/feature_gates";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "document_diff");
    const compareDocumentId = new URL(request.url).searchParams.get(
      "compare_document_id"
    );

    const diff = await buildDocumentDiff({
      organizationId: currentOrganization.organization_id,
      documentId: id,
      compareDocumentId,
    }).catch((error) => {
      if (error instanceof Error && error.message === "document not found") {
        throw new ApiError(404, "document not found");
      }
      if (
        error instanceof Error &&
        error.message === "compare document not found"
      ) {
        throw new ApiError(404, "compare document not found");
      }
      if (
        error instanceof Error &&
        error.message === "cannot compare same document"
      ) {
        throw new ApiError(400, "cannot compare same document");
      }
      if (
        error instanceof Error &&
        error.message === "compare document must be older"
      ) {
        throw new ApiError(400, "compare document must be older");
      }
      throw error;
    });

    return NextResponse.json({ data: diff });
  } catch (error) {
    return jsonApiError(error);
  }
}
