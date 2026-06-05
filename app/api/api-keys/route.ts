import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import {
  createApiKeySecret,
  getApiKeyPrefix,
  hashApiKey,
  maskApiKey,
  normalizeApiKeyScopes,
} from "@/lib/api_keys";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import { requireAdminWrite } from "@/lib/permissions";

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

function publicApiKey(row: ApiKeyRow, newKey?: string) {
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
    new_key: newKey,
  };
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "api_webhooks");

    const result = await query<ApiKeyRow>(
      `SELECT
         id,
         name,
         key_prefix,
         scopes,
         is_enabled,
         last_used_at,
         expires_at,
         created_at,
         updated_at
       FROM api_keys
       WHERE organization_id = $1
         AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [currentOrganization.organization_id]
    );

    return NextResponse.json({
      data: result.rows.map((row) => publicApiKey(row)),
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
    const scopes = normalizeApiKeyScopes(body.scopes);
    if (scopes.length === 0) {
      throw new ApiError(400, "scopes is required");
    }
    const secret = createApiKeySecret();
    const keyHash = await hashApiKey(secret);

    const result = await query<ApiKeyRow>(
      `INSERT INTO api_keys (
         organization_id,
         name,
         key_prefix,
         key_hash,
         scopes,
         is_enabled,
         expires_at,
         created_by_member_id
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)
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
        currentOrganization.organization_id,
        name,
        getApiKeyPrefix(secret),
        keyHash,
        JSON.stringify(scopes),
        body.is_enabled !== false,
        normalizeExpiresAt(body.expires_at),
        currentOrganization.member_id,
      ]
    );

    return NextResponse.json(
      { data: publicApiKey(result.rows[0], secret) },
      { status: 201 }
    );
  } catch (error) {
    return jsonApiError(error);
  }
}
