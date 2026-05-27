import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireAuditRead } from "@/lib/permissions";

type AuditLogRow = {
  id: string;
  actor_member_id: string | null;
  actor_name: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_title: string | null;
  before_json: unknown;
  after_json: unknown;
  created_at: string;
};

type AuditStatsRow = {
  total_30d: number;
  approvals_30d: number;
  deletes_30d: number;
  reminder_sent_30d: number;
};

function normalizeFilter(value: string | null) {
  const trimmed = value?.trim();
  return trimmed && trimmed !== "all" ? trimmed : null;
}

export async function GET(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    requireAuditRead(currentOrganization);

    const { searchParams } = new URL(request.url);
    const action = normalizeFilter(searchParams.get("action"));
    const targetType = normalizeFilter(searchParams.get("target_type"));
    const actor = normalizeFilter(searchParams.get("actor"));

    const where = ["al.organization_id = $1"];
    const params: unknown[] = [currentOrganization.organization_id];

    if (action) {
      params.push(action);
      where.push(`al.action = $${params.length}`);
    }
    if (targetType) {
      params.push(targetType);
      where.push(`al.target_type = $${params.length}`);
    }
    if (actor) {
      if (actor === "system") {
        where.push("al.actor_member_id IS NULL");
      } else {
        params.push(actor);
        where.push(`al.actor_member_id = $${params.length}`);
      }
    }

    const [logs, stats, actors, actions, targetTypes] = await Promise.all([
      query<AuditLogRow>(
        `SELECT
           al.id,
           al.actor_member_id,
           u.name AS actor_name,
           u.email AS actor_email,
           al.action,
           al.target_type,
           al.target_id,
           COALESCE(d.title, t.title, rt.title, target_o.name) AS target_title,
           al.before_json,
           al.after_json,
           al.created_at
         FROM audit_logs al
         LEFT JOIN organization_members om
           ON om.organization_id = al.organization_id
          AND om.id = al.actor_member_id
         LEFT JOIN users u
           ON u.id = om.user_id
         LEFT JOIN documents d
           ON al.target_type = 'document'
          AND d.organization_id = al.organization_id
          AND d.id = al.target_id
         LEFT JOIN tasks t
           ON al.target_type = 'task'
          AND t.organization_id = al.organization_id
          AND t.id = al.target_id
         LEFT JOIN reminders r
           ON al.target_type = 'reminder'
          AND r.organization_id = al.organization_id
          AND r.id = al.target_id
         LEFT JOIN tasks rt
           ON rt.organization_id = r.organization_id
          AND rt.id = r.task_id
         LEFT JOIN organizations target_o
           ON al.target_type = 'organization'
          AND target_o.id = al.target_id
          AND target_o.id = al.organization_id
         WHERE ${where.join(" AND ")}
         ORDER BY al.created_at DESC
         LIMIT 200`,
        params
      ),
      query<AuditStatsRow>(
        `SELECT
           count(*)::int AS total_30d,
           count(*) FILTER (WHERE action = 'document.approved')::int AS approvals_30d,
           count(*) FILTER (WHERE action LIKE '%.deleted')::int AS deletes_30d,
           count(*) FILTER (WHERE action = 'reminder.sent')::int AS reminder_sent_30d
         FROM audit_logs
         WHERE organization_id = $1
           AND created_at >= now() - INTERVAL '30 days'`,
        [currentOrganization.organization_id]
      ),
      query<{ id: string; name: string | null; email: string }>(
        `SELECT DISTINCT om.id, u.name, u.email
         FROM audit_logs al
         JOIN organization_members om
           ON om.organization_id = al.organization_id
          AND om.id = al.actor_member_id
         JOIN users u
           ON u.id = om.user_id
         WHERE al.organization_id = $1
         ORDER BY u.name ASC NULLS LAST, u.email ASC`,
        [currentOrganization.organization_id]
      ),
      query<{ action: string }>(
        `SELECT DISTINCT action
         FROM audit_logs
         WHERE organization_id = $1
         ORDER BY action ASC`,
        [currentOrganization.organization_id]
      ),
      query<{ target_type: string }>(
        `SELECT DISTINCT target_type
         FROM audit_logs
         WHERE organization_id = $1
         ORDER BY target_type ASC`,
        [currentOrganization.organization_id]
      ),
    ]);

    return NextResponse.json({
      data: {
        logs: logs.rows,
        stats: stats.rows[0] ?? {
          total_30d: 0,
          approvals_30d: 0,
          deletes_30d: 0,
          reminder_sent_30d: 0,
        },
        actors: actors.rows,
        actions: actions.rows.map((row) => row.action),
        target_types: targetTypes.rows.map((row) => row.target_type),
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
