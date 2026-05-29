import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { canUseFeature, requireFeatureAccess } from "@/lib/feature_gates";

type PendingDocumentRow = {
  id: string;
  title: string;
  suggested_title: string | null;
  summary: string | null;
  due_date: string | null;
  document_type: string;
  source_type: string;
  status: string;
  file_count: number;
  duplicate_count: number;
  priority_rank: number;
  priority_label: string;
  priority_reason: string;
  created_at: string;
  updated_at: string;
};

type PendingTaskRow = {
  id: string;
  document_id: string | null;
  document_title: string | null;
  title: string;
  description: string | null;
  assignee_member_id: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  due_date: string | null;
  priority: string;
  status: string;
  reminder_count: number;
  next_remind_at: string | null;
  created_at: string;
  updated_at: string;
};

type QueueStatsRow = {
  documents_need_ai: number;
  documents_need_review: number;
  failed_documents: number;
  active_tasks: number;
  overdue_tasks: number;
  unassigned_tasks: number;
};

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    requireFeatureAccess(currentOrganization.plan_code, "monthly_work_queue");
    const canUsePriorityProcessing = canUseFeature(
      currentOrganization.plan_code,
      "priority_processing"
    );
    const organizationId = currentOrganization.organization_id;

    const [documents, tasks, stats] = await Promise.all([
      query<PendingDocumentRow>(
        `SELECT
           d.id,
           d.title,
           d.suggested_title,
           d.summary,
           d.due_date::text AS due_date,
           d.document_type::text AS document_type,
           d.source_type::text AS source_type,
           d.status::text AS status,
           count(DISTINCT df.id)::int AS file_count,
           CASE
             WHEN d.status = 'failed' THEN 100
             WHEN d.due_date IS NOT NULL AND d.due_date < CURRENT_DATE THEN 95
             WHEN d.status = 'action_required' THEN 85
             WHEN d.due_date IS NOT NULL AND d.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 80
             WHEN jsonb_array_length(d.risks) > 0 THEN 70
             WHEN d.status = 'needs_review' THEN 60
             WHEN d.status = 'uploaded' THEN 50
             ELSE 40
           END AS priority_rank,
           CASE
             WHEN d.status = 'failed' THEN '至急'
             WHEN d.due_date IS NOT NULL AND d.due_date < CURRENT_DATE THEN '至急'
             WHEN d.status = 'action_required' THEN '高'
             WHEN d.due_date IS NOT NULL AND d.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN '高'
             WHEN jsonb_array_length(d.risks) > 0 THEN '高'
             ELSE '通常'
           END AS priority_label,
           CASE
             WHEN d.status = 'failed' THEN 'AI抽出に失敗しています'
             WHEN d.due_date IS NOT NULL AND d.due_date < CURRENT_DATE THEN '期限を過ぎています'
             WHEN d.status = 'action_required' THEN '対応タスク候補があります'
             WHEN d.due_date IS NOT NULL AND d.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN '期限が7日以内です'
             WHEN jsonb_array_length(d.risks) > 0 THEN '注意点があります'
             WHEN d.status = 'needs_review' THEN '承認確認が必要です'
             WHEN d.status = 'uploaded' THEN 'AI抽出待ちです'
             ELSE '未処理です'
           END AS priority_reason,
           (
             SELECT count(DISTINCT d2.id)::int
             FROM documents d2
             LEFT JOIN document_files df2
               ON df2.organization_id = d2.organization_id
              AND df2.document_id = d2.id
              AND df2.deleted_at IS NULL
             WHERE d2.organization_id = d.organization_id
               AND d2.id <> d.id
               AND d2.deleted_at IS NULL
               AND (
                 (
                   d.source_text IS NOT NULL
                   AND d2.source_text IS NOT NULL
                   AND md5(d2.source_text) = md5(d.source_text)
                 )
                 OR EXISTS (
                   SELECT 1
                   FROM document_files df_self
                   JOIN document_files df_other
                     ON df_other.organization_id = df_self.organization_id
                    AND df_other.document_id = d2.id
                    AND df_other.deleted_at IS NULL
                    AND df_other.sha256 = df_self.sha256
                   WHERE df_self.organization_id = d.organization_id
                     AND df_self.document_id = d.id
                     AND df_self.deleted_at IS NULL
                     AND df_self.sha256 IS NOT NULL
                 )
               )
           ) AS duplicate_count,
           d.created_at,
           d.updated_at
         FROM documents d
         LEFT JOIN document_files df
           ON df.organization_id = d.organization_id
          AND df.document_id = d.id
          AND df.deleted_at IS NULL
         WHERE d.organization_id = $1
           AND d.deleted_at IS NULL
           AND d.status IN ('uploaded', 'processing', 'needs_review', 'action_required', 'failed')
         GROUP BY d.id
         ORDER BY
           CASE WHEN $2::boolean THEN
             CASE
               WHEN d.status = 'failed' THEN 100
               WHEN d.due_date IS NOT NULL AND d.due_date < CURRENT_DATE THEN 95
               WHEN d.status = 'action_required' THEN 85
               WHEN d.due_date IS NOT NULL AND d.due_date <= CURRENT_DATE + INTERVAL '7 days' THEN 80
               WHEN jsonb_array_length(d.risks) > 0 THEN 70
               WHEN d.status = 'needs_review' THEN 60
               WHEN d.status = 'uploaded' THEN 50
               ELSE 40
             END
           END DESC NULLS LAST,
           CASE WHEN NOT $2::boolean THEN
             CASE d.status
             WHEN 'failed' THEN 0
             WHEN 'action_required' THEN 1
             WHEN 'needs_review' THEN 2
             WHEN 'uploaded' THEN 3
             ELSE 4
             END
           END,
           d.due_date ASC NULLS LAST,
           d.created_at DESC
         LIMIT 100`,
        [organizationId, canUsePriorityProcessing]
      ),
      query<PendingTaskRow>(
        `SELECT
           t.id,
           t.document_id,
           d.title AS document_title,
           t.title,
           t.description,
           t.assignee_member_id,
           u.name AS assignee_name,
           u.email AS assignee_email,
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
         WHERE t.organization_id = $1
           AND t.deleted_at IS NULL
           AND t.status IN ('todo', 'in_progress', 'waiting_review')
         GROUP BY t.id, d.title, u.name, u.email
         ORDER BY
           CASE
             WHEN t.due_date IS NULL THEN 2
             WHEN t.due_date < CURRENT_DATE THEN 0
             ELSE 1
           END,
           CASE WHEN $2::boolean THEN
             CASE t.priority
               WHEN 'urgent' THEN 0
               WHEN 'high' THEN 1
               WHEN 'normal' THEN 2
               ELSE 3
             END
           END ASC NULLS LAST,
           t.due_date ASC NULLS LAST,
           CASE WHEN NOT $2::boolean THEN
             CASE t.priority
               WHEN 'urgent' THEN 1
               WHEN 'high' THEN 2
               WHEN 'normal' THEN 3
               ELSE 4
             END
           END,
           t.created_at DESC
         LIMIT 100`,
        [organizationId, canUsePriorityProcessing]
      ),
      query<QueueStatsRow>(
        `SELECT
           (
             SELECT count(*)::int
             FROM documents
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND status IN ('uploaded', 'processing')
           ) AS documents_need_ai,
           (
             SELECT count(*)::int
             FROM documents
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND status IN ('needs_review', 'action_required')
           ) AS documents_need_review,
           (
             SELECT count(*)::int
             FROM documents
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND status = 'failed'
           ) AS failed_documents,
           (
             SELECT count(*)::int
             FROM tasks
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND status IN ('todo', 'in_progress', 'waiting_review')
           ) AS active_tasks,
           (
             SELECT count(*)::int
             FROM tasks
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND due_date IS NOT NULL
               AND due_date < CURRENT_DATE
               AND status IN ('todo', 'in_progress', 'waiting_review')
           ) AS overdue_tasks,
           (
             SELECT count(*)::int
             FROM tasks
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND assignee_member_id IS NULL
               AND status IN ('todo', 'in_progress', 'waiting_review')
           ) AS unassigned_tasks`,
        [organizationId]
      ),
    ]);

    return NextResponse.json({
      data: {
        documents: documents.rows,
        tasks: tasks.rows,
        stats: stats.rows[0],
        features: {
          priority_processing: canUsePriorityProcessing,
        },
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
