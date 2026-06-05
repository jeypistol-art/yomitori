import { NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireExternalApiContext } from "@/lib/external_api_auth";
import type { ExternalApiContext } from "@/lib/external_api_auth";
import {
  getErrorStatus,
  logExternalApiRequest,
} from "@/lib/external_api_logs";

type ExternalDocumentRow = {
  id: string;
  title: string;
  suggested_title: string | null;
  summary: string | null;
  document_type: string;
  source_type: string;
  status: string;
  document_date: string | null;
  due_date: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
  file_count: number;
  task_count: number;
  latest_extraction_status: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  managed_assets: Array<{
    id: string;
    name: string;
    code: string | null;
    asset_type: string;
  }>;
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
  const startedAt = Date.now();
  let context: ExternalApiContext | null = null;
  try {
    context = await requireExternalApiContext(request, "documents:read");
    const { searchParams } = new URL(request.url);
    const limit = normalizeLimit(searchParams.get("limit"));
    const status = normalizeText(searchParams.get("status"));
    const before = normalizeText(searchParams.get("before"));
    const updatedSince = normalizeText(searchParams.get("updated_since"));

    const where = ["d.organization_id = $1", "d.deleted_at IS NULL"];
    const params: unknown[] = [context.organizationId];

    if (status && status !== "all") {
      params.push(status);
      where.push(`d.status = $${params.length}::ydt_document_status`);
    }
    if (before) {
      params.push(before);
      where.push(`d.created_at < $${params.length}::timestamptz`);
    }
    if (updatedSince) {
      params.push(updatedSince);
      where.push(`d.updated_at >= $${params.length}::timestamptz`);
    }

    params.push(limit);
    const result = await query<ExternalDocumentRow>(
      `SELECT
         d.id,
         d.title,
         d.suggested_title,
         d.summary,
         d.document_type::text AS document_type,
         d.source_type::text AS source_type,
         d.status::text AS status,
         d.document_date::text AS document_date,
         d.due_date::text AS due_date,
         d.counterparty_id,
         c.name AS counterparty_name,
         count(DISTINCT df.id)::int AS file_count,
         count(DISTINCT t.id)::int AS task_count,
         ae.status::text AS latest_extraction_status,
         d.approved_at,
         d.completed_at,
         d.created_at,
         d.updated_at,
         COALESCE(
           jsonb_agg(
             DISTINCT jsonb_build_object(
               'id', ma.id,
               'name', ma.name,
               'code', ma.code,
               'asset_type', ma.asset_type
             )
           ) FILTER (WHERE ma.id IS NOT NULL),
           '[]'::jsonb
         ) AS managed_assets
       FROM documents d
       LEFT JOIN counterparties c
         ON c.organization_id = d.organization_id
        AND c.id = d.counterparty_id
        AND c.deleted_at IS NULL
       LEFT JOIN document_files df
         ON df.organization_id = d.organization_id
        AND df.document_id = d.id
        AND df.deleted_at IS NULL
       LEFT JOIN tasks t
         ON t.organization_id = d.organization_id
        AND t.document_id = d.id
        AND t.deleted_at IS NULL
       LEFT JOIN ai_extractions ae
         ON ae.organization_id = d.organization_id
        AND ae.id::text = d.metadata->>'latest_extraction_id'
       LEFT JOIN document_assets da
         ON da.organization_id = d.organization_id
        AND da.document_id = d.id
       LEFT JOIN managed_assets ma
         ON ma.organization_id = da.organization_id
        AND ma.id = da.managed_asset_id
        AND ma.deleted_at IS NULL
       WHERE ${where.join(" AND ")}
       GROUP BY d.id, c.name, ae.status
       ORDER BY d.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const rows = result.rows;
    const nextBefore = rows.length === limit ? rows[rows.length - 1].created_at : null;

    await logExternalApiRequest({
      request,
      context,
      requiredScope: "documents:read",
      statusCode: 200,
      startedAt,
    });

    return NextResponse.json({
      data: rows,
      meta: {
        limit,
        next_before: nextBefore,
      },
    });
  } catch (error) {
    await logExternalApiRequest({
      request,
      context,
      requiredScope: "documents:read",
      statusCode: getErrorStatus(error),
      startedAt,
      error,
    });
    return jsonApiError(error);
  }
}
