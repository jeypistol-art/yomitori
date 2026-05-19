import { escapeHtml, sendEmail } from "@/lib/email_delivery";
import { query } from "@/lib/db";

type DueReminderRow = {
  reminder_id: string;
  organization_id: string;
  organization_name: string;
  task_id: string;
  task_title: string;
  task_description: string | null;
  task_due_date: string | null;
  task_status: string;
  document_id: string | null;
  document_title: string | null;
  recipient_member_id: string;
  recipient_name: string | null;
  recipient_email: string | null;
  channel: string;
  remind_at: string;
};

type ProcessedReminder = {
  id: string;
  status: "sent" | "failed";
  channel: string;
  provider: string | null;
  error: string | null;
};

export type ProcessDueRemindersResult = {
  scanned: number;
  sent: number;
  failed: number;
  canceled_completed: number;
  reminders: ProcessedReminder[];
};

function getBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3100"
  ).replace(/\/$/, "");
}

function parseBatchSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 50;
  }
  return Math.min(parsed, 200);
}

function truncateError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 500);
}

function formatDate(value: string | null) {
  if (!value) {
    return "期限なし";
  }
  return value;
}

function buildReminderEmail(reminder: DueReminderRow) {
  const baseUrl = getBaseUrl();
  const taskUrl = `${baseUrl}/tasks`;
  const documentUrl = reminder.document_id
    ? `${baseUrl}/documents/${reminder.document_id}/review`
    : null;
  const subject = `【YOMITORI】${reminder.task_title} のリマインド`;
  const documentLine = reminder.document_title
    ? `書類: ${reminder.document_title}`
    : "書類: 未設定";
  const text = [
    `${reminder.recipient_name ?? "担当者"} 様`,
    "",
    "対応予定のタスクがあります。",
    "",
    `タスク: ${reminder.task_title}`,
    documentLine,
    `期限: ${formatDate(reminder.task_due_date)}`,
    `組織: ${reminder.organization_name}`,
    "",
    `タスク一覧: ${taskUrl}`,
    documentUrl ? `書類確認: ${documentUrl}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.7; color: #1f2933;">
      <p>${escapeHtml(reminder.recipient_name ?? "担当者")} 様</p>
      <p>対応予定のタスクがあります。</p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr><th style="text-align:left; padding:6px 12px; background:#f3f4f6;">タスク</th><td style="padding:6px 12px;">${escapeHtml(reminder.task_title)}</td></tr>
        <tr><th style="text-align:left; padding:6px 12px; background:#f3f4f6;">書類</th><td style="padding:6px 12px;">${escapeHtml(reminder.document_title ?? "未設定")}</td></tr>
        <tr><th style="text-align:left; padding:6px 12px; background:#f3f4f6;">期限</th><td style="padding:6px 12px;">${escapeHtml(formatDate(reminder.task_due_date))}</td></tr>
        <tr><th style="text-align:left; padding:6px 12px; background:#f3f4f6;">組織</th><td style="padding:6px 12px;">${escapeHtml(reminder.organization_name)}</td></tr>
      </table>
      <p><a href="${escapeHtml(taskUrl)}">タスク一覧を開く</a></p>
      ${
        documentUrl
          ? `<p><a href="${escapeHtml(documentUrl)}">書類確認画面を開く</a></p>`
          : ""
      }
    </div>
  `;

  return { subject, text, html };
}

async function markFailed(reminder: DueReminderRow, error: unknown) {
  const errorMessage = truncateError(error);
  await query(
    `UPDATE reminders
     SET status = 'failed',
         error_message = $3,
         updated_at = now()
     WHERE organization_id = $1
       AND id = $2
       AND status = 'scheduled'`,
    [reminder.organization_id, reminder.reminder_id, errorMessage]
  );
  return errorMessage;
}

async function createNotification(reminder: DueReminderRow) {
  const bodyParts = [
    reminder.document_title ? `書類: ${reminder.document_title}` : null,
    reminder.task_due_date ? `期限: ${reminder.task_due_date}` : null,
  ].filter(Boolean);

  await query(
    `INSERT INTO notifications (
       organization_id,
       recipient_member_id,
       notification_type,
       title,
       body,
       target_type,
       target_id
     )
     VALUES ($1, $2, 'task_reminder', $3, $4, 'task', $5)`,
    [
      reminder.organization_id,
      reminder.recipient_member_id,
      reminder.task_title,
      bodyParts.join("\n") || null,
      reminder.task_id,
    ]
  );
}

export async function processDueReminders(args: { limit?: number } = {}) {
  const limit = parseBatchSize(args.limit ?? process.env.NOTIFICATION_JOB_BATCH_SIZE);

  const canceledCompleted = await query<{ id: string }>(
    `UPDATE reminders r
     SET status = 'canceled',
         updated_at = now()
     FROM tasks t
     WHERE t.organization_id = r.organization_id
       AND t.id = r.task_id
       AND r.status = 'scheduled'
       AND t.status IN ('done', 'unnecessary', 'canceled')
     RETURNING r.id`
  );

  const due = await query<DueReminderRow>(
    `SELECT
       r.id AS reminder_id,
       r.organization_id,
       o.name AS organization_name,
       r.task_id,
       t.title AS task_title,
       t.description AS task_description,
       t.due_date::text AS task_due_date,
       t.status::text AS task_status,
       t.document_id,
       d.title AS document_title,
       r.recipient_member_id,
       u.name AS recipient_name,
       u.email AS recipient_email,
       r.channel::text AS channel,
       r.remind_at::text AS remind_at
     FROM reminders r
     JOIN organizations o
       ON o.id = r.organization_id
      AND o.deleted_at IS NULL
     JOIN tasks t
       ON t.organization_id = r.organization_id
      AND t.id = r.task_id
      AND t.deleted_at IS NULL
      AND t.status NOT IN ('done', 'unnecessary', 'canceled')
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
     WHERE r.status = 'scheduled'
       AND r.remind_at <= now()
     ORDER BY r.remind_at ASC
     LIMIT $1`,
    [limit]
  );

  const processed: ProcessedReminder[] = [];

  for (const reminder of due.rows) {
    try {
      let provider: string | null = "in_app";
      if (reminder.channel === "email") {
        if (!reminder.recipient_email) {
          throw new Error("recipient email is missing");
        }
        const email = buildReminderEmail(reminder);
        const result = await sendEmail({
          to: reminder.recipient_email,
          subject: email.subject,
          text: email.text,
          html: email.html,
        });
        provider = result.provider;
      }

      await createNotification(reminder);
      await query(
        `UPDATE reminders
         SET status = 'sent',
             sent_at = now(),
             error_message = NULL,
             updated_at = now()
         WHERE organization_id = $1
           AND id = $2
           AND status = 'scheduled'`,
        [reminder.organization_id, reminder.reminder_id]
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
         VALUES ($1, NULL, 'reminder.sent', 'reminder', $2, $3::jsonb)`,
        [
          reminder.organization_id,
          reminder.reminder_id,
          JSON.stringify({
            task_id: reminder.task_id,
            channel: reminder.channel,
            provider,
          }),
        ]
      );
      processed.push({
        id: reminder.reminder_id,
        status: "sent",
        channel: reminder.channel,
        provider,
        error: null,
      });
    } catch (error) {
      const errorMessage = await markFailed(reminder, error);
      processed.push({
        id: reminder.reminder_id,
        status: "failed",
        channel: reminder.channel,
        provider: null,
        error: errorMessage,
      });
    }
  }

  return {
    scanned: due.rows.length,
    sent: processed.filter((item) => item.status === "sent").length,
    failed: processed.filter((item) => item.status === "failed").length,
    canceled_completed: canceledCompleted.rowCount,
    reminders: processed,
  } satisfies ProcessDueRemindersResult;
}
