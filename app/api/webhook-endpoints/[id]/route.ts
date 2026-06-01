import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import { requireAdminWrite } from "@/lib/permissions";
import {
  createWebhookSecret,
  maskWebhookSecret,
  normalizeWebhookEventTypes,
} from "@/lib/webhook_events";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type WebhookEndpointRow = {
  id: string;
  name: string;
  url: string;
  secret: string;
  event_types: string[];
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
};

async function readJson(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "Invalid JSON");
  }
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeWebhookUrl(value: unknown) {
  const text = normalizeText(value);
  if (!text) {
    throw new ApiError(400, "url is required");
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new ApiError(400, "url is invalid");
  }
  if (url.protocol !== "https:") {
    throw new ApiError(400, "url must start with https://");
  }
  return url.toString();
}

function publicEndpoint(row: WebhookEndpointRow, newSecret?: string) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    event_types: row.event_types,
    is_enabled: row.is_enabled,
    secret_preview: maskWebhookSecret(row.secret),
    new_secret: newSecret,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "api_webhooks");
    requireAdminWrite(currentOrganization);

    const body = await readJson(request);
    const name = normalizeText(body.name);
    if (!name) {
      throw new ApiError(400, "name is required");
    }
    const eventTypes = normalizeWebhookEventTypes(body.event_types);
    if (eventTypes.length === 0) {
      throw new ApiError(400, "event_types is required");
    }
    const newSecret = body.rotate_secret === true ? createWebhookSecret() : null;

    const result = await query<WebhookEndpointRow>(
      `UPDATE webhook_endpoints
       SET
         name = $3,
         url = $4,
         event_types = $5::jsonb,
         is_enabled = $6,
         secret = COALESCE($7::text, secret),
         updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL
       RETURNING
         id,
         name,
         url,
         secret,
         event_types,
         is_enabled,
         created_at,
         updated_at`,
      [
        id,
        currentOrganization.organization_id,
        name,
        normalizeWebhookUrl(body.url),
        JSON.stringify(eventTypes),
        body.is_enabled !== false,
        newSecret,
      ]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "webhook endpoint not found");
    }

    return NextResponse.json({
      data: publicEndpoint(result.rows[0], newSecret ?? undefined),
    });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "api_webhooks");
    requireAdminWrite(currentOrganization);

    const result = await query<{ id: string }>(
      `UPDATE webhook_endpoints
       SET deleted_at = now(),
           is_enabled = false,
           updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND deleted_at IS NULL
       RETURNING id`,
      [id, currentOrganization.organization_id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "webhook endpoint not found");
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    return jsonApiError(error);
  }
}
