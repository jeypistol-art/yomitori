import { NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireExternalApiContext } from "@/lib/external_api_auth";

type ExternalWebhookDeliveryRow = {
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
  updated_at: string;
};

function normalizeLimit(value: string | null) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (Number.isNaN(parsed)) {
    return 50;
  }
  return Math.min(Math.max(parsed, 1), 100);
}

function normalizeText(value: string | null) {
  return value?.trim() || null;
}

export async function GET(request: Request) {
  try {
    const context = await requireExternalApiContext(request, "webhooks:read");
    const { searchParams } = new URL(request.url);
    const limit = normalizeLimit(searchParams.get("limit"));
    const endpointId = normalizeText(searchParams.get("endpoint_id"));
    const status = normalizeText(searchParams.get("status"));
    const eventType = normalizeText(searchParams.get("event_type"));
    const before = normalizeText(searchParams.get("before"));
    const updatedSince = normalizeText(searchParams.get("updated_since"));

    const where = ["wd.organization_id = $1"];
    const params: unknown[] = [context.organizationId];

    if (endpointId) {
      params.push(endpointId);
      where.push(`wd.endpoint_id = $${params.length}`);
    }
    if (status && status !== "all") {
      params.push(status);
      where.push(`wd.status = $${params.length}`);
    }
    if (eventType && eventType !== "all") {
      params.push(eventType);
      where.push(`wd.event_type = $${params.length}`);
    }
    if (before) {
      params.push(before);
      where.push(`wd.created_at < $${params.length}::timestamptz`);
    }
    if (updatedSince) {
      params.push(updatedSince);
      where.push(`wd.updated_at >= $${params.length}::timestamptz`);
    }

    params.push(limit);
    const result = await query<ExternalWebhookDeliveryRow>(
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
         wd.created_at,
         wd.updated_at
       FROM webhook_deliveries wd
       JOIN webhook_endpoints we
         ON we.organization_id = wd.organization_id
        AND we.id = wd.endpoint_id
       WHERE ${where.join(" AND ")}
       ORDER BY wd.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const rows = result.rows;
    const nextBefore = rows.length === limit ? rows[rows.length - 1].created_at : null;

    return NextResponse.json({
      data: rows,
      meta: {
        limit,
        next_before: nextBefore,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
