import Stripe from "stripe";
import { query } from "@/lib/db";
import { getPlanCodeByStripePriceId } from "@/lib/stripe_billing";

function stripeReferenceId<T extends { id: string }>(
  value: string | T | null | undefined
) {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

function stripeTimestampToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function metadataValue(
  metadata: Stripe.Metadata | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const customerId = stripeReferenceId(subscription.customer);
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const metadata = subscription.metadata;
  let organizationId = metadataValue(metadata, "organization_id");
  const planCode =
    metadataValue(metadata, "plan_code") || getPlanCodeByStripePriceId(priceId);

  if (!organizationId && customerId) {
    const organization = await query<{ id: string }>(
      `SELECT id
       FROM organizations
       WHERE stripe_customer_id = $1
         AND deleted_at IS NULL
       LIMIT 1`,
      [customerId]
    );
    organizationId = organization.rows[0]?.id ?? "";
  }

  if (!organizationId || !customerId || !planCode) {
    return;
  }

  const firstItem = subscription.items.data[0];
  const currentPeriodStart = stripeTimestampToIso(firstItem?.current_period_start);
  const currentPeriodEnd = stripeTimestampToIso(firstItem?.current_period_end);
  const shouldUsePlan = ["active", "trialing", "past_due"].includes(subscription.status);
  const shouldDowngrade = ["canceled", "unpaid", "incomplete_expired"].includes(
    subscription.status
  );

  await query(
    `WITH saved AS (
       INSERT INTO subscriptions (
         organization_id,
         stripe_subscription_id,
         stripe_customer_id,
         stripe_price_id,
         plan_code,
         status,
         current_period_start,
         current_period_end,
         cancel_at_period_end
       )
       VALUES ($1, $2, $3, $4, $5::ydt_plan_code, $6, $7, $8, $9)
       ON CONFLICT (stripe_subscription_id)
       WHERE stripe_subscription_id IS NOT NULL
       DO UPDATE SET
         stripe_customer_id = EXCLUDED.stripe_customer_id,
         stripe_price_id = EXCLUDED.stripe_price_id,
         plan_code = EXCLUDED.plan_code,
         status = EXCLUDED.status,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = EXCLUDED.cancel_at_period_end,
         updated_at = now()
       RETURNING organization_id, plan_code, stripe_customer_id
     )
     UPDATE organizations o
     SET stripe_customer_id = COALESCE(o.stripe_customer_id, saved.stripe_customer_id),
         plan_code = CASE
           WHEN $10::boolean THEN saved.plan_code
           WHEN $11::boolean THEN 'personal'::ydt_plan_code
           ELSE o.plan_code
         END,
         updated_at = now()
     FROM saved
     WHERE o.id = saved.organization_id
       AND o.deleted_at IS NULL`,
    [
      organizationId,
      subscription.id,
      customerId,
      priceId,
      planCode,
      subscription.status,
      currentPeriodStart,
      currentPeriodEnd,
      subscription.cancel_at_period_end,
      shouldUsePlan,
      shouldDowngrade,
    ]
  );
}
