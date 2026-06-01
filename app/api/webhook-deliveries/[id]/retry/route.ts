import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import { requireAdminWrite } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "api_webhooks");
    requireAdminWrite(currentOrganization);

    const result = await query<{ id: string }>(
      `UPDATE webhook_deliveries
       SET status = 'queued',
           next_attempt_at = now(),
           error_message = NULL,
           updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND status IN ('failed', 'dead')
       RETURNING id`,
      [id, currentOrganization.organization_id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "webhook delivery not found");
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    return jsonApiError(error);
  }
}
