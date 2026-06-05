import { ApiError } from "@/lib/api_errors";
import { hashApiKey, type ApiKeyScope } from "@/lib/api_keys";
import { query } from "@/lib/db";

type ApiKeyContextRow = {
  api_key_id: string;
  organization_id: string;
  organization_name: string;
  plan_code: string;
  scopes: string[];
};

export type ExternalApiContext = {
  apiKeyId: string;
  organizationId: string;
  organizationName: string;
  planCode: string;
  scopes: string[];
};

function getBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new ApiError(401, "Authorization Bearer token is required");
  }
  const token = match[1]?.trim() ?? "";
  if (!token.startsWith("ydt_live_")) {
    throw new ApiError(401, "Invalid API key");
  }
  return token;
}

export async function requireExternalApiContext(
  request: Request,
  requiredScope: ApiKeyScope
): Promise<ExternalApiContext> {
  const token = getBearerToken(request);
  const keyHash = await hashApiKey(token);

  const result = await query<ApiKeyContextRow>(
    `SELECT
       ak.id AS api_key_id,
       ak.organization_id,
       o.name AS organization_name,
       o.plan_code::text AS plan_code,
       ak.scopes
     FROM api_keys ak
     JOIN organizations o
       ON o.id = ak.organization_id
      AND o.deleted_at IS NULL
      AND o.plan_code = 'enterprise'
     WHERE ak.key_hash = $1
       AND ak.revoked_at IS NULL
       AND ak.is_enabled = true
       AND (ak.expires_at IS NULL OR ak.expires_at > now())
     LIMIT 1`,
    [keyHash]
  );

  const row = result.rows[0];
  if (!row) {
    throw new ApiError(401, "Invalid API key");
  }
  if (!row.scopes.includes(requiredScope)) {
    throw new ApiError(403, `Missing API scope: ${requiredScope}`);
  }

  await query(
    `UPDATE api_keys
     SET last_used_at = now(),
         updated_at = now()
     WHERE id = $1
       AND organization_id = $2`,
    [row.api_key_id, row.organization_id]
  );

  return {
    apiKeyId: row.api_key_id,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    planCode: row.plan_code,
    scopes: row.scopes,
  };
}
