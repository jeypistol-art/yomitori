import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { getEmailDeliveryStatus } from "@/lib/email_delivery";

type OnboardingSummaryRow = {
  managed_asset_count: number;
  counterparty_count: number;
  member_count: number;
  non_owner_member_count: number;
  document_count: number;
  approved_document_count: number;
  scheduled_reminder_count: number;
  failed_reminder_count: number;
};

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const result = await query<OnboardingSummaryRow>(
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
         ) AS member_count,
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
             AND status = 'approved'
         ) AS approved_document_count,
         (
           SELECT count(*)::int
           FROM reminders
           WHERE organization_id = $1
             AND status = 'scheduled'
         ) AS scheduled_reminder_count,
         (
           SELECT count(*)::int
           FROM reminders
           WHERE organization_id = $1
             AND status = 'failed'
         ) AS failed_reminder_count`,
      [currentOrganization.organization_id]
    );

    return NextResponse.json({
      data: {
        ...result.rows[0],
        default_reminder_days_before: [7, 3, 1],
        delivery: getEmailDeliveryStatus(),
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
