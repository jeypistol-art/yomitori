import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireOperationalWrite } from "@/lib/permissions";
import { processDueReminders } from "@/lib/reminder_dispatcher";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ReminderRow = {
  id: string;
  status: string;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireOperationalWrite(currentOrganization);

    const reminder = await query<ReminderRow>(
      `SELECT id, status::text AS status
       FROM reminders
       WHERE organization_id = $1
         AND id = $2`,
      [currentOrganization.organization_id, id]
    );
    if (!reminder.rows[0]) {
      throw new ApiError(404, "reminder not found");
    }

    await query(
      `UPDATE reminders
       SET status = 'scheduled',
           remind_at = now(),
           sent_at = NULL,
           error_message = NULL,
           updated_at = now()
       WHERE organization_id = $1
         AND id = $2`,
      [currentOrganization.organization_id, id]
    );

    await query(
      `INSERT INTO audit_logs (
         organization_id,
         actor_member_id,
         action,
         target_type,
         target_id,
         before_json,
         after_json
       )
       VALUES ($1, $2, 'reminder.retry_requested', 'reminder', $3, $4::jsonb, $5::jsonb)`,
      [
        currentOrganization.organization_id,
        currentOrganization.member_id,
        id,
        JSON.stringify({ status: reminder.rows[0].status }),
        JSON.stringify({ status: "scheduled", remind_at: "now" }),
      ]
    );

    const result = await processDueReminders({
      organizationId: currentOrganization.organization_id,
      reminderId: id,
      limit: 1,
    });

    return NextResponse.json({ data: result });
  } catch (error) {
    return jsonApiError(error);
  }
}
