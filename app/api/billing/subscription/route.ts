import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { getBillingAccess } from "@/lib/billing_access";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type BillingSubscriptionRow = {
  organization_plan_code: string;
  subscription_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id: string | null;
  stripe_price_id: string | null;
  plan_code: string | null;
  status: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  updated_at: string | null;
};

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const [result, documentProcessingAccess, extraPackAccess] = await Promise.all([
      query<BillingSubscriptionRow>(
        `SELECT
           o.plan_code::text AS organization_plan_code,
           s.id AS subscription_id,
           s.stripe_subscription_id,
           COALESCE(s.stripe_customer_id, o.stripe_customer_id) AS stripe_customer_id,
           s.stripe_price_id,
           s.plan_code::text AS plan_code,
           s.status,
           s.current_period_start::text AS current_period_start,
           s.current_period_end::text AS current_period_end,
           s.cancel_at_period_end,
           s.updated_at::text AS updated_at
         FROM organizations o
         LEFT JOIN LATERAL (
           SELECT *
           FROM subscriptions
           WHERE organization_id = o.id
           ORDER BY
             CASE
               WHEN status IN ('active', 'trialing', 'past_due', 'incomplete') THEN 0
               ELSE 1
             END,
             updated_at DESC,
             created_at DESC
           LIMIT 1
         ) s ON true
         WHERE o.id = $1
           AND o.deleted_at IS NULL`,
        [currentOrganization.organization_id]
      ),
      getBillingAccess(currentOrganization.organization_id, "document_processing"),
      getBillingAccess(currentOrganization.organization_id, "extra_pack_purchase"),
    ]);

    return NextResponse.json({
      data: result.rows[0]
        ? {
            ...result.rows[0],
            billing_access: {
              document_processing: documentProcessingAccess,
              extra_pack_purchase: extraPackAccess,
            },
          }
        : null,
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
