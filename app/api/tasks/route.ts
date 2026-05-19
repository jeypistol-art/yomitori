import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";

type TaskRow = {
  id: string;
  document_id: string | null;
  document_title: string | null;
  document_status: string | null;
  title: string;
  description: string | null;
  assignee_member_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  created_by_member_id: string;
  due_date: string | null;
  priority: string;
  status: string;
  reminder_count: number;
  next_remind_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function GET(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const assignee = searchParams.get("assignee");
    const due = searchParams.get("due");

    const where: string[] = [
      "t.organization_id = $1",
      "t.deleted_at IS NULL",
    ];
    const params: unknown[] = [currentOrganization.organization_id];

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

    const result = await query<TaskRow>(
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
         t.created_by_member_id,
         t.due_date::text AS due_date,
         t.priority::text AS priority,
         t.status::text AS status,
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
       LIMIT 200`,
      params
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return jsonApiError(error);
  }
}
