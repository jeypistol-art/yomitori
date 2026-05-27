import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireAuditRead } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type StripeWebhookEventRow = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
};

type StripeWebhookSummaryRow = {
  total_count: string;
  failed_count: string;
  pending_count: string;
  latest_created_at: string | null;
};

function toNumber(value: string | number | null | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    requireAuditRead(currentOrganization);

    const organizationId = currentOrganization.organization_id;
    const subscriptionIds = await query<{ stripe_subscription_id: string }>(
      `SELECT stripe_subscription_id
       FROM subscriptions
       WHERE organization_id = $1
         AND stripe_subscription_id IS NOT NULL`,
      [organizationId]
    );
    const stripeSubscriptionIds = subscriptionIds.rows.map(
      (row) => row.stripe_subscription_id
    );

    const filterParams: unknown[] = [organizationId, stripeSubscriptionIds];
    const organizationFilter = `
      (
        payload #>> '{data,object,metadata,organization_id}' = $1
        OR payload #>> '{data,object,client_reference_id}' = $1
        OR payload #>> '{data,object,subscription_details,metadata,organization_id}' = $1
        OR payload #>> '{data,object,parent,subscription_details,metadata,organization_id}' = $1
        OR (
          cardinality($2::text[]) > 0
          AND (
            payload #>> '{data,object,id}' = ANY($2::text[])
            OR payload #>> '{data,object,subscription}' = ANY($2::text[])
          )
        )
      )`;

    const [events, summary] = await Promise.all([
      query<StripeWebhookEventRow>(
        `SELECT
           id::text AS id,
           stripe_event_id,
           event_type,
           processed_at::text AS processed_at,
           error_message,
           created_at::text AS created_at
         FROM stripe_events
         WHERE ${organizationFilter}
         ORDER BY created_at DESC
         LIMIT 12`,
        filterParams
      ),
      query<StripeWebhookSummaryRow>(
        `SELECT
           count(*)::text AS total_count,
           count(*) FILTER (WHERE error_message IS NOT NULL)::text AS failed_count,
           count(*) FILTER (
             WHERE processed_at IS NULL AND error_message IS NULL
           )::text AS pending_count,
           max(created_at)::text AS latest_created_at
         FROM stripe_events
         WHERE ${organizationFilter}`,
        filterParams
      ),
    ]);

    const summaryRow = summary.rows[0];
    return NextResponse.json({
      data: {
        summary: {
          total_count: toNumber(summaryRow?.total_count),
          failed_count: toNumber(summaryRow?.failed_count),
          pending_count: toNumber(summaryRow?.pending_count),
          latest_created_at: summaryRow?.latest_created_at ?? null,
        },
        events: events.rows,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
