import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { requireFeatureAccess } from "@/lib/feature_gates";
import { requireAdminWrite } from "@/lib/permissions";
import { sendWebhookTestDelivery } from "@/lib/webhook_events";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "api_webhooks");
    requireAdminWrite(currentOrganization);

    const result = await sendWebhookTestDelivery({
      organizationId: currentOrganization.organization_id,
      endpointId: id,
    });

    if (!result) {
      throw new ApiError(404, "webhook endpoint not found");
    }

    return NextResponse.json({ data: result });
  } catch (error) {
    return jsonApiError(error);
  }
}
