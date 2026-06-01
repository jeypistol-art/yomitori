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

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "api_webhooks");

    const result = await query<WebhookEndpointRow>(
      `SELECT
         id,
         name,
         url,
         secret,
         event_types,
         is_enabled,
         created_at,
         updated_at
       FROM webhook_endpoints
       WHERE organization_id = $1
         AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [currentOrganization.organization_id]
    );

    return NextResponse.json({
      data: result.rows.map((row) => publicEndpoint(row)),
    });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function POST(request: Request) {
  try {
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
    const secret = createWebhookSecret();

    const result = await query<WebhookEndpointRow>(
      `INSERT INTO webhook_endpoints (
         organization_id,
         name,
         url,
         secret,
         event_types,
         is_enabled,
         created_by_member_id
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
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
        currentOrganization.organization_id,
        name,
        normalizeWebhookUrl(body.url),
        secret,
        JSON.stringify(eventTypes),
        body.is_enabled !== false,
        currentOrganization.member_id,
      ]
    );

    return NextResponse.json(
      { data: publicEndpoint(result.rows[0], secret) },
      { status: 201 }
    );
  } catch (error) {
    return jsonApiError(error);
  }
}
