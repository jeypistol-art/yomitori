import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";

type ApiRequestLogRow = {
  id: string;
  api_key_id: string | null;
  api_key_name: string | null;
  method: string;
  path: string;
  query_string: string | null;
  required_scope: string | null;
  status_code: number;
  duration_ms: number;
  ip_address: string | null;
  user_agent: string | null;
  error_message: string | null;
  created_at: string;
};

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) {
    return 100;
  }
  return Math.min(Math.max(parsed, 1), 200);
}

export async function GET(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "api_webhooks");

    const { searchParams } = new URL(request.url);
    const apiKeyId = searchParams.get("api_key_id")?.trim();
    const statusFamily = searchParams.get("status_family")?.trim();
    const params: unknown[] = [currentOrganization.organization_id];
    const where = ["arl.organization_id = $1"];

    if (apiKeyId) {
      params.push(apiKeyId);
      where.push(`arl.api_key_id = $${params.length}`);
    }
    if (statusFamily === "2xx") {
      where.push("arl.status_code >= 200 AND arl.status_code < 300");
    } else if (statusFamily === "4xx") {
      where.push("arl.status_code >= 400 AND arl.status_code < 500");
    } else if (statusFamily === "5xx") {
      where.push("arl.status_code >= 500 AND arl.status_code < 600");
    }

    params.push(normalizeLimit(searchParams.get("limit")));
    const result = await query<ApiRequestLogRow>(
      `SELECT
         arl.id,
         arl.api_key_id,
         ak.name AS api_key_name,
         arl.method,
         arl.path,
         arl.query_string,
         arl.required_scope,
         arl.status_code,
         arl.duration_ms,
         arl.ip_address,
         arl.user_agent,
         arl.error_message,
         arl.created_at
       FROM api_request_logs arl
       LEFT JOIN api_keys ak
         ON ak.organization_id = arl.organization_id
        AND ak.id = arl.api_key_id
       WHERE ${where.join(" AND ")}
       ORDER BY arl.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return jsonApiError(error);
  }
}
