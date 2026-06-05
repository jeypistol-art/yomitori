import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { maskApiKey, normalizeApiKeyScopes } from "@/lib/api_keys";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import { requireAdminWrite } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_enabled: boolean;
  last_used_at: string | null;
  expires_at: string | null;
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

function normalizeExpiresAt(value: unknown) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "expires_at is invalid");
  }
  return date.toISOString();
}

function publicApiKey(row: ApiKeyRow) {
  return {
    id: row.id,
    name: row.name,
    key_preview: maskApiKey(row.key_prefix),
    scopes: row.scopes,
    is_enabled: row.is_enabled,
    last_used_at: row.last_used_at,
    expires_at: row.expires_at,
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
    const scopes = normalizeApiKeyScopes(body.scopes);
    if (scopes.length === 0) {
      throw new ApiError(400, "scopes is required");
    }

    const result = await query<ApiKeyRow>(
      `UPDATE api_keys
       SET
         name = $3,
         scopes = $4::jsonb,
         is_enabled = $5,
         expires_at = $6,
         updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND revoked_at IS NULL
       RETURNING
         id,
         name,
         key_prefix,
         scopes,
         is_enabled,
         last_used_at,
         expires_at,
         created_at,
         updated_at`,
      [
        id,
        currentOrganization.organization_id,
        name,
        JSON.stringify(scopes),
        body.is_enabled !== false,
        normalizeExpiresAt(body.expires_at),
      ]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "api key not found");
    }

    return NextResponse.json({ data: publicApiKey(result.rows[0]) });
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
      `UPDATE api_keys
       SET revoked_at = now(),
           is_enabled = false,
           updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND revoked_at IS NULL
       RETURNING id`,
      [id, currentOrganization.organization_id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "api key not found");
    }

    return NextResponse.json({ data: { id } });
  } catch (error) {
    return jsonApiError(error);
  }
}
