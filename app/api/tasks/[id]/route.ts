import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import { normalizeNullableText } from "@/lib/master_data";
import { requireOperationalWrite, requireTaskDelete } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const taskStatuses = new Set([
  "todo",
  "in_progress",
  "waiting_review",
  "done",
  "unnecessary",
  "canceled",
]);

const taskPriorities = new Set(["low", "normal", "high", "urgent"]);

function normalizeDate(value: unknown) {
  const text = normalizeNullableText(value);
  if (!text) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new ApiError(400, "due_date must be YYYY-MM-DD");
  }
  return text;
}

function normalizeStatus(value: unknown) {
  const status = normalizeNullableText(value);
  if (!status || !taskStatuses.has(status)) {
    throw new ApiError(400, "status is invalid");
  }
  return status;
}

function normalizePriority(value: unknown) {
  const priority = normalizeNullableText(value);
  if (!priority || !taskPriorities.has(priority)) {
    throw new ApiError(400, "priority is invalid");
  }
  return priority;
}

async function assertMember(organizationId: string, memberId: string | null) {
  if (!memberId) {
    return null;
  }
  const result = await query(
    `SELECT id
     FROM organization_members
     WHERE organization_id = $1
       AND id = $2
       AND deleted_at IS NULL
     LIMIT 1`,
    [organizationId, memberId]
  );
  if (!result.rows[0]) {
    throw new ApiError(400, "assignee_member_id is invalid");
  }
  return memberId;
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireOperationalWrite(currentOrganization);

    const body = (await request.json().catch(() => ({}))) as {
      title?: unknown;
      description?: unknown;
      status?: unknown;
      priority?: unknown;
      due_date?: unknown;
      assignee_member_id?: unknown;
    };

    const current = await query<{ id: string }>(
      `SELECT id
       FROM tasks
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [currentOrganization.organization_id, id]
    );
    if (!current.rows[0]) {
      throw new ApiError(404, "task not found");
    }

    const title = normalizeNullableText(body.title);
    const description =
      "description" in body ? normalizeNullableText(body.description) : undefined;
    const status = "status" in body ? normalizeStatus(body.status) : undefined;
    const priority = "priority" in body ? normalizePriority(body.priority) : undefined;
    const dueDate = "due_date" in body ? normalizeDate(body.due_date) : undefined;
    const requestedAssigneeMemberId = normalizeNullableText(body.assignee_member_id);
    if (
      "assignee_member_id" in body &&
      requestedAssigneeMemberId &&
      requestedAssigneeMemberId !== currentOrganization.member_id
    ) {
      requireFeatureAccess(currentOrganization.plan_code, "assignee_workflow");
    }
    const assigneeMemberId =
      "assignee_member_id" in body
        ? await assertMember(
            currentOrganization.organization_id,
            requestedAssigneeMemberId
          )
        : undefined;

    if ("title" in body && !title) {
      throw new ApiError(400, "title is required");
    }

    const result = await query(
      `UPDATE tasks
       SET title = COALESCE($3, title),
           description = CASE WHEN $4 THEN $5 ELSE description END,
           status = COALESCE($6::ydt_task_status, status),
           priority = COALESCE($7::ydt_task_priority, priority),
           due_date = CASE WHEN $8 THEN $9 ELSE due_date END,
           assignee_member_id = CASE WHEN $10 THEN $11 ELSE assignee_member_id END,
           completed_at = CASE
             WHEN $6 = 'done' AND completed_at IS NULL THEN now()
             WHEN $6 IS NOT NULL AND $6 <> 'done' THEN NULL
             ELSE completed_at
           END,
           completed_by_member_id = CASE
             WHEN $6 = 'done' THEN $12
             WHEN $6 IS NOT NULL AND $6 <> 'done' THEN NULL
             ELSE completed_by_member_id
           END,
           updated_at = now()
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
       RETURNING id, title, status::text AS status, due_date::text AS due_date, priority::text AS priority`,
      [
        currentOrganization.organization_id,
        id,
        "title" in body ? title : null,
        "description" in body,
        description ?? null,
        status ?? null,
        priority ?? null,
        "due_date" in body,
        dueDate,
        "assignee_member_id" in body,
        assigneeMemberId,
        currentOrganization.member_id,
      ]
    );

    if (status && ["done", "unnecessary", "canceled"].includes(status)) {
      await query(
        `UPDATE reminders
         SET status = 'canceled',
             updated_at = now()
         WHERE organization_id = $1
           AND task_id = $2
           AND status = 'scheduled'`,
        [currentOrganization.organization_id, id]
      );
    }

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireTaskDelete(currentOrganization);

    const result = await query(
      `UPDATE tasks
       SET deleted_at = now(),
           updated_at = now()
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
       RETURNING id, title`,
      [currentOrganization.organization_id, id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "task not found");
    }

    await query(
      `UPDATE reminders
       SET status = 'canceled',
           updated_at = now()
       WHERE organization_id = $1
         AND task_id = $2
         AND status = 'scheduled'`,
      [currentOrganization.organization_id, id]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return jsonApiError(error);
  }
}
