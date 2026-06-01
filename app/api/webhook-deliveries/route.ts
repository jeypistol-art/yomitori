import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";

type WebhookDeliveryRow = {
  id: string;
  endpoint_id: string;
  endpoint_name: string;
  event_id: string;
  event_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  next_attempt_at: string;
  last_attempt_at: string | null;
  delivered_at: string | null;
  response_status: number | null;
  error_message: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "api_webhooks");
    const { searchParams } = new URL(request.url);
    const endpointId = searchParams.get("endpoint_id");
    const params: unknown[] = [currentOrganization.organization_id];
    const where = ["wd.organization_id = $1"];
    if (endpointId) {
      params.push(endpointId);
      where.push(`wd.endpoint_id = $${params.length}`);
    }
    params.push(100);

    const result = await query<WebhookDeliveryRow>(
      `SELECT
         wd.id,
         wd.endpoint_id,
         we.name AS endpoint_name,
         wd.event_id,
         wd.event_type,
         wd.status,
         wd.attempt_count,
         wd.max_attempts,
         wd.next_attempt_at,
         wd.last_attempt_at,
         wd.delivered_at,
         wd.response_status,
         wd.error_message,
         wd.created_at
       FROM webhook_deliveries wd
       JOIN webhook_endpoints we
         ON we.organization_id = wd.organization_id
        AND we.id = wd.endpoint_id
       WHERE ${where.join(" AND ")}
       ORDER BY wd.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return jsonApiError(error);
  }
}
