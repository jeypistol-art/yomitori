import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireAdminWrite } from "@/lib/permissions";
import { getStripe } from "@/lib/stripe";
import { syncStripeSubscription } from "@/lib/stripe_subscription_sync";

export const dynamic = "force-dynamic";

type SubscriptionRow = {
  stripe_subscription_id: string;
};

export async function POST() {
  try {
    const { currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);

    const result = await query<SubscriptionRow>(
      `SELECT stripe_subscription_id
       FROM subscriptions
       WHERE organization_id = $1
         AND stripe_subscription_id IS NOT NULL
       ORDER BY
         CASE
           WHEN status IN ('active', 'trialing', 'past_due', 'incomplete') THEN 0
           ELSE 1
         END,
         updated_at DESC,
         created_at DESC
       LIMIT 1`,
      [currentOrganization.organization_id]
    );
    const subscriptionId = result.rows[0]?.stripe_subscription_id;
    if (!subscriptionId) {
      throw new ApiError(404, "同期対象のサブスクリプションが見つかりません");
    }

    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    await syncStripeSubscription(subscription);

    return NextResponse.json({
      data: {
        synced: true,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
