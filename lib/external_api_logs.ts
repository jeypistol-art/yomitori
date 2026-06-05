import { ApiError } from "@/lib/api_errors";
import type { ApiKeyScope } from "@/lib/api_keys";
import { query } from "@/lib/db";
import type { ExternalApiContext } from "@/lib/external_api_auth";

export function getErrorStatus(error: unknown) {
  return error instanceof ApiError ? error.status : 500;
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function getClientIp(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

export async function logExternalApiRequest(args: {
  request: Request;
  context: ExternalApiContext | null;
  requiredScope: ApiKeyScope;
  statusCode: number;
  startedAt: number;
  error?: unknown;
}) {
  if (!args.context) {
    return;
  }
  const url = new URL(args.request.url);
  const durationMs = Math.max(0, Date.now() - args.startedAt);

  try {
    await query(
      `INSERT INTO api_request_logs (
         organization_id,
         api_key_id,
         method,
         path,
         query_string,
         required_scope,
         status_code,
         duration_ms,
         ip_address,
         user_agent,
         error_message
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        args.context.organizationId,
        args.context.apiKeyId,
        args.request.method,
        url.pathname,
        url.search ? url.search.slice(1) : null,
        args.requiredScope,
        args.statusCode,
        durationMs,
        getClientIp(args.request),
        args.request.headers.get("user-agent"),
        args.error ? getErrorMessage(args.error).slice(0, 500) : null,
      ]
    );
  } catch (error) {
    console.error("External API log failed", error);
  }
}
