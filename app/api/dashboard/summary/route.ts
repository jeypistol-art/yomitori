import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";

type DashboardStatsRow = {
  managed_asset_count: number;
  counterparty_count: number;
  non_owner_member_count: number;
  document_count: number;
  documents_need_ai: number;
  documents_need_review: number;
  failed_documents: number;
  active_tasks: number;
  overdue_tasks: number;
  today_tasks: number;
  week_tasks: number;
  unassigned_tasks: number;
  due_reminders: number;
  failed_reminders: number;
};

type ActivityRow = {
  documents_registered_7d: number;
  documents_approved_7d: number;
  tasks_done_7d: number;
  reminders_sent_7d: number;
};

type RecentDocumentRow = {
  id: string;
  title: string;
  suggested_title: string | null;
  summary: string | null;
  due_date: string | null;
  status: string;
  document_type: string;
  created_at: string;
};

type NextAction = {
  kind: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  severity: "urgent" | "warning" | "normal" | "complete";
};

function buildNextAction(stats: DashboardStatsRow): NextAction {
  if (stats.failed_reminders > 0) {
    return {
      kind: "failed_reminders",
      title: `送信に失敗したリマインドが${stats.failed_reminders}件あります`,
      body: "通知が届いていない可能性があります。原因を確認して再送してください。",
      href: "/reminders?status=failed",
      cta: "リマインドを確認",
      severity: "urgent",
    };
  }

  if (stats.failed_documents > 0) {
    return {
      kind: "failed_documents",
      title: `処理に失敗した書類が${stats.failed_documents}件あります`,
      body: "AI抽出や登録処理が止まっている書類を先に片付けます。",
      href: "/unprocessed",
      cta: "失敗書類を確認",
      severity: "urgent",
    };
  }

  if (stats.documents_need_review > 0) {
    return {
      kind: "review",
      title: `承認待ちの書類が${stats.documents_need_review}件あります`,
      body: "内容を確認して承認すると、タスクとリマインドまで進められます。",
      href: "/unprocessed",
      cta: "確認を始める",
      severity: "warning",
    };
  }

  if (stats.overdue_tasks > 0) {
    return {
      kind: "overdue_tasks",
      title: `期限切れのタスクが${stats.overdue_tasks}件あります`,
      body: "対応漏れになりやすいタスクから順番に確認します。",
      href: "/tasks?due=overdue",
      cta: "期限切れを見る",
      severity: "urgent",
    };
  }

  if (stats.due_reminders > 0) {
    return {
      kind: "due_reminders",
      title: `送信待ちのリマインドが${stats.due_reminders}件あります`,
      body: "ジョブ実行対象になっている通知を確認できます。",
      href: "/reminders?timing=overdue",
      cta: "通知を確認",
      severity: "warning",
    };
  }

  if (stats.today_tasks > 0) {
    return {
      kind: "today_tasks",
      title: `本日期限のタスクが${stats.today_tasks}件あります`,
      body: "今日中に処理したいタスクを先に見ます。",
      href: "/tasks?due=week",
      cta: "今日のタスクへ",
      severity: "warning",
    };
  }

  if (stats.unassigned_tasks > 0) {
    return {
      kind: "unassigned_tasks",
      title: `担当者未設定のタスクが${stats.unassigned_tasks}件あります`,
      body: "担当者を入れると、通知と引き継ぎが回りやすくなります。",
      href: "/tasks?assignee=unassigned",
      cta: "担当者を設定",
      severity: "normal",
    };
  }

  if (stats.documents_need_ai > 0) {
    return {
      kind: "extract",
      title: `AI抽出待ちの書類が${stats.documents_need_ai}件あります`,
      body: "登録済み書類を解析して、要約とタスク候補を作ります。",
      href: "/documents/new",
      cta: "AI抽出へ",
      severity: "normal",
    };
  }

  if (
    stats.managed_asset_count === 0 ||
    stats.counterparty_count === 0 ||
    stats.non_owner_member_count === 0
  ) {
    return {
      kind: "setup",
      title: "初期設定を整えると、次の書類登録が速くなります",
      body: "管理対象、取引先、担当者を登録しておくと、承認時の割当が迷いません。",
      href: "/setup",
      cta: "初期設定へ",
      severity: "normal",
    };
  }

  if (stats.document_count === 0) {
    return {
      kind: "first_document",
      title: "最初の書類を登録できます",
      body: "メール本文、PDF、画像のどれかを入れてAI抽出を試します。",
      href: "/documents/new",
      cta: "書類を登録",
      severity: "normal",
    };
  }

  return {
    kind: "clear",
    title: "今すぐ対応が必要な項目はありません",
    body: "新しい通知や書類が来たら、ここに次の行動を表示します。",
    href: "/documents/new",
    cta: "書類を登録",
    severity: "complete",
  };
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const organizationId = currentOrganization.organization_id;

    const [stats, activity, recentDocuments] = await Promise.all([
      query<DashboardStatsRow>(
        `SELECT
           (
             SELECT count(*)::int
             FROM managed_assets
             WHERE organization_id = $1
               AND deleted_at IS NULL
           ) AS managed_asset_count,
           (
             SELECT count(*)::int
             FROM counterparties
             WHERE organization_id = $1
               AND deleted_at IS NULL
           ) AS counterparty_count,
           (
             SELECT count(*)::int
             FROM organization_members
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND role <> 'owner'
           ) AS non_owner_member_count,
           (
             SELECT count(*)::int
             FROM documents
             WHERE organization_id = $1
               AND deleted_at IS NULL
           ) AS document_count,
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
               AND due_date = CURRENT_DATE
               AND status IN ('todo', 'in_progress', 'waiting_review')
           ) AS today_tasks,
           (
             SELECT count(*)::int
             FROM tasks
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND due_date IS NOT NULL
               AND due_date <= CURRENT_DATE + INTERVAL '7 days'
               AND status IN ('todo', 'in_progress', 'waiting_review')
           ) AS week_tasks,
           (
             SELECT count(*)::int
             FROM tasks
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND assignee_member_id IS NULL
               AND status IN ('todo', 'in_progress', 'waiting_review')
           ) AS unassigned_tasks,
           (
             SELECT count(*)::int
             FROM reminders
             WHERE organization_id = $1
               AND status = 'scheduled'
               AND remind_at <= now()
           ) AS due_reminders,
           (
             SELECT count(*)::int
             FROM reminders
             WHERE organization_id = $1
               AND status = 'failed'
           ) AS failed_reminders`,
        [organizationId]
      ),
      query<ActivityRow>(
        `SELECT
           (
             SELECT count(*)::int
             FROM documents
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND created_at >= now() - INTERVAL '7 days'
           ) AS documents_registered_7d,
           (
             SELECT count(*)::int
             FROM audit_logs
             WHERE organization_id = $1
               AND action = 'document.approved'
               AND created_at >= now() - INTERVAL '7 days'
           ) AS documents_approved_7d,
           (
             SELECT count(*)::int
             FROM tasks
             WHERE organization_id = $1
               AND deleted_at IS NULL
               AND status = 'done'
               AND updated_at >= now() - INTERVAL '7 days'
           ) AS tasks_done_7d,
           (
             SELECT count(*)::int
             FROM audit_logs
             WHERE organization_id = $1
               AND action = 'reminder.sent'
               AND created_at >= now() - INTERVAL '7 days'
           ) AS reminders_sent_7d`,
        [organizationId]
      ),
      query<RecentDocumentRow>(
        `SELECT
           id,
           title,
           suggested_title,
           summary,
           due_date::text AS due_date,
           status::text AS status,
           document_type::text AS document_type,
           created_at::text AS created_at
         FROM documents
         WHERE organization_id = $1
           AND deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 5`,
        [organizationId]
      ),
    ]);

    const statsRow = stats.rows[0] ?? {
      managed_asset_count: 0,
      counterparty_count: 0,
      non_owner_member_count: 0,
      document_count: 0,
      documents_need_ai: 0,
      documents_need_review: 0,
      failed_documents: 0,
      active_tasks: 0,
      overdue_tasks: 0,
      today_tasks: 0,
      week_tasks: 0,
      unassigned_tasks: 0,
      due_reminders: 0,
      failed_reminders: 0,
    };

    return NextResponse.json({
      data: {
        next_action: buildNextAction(statsRow),
        stats: statsRow,
        activity: activity.rows[0] ?? {
          documents_registered_7d: 0,
          documents_approved_7d: 0,
          tasks_done_7d: 0,
          reminders_sent_7d: 0,
        },
        recent_documents: recentDocuments.rows,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
