import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { buildDocumentDiff } from "@/lib/document_diff";
import { requireFeatureAccess } from "@/lib/feature_gates";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "document_diff");

    const diff = await buildDocumentDiff({
      organizationId: currentOrganization.organization_id,
      documentId: id,
    }).catch((error) => {
      if (error instanceof Error && error.message === "document not found") {
        throw new ApiError(404, "document not found");
      }
      throw error;
    });

    return NextResponse.json({ data: diff });
  } catch (error) {
    return jsonApiError(error);
  }
}
