import { NextResponse } from "next/server";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireExternalApiContext } from "@/lib/external_api_auth";
import type { ExternalApiContext } from "@/lib/external_api_auth";
import {
  getErrorStatus,
  logExternalApiRequest,
} from "@/lib/external_api_logs";

type ExternalTaskRow = {
  id: string;
  document_id: string | null;
  document_title: string | null;
  document_status: string | null;
  title: string;
  description: string | null;
  assignee_member_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  completed_at: string | null;
  reminder_count: number;
  next_remind_at: string | null;
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
  const startedAt = Date.now();
  let context: ExternalApiContext | null = null;
  try {
    context = await requireExternalApiContext(request, "tasks:read");
    const { searchParams } = new URL(request.url);
    const limit = normalizeLimit(searchParams.get("limit"));
    const status = normalizeText(searchParams.get("status"));
    const assignee = normalizeText(searchParams.get("assignee"));
    const due = normalizeText(searchParams.get("due"));
    const documentId = normalizeText(searchParams.get("document_id"));
    const before = normalizeText(searchParams.get("before"));
    const updatedSince = normalizeText(searchParams.get("updated_since"));

    const where = ["t.organization_id = $1", "t.deleted_at IS NULL"];
    const params: unknown[] = [context.organizationId];

    if (status && status !== "all") {
      params.push(status);
      where.push(`t.status = $${params.length}::ydt_task_status`);
    }
    if (assignee && assignee !== "all") {
      if (assignee === "unassigned") {
        where.push("t.assignee_member_id IS NULL");
      } else {
        params.push(assignee);
        where.push(`t.assignee_member_id = $${params.length}`);
      }
    }
    if (due === "overdue") {
      where.push("t.due_date IS NOT NULL AND t.due_date < CURRENT_DATE");
      where.push("t.status NOT IN ('done', 'unnecessary', 'canceled')");
    } else if (due === "week") {
      where.push("t.due_date IS NOT NULL AND t.due_date <= CURRENT_DATE + INTERVAL '7 days'");
      where.push("t.status NOT IN ('done', 'unnecessary', 'canceled')");
    } else if (due === "none") {
      where.push("t.due_date IS NULL");
    }
    if (documentId) {
      params.push(documentId);
      where.push(`t.document_id = $${params.length}`);
    }
    if (before) {
      params.push(before);
      where.push(`t.created_at < $${params.length}::timestamptz`);
    }
    if (updatedSince) {
      params.push(updatedSince);
      where.push(`t.updated_at >= $${params.length}::timestamptz`);
    }

    params.push(limit);
    const result = await query<ExternalTaskRow>(
      `SELECT
         t.id,
         t.document_id,
         d.title AS document_title,
         d.status::text AS document_status,
         t.title,
         t.description,
         t.assignee_member_id,
         u.name AS assignee_name,
         u.email AS assignee_email,
         t.due_date::text AS due_date,
         t.priority::text AS priority,
         t.status::text AS status,
         t.completed_at,
         count(r.id)::int AS reminder_count,
         min(r.remind_at)::text AS next_remind_at,
         t.created_at,
         t.updated_at
       FROM tasks t
       LEFT JOIN documents d
         ON d.organization_id = t.organization_id
        AND d.id = t.document_id
        AND d.deleted_at IS NULL
       LEFT JOIN organization_members om
         ON om.organization_id = t.organization_id
        AND om.id = t.assignee_member_id
        AND om.deleted_at IS NULL
       LEFT JOIN users u
         ON u.id = om.user_id
        AND u.deleted_at IS NULL
       LEFT JOIN reminders r
         ON r.organization_id = t.organization_id
        AND r.task_id = t.id
        AND r.status = 'scheduled'
       WHERE ${where.join(" AND ")}
       GROUP BY t.id, d.title, d.status, u.name, u.email
       ORDER BY
         CASE
           WHEN t.status IN ('done', 'unnecessary', 'canceled') THEN 3
           WHEN t.due_date IS NULL THEN 2
           WHEN t.due_date < CURRENT_DATE THEN 0
           ELSE 1
         END,
         t.due_date ASC NULLS LAST,
         CASE t.priority
           WHEN 'urgent' THEN 1
           WHEN 'high' THEN 2
           WHEN 'normal' THEN 3
           ELSE 4
         END,
         t.created_at DESC
       LIMIT $${params.length}`,
      params
    );

    const rows = result.rows;
    const nextBefore = rows.length === limit ? rows[rows.length - 1].created_at : null;

    await logExternalApiRequest({
      request,
      context,
      requiredScope: "tasks:read",
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
      requiredScope: "tasks:read",
      statusCode: getErrorStatus(error),
      startedAt,
      error,
    });
    return jsonApiError(error);
  }
}
