import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import { requireOperationalWrite } from "@/lib/permissions";
import { safeEnqueueWebhookEvent } from "@/lib/webhook_events";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type DraftRecord = Record<string, unknown>;

type TaskCandidate = {
  title?: unknown;
  action?: unknown;
  task?: unknown;
  description?: unknown;
  due_date?: unknown;
  priority?: unknown;
  assignee_member_id?: unknown;
  create_by_default?: unknown;
  reminder_days_before?: unknown;
};

const documentTypes = new Set([
  "municipal_notice",
  "contract_renewal",
  "lease_renewal",
  "insurance_renewal",
  "tenant_contract_renewal",
  "legal_change_notice",
  "inspection_report",
  "other",
  "unknown",
]);

const taskPriorities = new Set(["low", "normal", "high", "urgent"]);

function asRecord(value: unknown): DraftRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as DraftRecord)
    : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeDate(value: unknown) {
  const text = normalizeText(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function pickDate(record: DraftRecord) {
  return (
    normalizeDate(record.date) ??
    normalizeDate(record.due_date) ??
    normalizeDate(record.deadline) ??
    normalizeDate(record["期限"]) ??
    normalizeDate(record["重要な日付"])
  );
}

function firstText(record: DraftRecord, keys: string[]) {
  for (const key of keys) {
    const value = normalizeText(record[key]);
    if (value) {
      return value;
    }
  }
  return null;
}

function jsonString(value: unknown) {
  return JSON.stringify(value ?? null);
}

function extractTitle(draft: DraftRecord, fallback: string) {
  const summary = asRecord(draft.document_summary);
  return (
    normalizeText(summary.title_candidate) ??
    normalizeText(draft.title) ??
    normalizeText(fallback) ??
    null
  );
}

function extractDocumentType(draft: DraftRecord) {
  const classification = asRecord(draft.document_classification);
  const value = normalizeText(classification.document_type);
  return value && documentTypes.has(value) ? value : "unknown";
}

function extractSummary(draft: DraftRecord) {
  const summary = asRecord(draft.document_summary);
  return (
    normalizeText(summary.one_line_summary) ??
    normalizeText(summary.detailed_summary) ??
    normalizeText(asArray(summary.short_summary)[0]) ??
    null
  );
}

function extractKeyPoints(draft: DraftRecord) {
  const summary = asRecord(draft.document_summary);
  return asArray(summary.key_points)
    .map((point) => {
      if (typeof point === "string") {
        return point;
      }
      return firstText(asRecord(point), [
        "text",
        "key_point",
        "point",
        "content",
        "内容",
        "title",
        "description",
      ]);
    })
    .filter((value): value is string => Boolean(value));
}

function extractPrimaryDueDate(draft: DraftRecord) {
  const primaryDate = asArray(draft.important_dates)
    .map(asRecord)
    .find((item) => item.is_primary_due_date === true);
  return (
    (primaryDate ? pickDate(primaryDate) : null) ??
    pickDate(asRecord(asArray(draft.important_dates)[0])) ??
    pickDate(asRecord(asArray(draft.required_actions)[0])) ??
    pickDate(asRecord(asArray(draft.task_candidates)[0]))
  );
}

function getTaskCandidates(draft: DraftRecord): TaskCandidate[] {
  const candidates = asArray(draft.task_candidates).map(asRecord);
  if (candidates.length > 0) {
    return candidates as TaskCandidate[];
  }
  return asArray(draft.required_actions).map(asRecord) as TaskCandidate[];
}

function normalizeReminderDays(value: unknown) {
  const source = Array.isArray(value) ? value : [7, 3, 1];
  return source
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0 && item <= 30)
    .slice(0, 5);
}

function addDays(dateText: string, offset: number) {
  const date = new Date(`${dateText}T09:00:00+09:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString();
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireOperationalWrite(currentOrganization);

    const body = (await request.json().catch(() => ({}))) as {
      draft?: unknown;
      comment?: unknown;
      create_tasks?: unknown;
    };
    const draft = asRecord(body.draft);
    if (Object.keys(draft).length === 0) {
      throw new ApiError(400, "draft is required");
    }

    const document = await query<{ id: string; title: string; metadata: unknown }>(
      `SELECT id, title, metadata
       FROM documents
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [currentOrganization.organization_id, id]
    );
    if (!document.rows[0]) {
      throw new ApiError(404, "document not found");
    }

    const approvedTitle = extractTitle(draft, document.rows[0].title);
    if (!approvedTitle) {
      throw new ApiError(400, "title is required");
    }

    const documentType = extractDocumentType(draft);
    const dueDate = extractPrimaryDueDate(draft);
    const summary = extractSummary(draft);
    const keyPoints = extractKeyPoints(draft);
    const requiredActions = asArray(draft.required_actions);
    const requiredDocuments = asArray(draft.required_documents);
    const risks = asArray(draft.risks_and_notes);
    const taskCandidates =
      body.create_tasks === false ? [] : getTaskCandidates(draft);
    const hasTeamAssignee = taskCandidates.some((task) => {
      const assigneeId = normalizeText(task.assignee_member_id);
      return Boolean(assigneeId && assigneeId !== currentOrganization.member_id);
    });
    if (hasTeamAssignee) {
      requireFeatureAccess(currentOrganization.plan_code, "assignee_workflow");
    }
    const extractionId =
      normalizeText(asRecord(document.rows[0].metadata).latest_extraction_id) ?? null;

    const approvedDocument = await query(
      `UPDATE documents
       SET title = $3,
           suggested_title = $3,
           document_type = $4,
           status = 'approved',
           due_date = $5,
           summary = $6,
           key_points = $7::jsonb,
           required_actions = $8::jsonb,
           required_documents = $9::jsonb,
           risks = $10::jsonb,
           approved_at = now(),
           approved_by_member_id = $11,
           metadata = metadata || $12::jsonb,
           updated_at = now()
       WHERE organization_id = $1
         AND id = $2
       RETURNING id, title, status::text AS status, approved_at`,
      [
        currentOrganization.organization_id,
        id,
        approvedTitle,
        documentType,
        dueDate,
        summary,
        jsonString(keyPoints),
        jsonString(requiredActions),
        jsonString(requiredDocuments),
        jsonString(risks),
        currentOrganization.member_id,
        jsonString({ approved_from_review: true }),
      ]
    );

    await query(
      `INSERT INTO review_drafts (
         organization_id,
         document_id,
         edited_by_member_id,
         draft_json,
         version
       )
       VALUES ($1, $2, $3, $4::jsonb, 1)
       ON CONFLICT (document_id)
       DO UPDATE SET
         edited_by_member_id = EXCLUDED.edited_by_member_id,
         draft_json = EXCLUDED.draft_json,
         version = review_drafts.version + 1,
         updated_at = now()`,
      [
        currentOrganization.organization_id,
        id,
        currentOrganization.member_id,
        jsonString(draft),
      ]
    );

    const createdTasks: Array<{
      id: string;
      title: string;
      due_date: string | null;
      priority: string;
      assignee_member_id: string | null;
    }> = [];
    const fallbackDueDate = extractPrimaryDueDate(draft);
    if (body.create_tasks !== false) {
      for (const task of taskCandidates) {
        if (task.create_by_default === false) {
          continue;
        }
        const title = firstText(asRecord(task), [
          "title",
          "task",
          "task_description",
          "action",
          "action_description",
          "label",
        ]);
        if (!title) {
          continue;
        }
        const due = pickDate(asRecord(task)) ?? fallbackDueDate;
        const priorityValue = normalizeText(task.priority);
        const priority = priorityValue && taskPriorities.has(priorityValue) ? priorityValue : "normal";
        const assigneeId = normalizeText(task.assignee_member_id);

        const created = await query<{
          id: string;
          title: string;
          due_date: string | null;
          priority: string;
          assignee_member_id: string | null;
        }>(
          `INSERT INTO tasks (
             organization_id,
             document_id,
             title,
             description,
             assignee_member_id,
             created_by_member_id,
             due_date,
             priority,
             status
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'todo')
           RETURNING
             id,
             title,
             due_date::text AS due_date,
             priority::text AS priority,
             assignee_member_id`,
          [
            currentOrganization.organization_id,
            id,
            title,
            firstText(asRecord(task), [
              "description",
              "detail",
              "reason",
              "task_description",
              "action_description",
            ]),
            assigneeId,
            currentOrganization.member_id,
            due,
            priority,
          ]
        );
        const taskRow = created.rows[0];
        createdTasks.push(taskRow);

        if (assigneeId && due) {
          for (const daysBefore of normalizeReminderDays(task.reminder_days_before)) {
            await query(
              `INSERT INTO reminders (
                 organization_id,
                 task_id,
                 recipient_member_id,
                 channel,
                 remind_at,
                 status
               )
               VALUES ($1, $2, $3, 'email', $4, 'scheduled')`,
              [
                currentOrganization.organization_id,
                taskRow.id,
                assigneeId,
                addDays(due, -daysBefore),
              ]
            );
          }
        }
      }
    }

    const snapshot = {
      document: approvedDocument.rows[0],
      draft,
      created_tasks: createdTasks,
    };

    await query(
      `INSERT INTO document_approvals (
         organization_id,
         document_id,
         extraction_id,
         approved_by_member_id,
         approval_status,
         comment,
         approved_snapshot
       )
       VALUES ($1, $2, $3, $4, 'approved', $5, $6::jsonb)`,
      [
        currentOrganization.organization_id,
        id,
        extractionId,
        currentOrganization.member_id,
        normalizeText(body.comment),
        jsonString(snapshot),
      ]
    );

    await query(
      `INSERT INTO audit_logs (
         organization_id,
         actor_member_id,
         action,
         target_type,
         target_id,
         after_json
       )
       VALUES ($1, $2, 'document.approved', 'document', $3, $4::jsonb)`,
      [
        currentOrganization.organization_id,
        currentOrganization.member_id,
        id,
        jsonString({
          document: approvedDocument.rows[0],
          created_task_count: createdTasks.length,
        }),
      ]
    );
    await safeEnqueueWebhookEvent({
      organizationId: currentOrganization.organization_id,
      eventType: "document.approved",
      data: {
        document: approvedDocument.rows[0],
        created_task_count: createdTasks.length,
        tasks: createdTasks,
      },
    });
    for (const task of createdTasks) {
      await safeEnqueueWebhookEvent({
        organizationId: currentOrganization.organization_id,
        eventType: "task.created",
        data: {
          task,
          document: approvedDocument.rows[0],
        },
      });
    }

    return NextResponse.json({
      data: {
        document: approvedDocument.rows[0],
        created_tasks: createdTasks,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
