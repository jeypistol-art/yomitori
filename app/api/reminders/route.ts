import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";

type ReminderRow = {
  id: string;
  task_id: string;
  task_title: string;
  task_status: string;
  task_due_date: string | null;
  document_id: string | null;
  document_title: string | null;
  recipient_member_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  channel: string;
  remind_at: string;
  status: string;
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
};

const reminderStatuses = new Set(["scheduled", "sent", "canceled", "failed"]);

export async function GET(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "scheduled";
    const timing = searchParams.get("timing") ?? "all";

    const where = ["r.organization_id = $1"];
    const params: unknown[] = [currentOrganization.organization_id];

    if (status !== "all" && reminderStatuses.has(status)) {
      params.push(status);
      where.push(`r.status = $${params.length}::ydt_reminder_status`);
    }
    if (timing === "overdue") {
      where.push("r.remind_at < now()");
    } else if (timing === "today") {
      where.push("r.remind_at >= date_trunc('day', now())");
      where.push("r.remind_at < date_trunc('day', now()) + INTERVAL '1 day'");
    } else if (timing === "week") {
      where.push("r.remind_at < now() + INTERVAL '7 days'");
    }

    const result = await query<ReminderRow>(
      `SELECT
         r.id,
         r.task_id,
         t.title AS task_title,
         t.status::text AS task_status,
         t.due_date::text AS task_due_date,
         t.document_id,
         d.title AS document_title,
         r.recipient_member_id,
         u.name AS recipient_name,
         u.email AS recipient_email,
         r.channel::text AS channel,
         r.remind_at::text AS remind_at,
         r.status::text AS status,
         r.sent_at::text AS sent_at,
         r.error_message,
         r.created_at
       FROM reminders r
       JOIN tasks t
         ON t.organization_id = r.organization_id
        AND t.id = r.task_id
        AND t.deleted_at IS NULL
       LEFT JOIN documents d
         ON d.organization_id = t.organization_id
        AND d.id = t.document_id
        AND d.deleted_at IS NULL
       JOIN organization_members om
         ON om.organization_id = r.organization_id
        AND om.id = r.recipient_member_id
        AND om.deleted_at IS NULL
       JOIN users u
         ON u.id = om.user_id
        AND u.deleted_at IS NULL
       WHERE ${where.join(" AND ")}
       ORDER BY r.remind_at ASC, r.created_at DESC
       LIMIT 200`,
      params
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return jsonApiError(error);
  }
}
