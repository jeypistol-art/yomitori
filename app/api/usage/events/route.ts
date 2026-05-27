import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type UsageEventRow = {
  id: string;
  event_type: string;
  quantity: number;
  reason: string | null;
  document_id: string | null;
  document_title: string | null;
  actor_name: string | null;
  actor_email: string | null;
  stripe_payment_intent_id: string | null;
  period_start: string;
  period_end: string;
  created_at: string;
};

type UsageEventSummaryRow = {
  consumed_current_period: string;
  purchased_current_period: string;
  refunded_current_period: string;
};

function toNumber(value: string | number | null | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const organizationId = currentOrganization.organization_id;

    const [events, summary] = await Promise.all([
      query<UsageEventRow>(
        `SELECT
           ue.id::text AS id,
           ue.event_type,
           ue.quantity,
           ue.reason,
           ue.document_id::text AS document_id,
           d.title AS document_title,
           u.name AS actor_name,
           u.email AS actor_email,
           ue.stripe_payment_intent_id,
           up.period_start::text AS period_start,
           up.period_end::text AS period_end,
           ue.created_at::text AS created_at
         FROM usage_events ue
         JOIN usage_periods up
           ON up.organization_id = ue.organization_id
          AND up.id = ue.usage_period_id
         LEFT JOIN documents d
           ON d.organization_id = ue.organization_id
          AND d.id = ue.document_id
         LEFT JOIN organization_members om
           ON om.organization_id = ue.organization_id
          AND om.id = ue.created_by_member_id
         LEFT JOIN users u
           ON u.id = om.user_id
         WHERE ue.organization_id = $1
         ORDER BY ue.created_at DESC
         LIMIT 50`,
        [organizationId]
      ),
      query<UsageEventSummaryRow>(
        `SELECT
           COALESCE(sum(ue.quantity) FILTER (
             WHERE ue.event_type = 'consume'
               AND current_date BETWEEN up.period_start AND up.period_end
           ), 0)::text AS consumed_current_period,
           COALESCE(sum(ue.quantity) FILTER (
             WHERE ue.event_type = 'purchase_extra'
               AND current_date BETWEEN up.period_start AND up.period_end
           ), 0)::text AS purchased_current_period,
           COALESCE(sum(ue.quantity) FILTER (
             WHERE ue.event_type = 'refund'
               AND current_date BETWEEN up.period_start AND up.period_end
           ), 0)::text AS refunded_current_period
         FROM usage_events ue
         JOIN usage_periods up
           ON up.organization_id = ue.organization_id
          AND up.id = ue.usage_period_id
         WHERE ue.organization_id = $1`,
        [organizationId]
      ),
    ]);

    const summaryRow = summary.rows[0];
    return NextResponse.json({
      data: {
        summary: {
          consumed_current_period: toNumber(summaryRow?.consumed_current_period),
          purchased_current_period: toNumber(summaryRow?.purchased_current_period),
          refunded_current_period: toNumber(summaryRow?.refunded_current_period),
        },
        events: events.rows,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
