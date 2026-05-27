import Stripe from "stripe";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getPlanCodeByStripePriceId } from "@/lib/stripe_billing";

type SubscriptionSnapshot = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string | null;
  plan_code: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type ExistingSubscriptionRow = {
  stripe_subscription_id: string;
  stripe_customer_id: string;
  stripe_price_id: string | null;
  plan_code: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
};

type ScheduledPlanChange = {
  stripe_subscription_id: string;
  current_price_id: string | null;
  current_plan_code: string;
  scheduled_price_id: string;
  scheduled_plan_code: string | null;
  effective_at: string | null;
  expires_at: string | null;
  source: "pending_update" | "subscription_schedule";
};

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

function stripePriceId(
  value: string | Stripe.Price | Stripe.DeletedPrice | null | undefined
) {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

async function getSubscriptionSchedule(
  subscription: Stripe.Subscription
): Promise<Stripe.SubscriptionSchedule | null> {
  if (!subscription.schedule) {
    return null;
  }
  if (typeof subscription.schedule !== "string") {
    return subscription.schedule;
  }
  return getStripe().subscriptionSchedules.retrieve(subscription.schedule);
}

async function getScheduledPlanChange(args: {
  subscription: Stripe.Subscription;
  currentPriceId: string | null;
  currentPlanCode: string;
  currentPeriodEnd: string | null;
}): Promise<ScheduledPlanChange | null> {
  const pendingPriceId =
    args.subscription.pending_update?.subscription_items?.[0]?.price.id ?? null;
  if (pendingPriceId && pendingPriceId !== args.currentPriceId) {
    const scheduledPlanCode = getPlanCodeByStripePriceId(pendingPriceId);
    return {
      stripe_subscription_id: args.subscription.id,
      current_price_id: args.currentPriceId,
      current_plan_code: args.currentPlanCode,
      scheduled_price_id: pendingPriceId,
      scheduled_plan_code: scheduledPlanCode,
      effective_at:
        stripeTimestampToIso(args.subscription.pending_update?.billing_cycle_anchor) ??
        args.currentPeriodEnd,
      expires_at: stripeTimestampToIso(args.subscription.pending_update?.expires_at),
      source: "pending_update",
    };
  }

  const schedule = await getSubscriptionSchedule(args.subscription);
  if (
    !schedule ||
    (schedule.status !== "active" && schedule.status !== "not_started")
  ) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);
  const nextPhase =
    schedule.current_phase?.end_date
      ? schedule.phases.find(
          (phase) => phase.start_date === schedule.current_phase?.end_date
        )
      : schedule.phases
          .filter((phase) => phase.start_date > now)
          .sort((a, b) => a.start_date - b.start_date)[0];
  const scheduledPriceId = stripePriceId(nextPhase?.items[0]?.price);
  if (!scheduledPriceId || scheduledPriceId === args.currentPriceId) {
    return null;
  }

  const scheduledPlanCode = getPlanCodeByStripePriceId(scheduledPriceId);
  return {
    stripe_subscription_id: args.subscription.id,
    current_price_id: args.currentPriceId,
    current_plan_code: args.currentPlanCode,
    scheduled_price_id: scheduledPriceId,
    scheduled_plan_code: scheduledPlanCode,
    effective_at: stripeTimestampToIso(nextPhase?.start_date) ?? args.currentPeriodEnd,
    expires_at: null,
    source: "subscription_schedule",
  };
}

function buildAuditAction(
  before: ExistingSubscriptionRow | null,
  after: SubscriptionSnapshot
) {
  if (!before) {
    return "billing.subscription_created";
  }
  if (before.status !== "canceled" && after.status === "canceled") {
    return "billing.subscription_canceled";
  }
  if (!before.cancel_at_period_end && after.cancel_at_period_end) {
    return "billing.cancel_scheduled";
  }
  if (before.cancel_at_period_end && !after.cancel_at_period_end) {
    return "billing.cancel_schedule_canceled";
  }
  if (
    before.plan_code !== after.plan_code ||
    before.stripe_price_id !== after.stripe_price_id
  ) {
    return "billing.plan_changed";
  }
  if (before.status !== after.status) {
    return "billing.subscription_status_changed";
  }
  return null;
}

function subscriptionAuditJson(
  snapshot: ExistingSubscriptionRow | SubscriptionSnapshot | null
) {
  if (!snapshot) {
    return null;
  }
  return {
    subscription: {
      stripe_subscription_id: snapshot.stripe_subscription_id,
      stripe_customer_id: snapshot.stripe_customer_id,
      stripe_price_id: snapshot.stripe_price_id,
      plan_code: snapshot.plan_code,
      status: snapshot.status,
      current_period_start: snapshot.current_period_start,
      current_period_end: snapshot.current_period_end,
      cancel_at_period_end: snapshot.cancel_at_period_end,
    },
  };
}

async function insertSubscriptionAuditLog(args: {
  organizationId: string;
  before: ExistingSubscriptionRow | null;
  after: SubscriptionSnapshot;
}) {
  const action = buildAuditAction(args.before, args.after);
  if (!action) {
    return;
  }

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
     VALUES ($1, NULL, $2, 'organization', $1, $3::jsonb, $4::jsonb)`,
    [
      args.organizationId,
      action,
      JSON.stringify(subscriptionAuditJson(args.before)),
      JSON.stringify(subscriptionAuditJson(args.after)),
    ]
  );
}

async function insertScheduledPlanChangeAuditLog(args: {
  organizationId: string;
  scheduledPlanChange: ScheduledPlanChange | null;
}) {
  const scheduled = args.scheduledPlanChange;
  if (!scheduled) {
    return;
  }
  const duplicate = await query<{ id: string }>(
    `SELECT id
     FROM audit_logs
     WHERE organization_id = $1
       AND action = 'billing.plan_change_scheduled'
       AND after_json #>> '{scheduled_change,stripe_subscription_id}' = $2
       AND after_json #>> '{scheduled_change,scheduled_price_id}' = $3
       AND COALESCE(after_json #>> '{scheduled_change,effective_at}', '') = COALESCE($4, '')
     LIMIT 1`,
    [
      args.organizationId,
      scheduled.stripe_subscription_id,
      scheduled.scheduled_price_id,
      scheduled.effective_at,
    ]
  );
  if (duplicate.rows.length > 0) {
    return;
  }

  await query(
    `INSERT INTO audit_logs (
       organization_id,
       actor_member_id,
       action,
       target_type,
       target_id,
       after_json
     )
     VALUES ($1, NULL, 'billing.plan_change_scheduled', 'organization', $1, $2::jsonb)`,
    [
      args.organizationId,
      JSON.stringify({
        scheduled_change: scheduled,
      }),
    ]
  );
}

export async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const customerId = stripeReferenceId(subscription.customer);
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const metadata = subscription.metadata;
  let organizationId = metadataValue(metadata, "organization_id");
  const planCode =
    getPlanCodeByStripePriceId(priceId) || metadataValue(metadata, "plan_code");

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
  let scheduledPlanChange: ScheduledPlanChange | null = null;
  try {
    scheduledPlanChange = await getScheduledPlanChange({
      subscription,
      currentPriceId: priceId,
      currentPlanCode: planCode,
      currentPeriodEnd,
    });
  } catch (error) {
    console.warn("Failed to inspect scheduled Stripe plan change", error);
  }
  const shouldUsePlan = ["active", "trialing", "past_due"].includes(subscription.status);
  const shouldDowngrade = ["canceled", "unpaid", "incomplete_expired"].includes(
    subscription.status
  );
  const nextSnapshot: SubscriptionSnapshot = {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: customerId,
    stripe_price_id: priceId,
    plan_code: planCode,
    status: subscription.status,
    current_period_start: currentPeriodStart,
    current_period_end: currentPeriodEnd,
    cancel_at_period_end: subscription.cancel_at_period_end,
  };
  const existing = await query<ExistingSubscriptionRow>(
    `SELECT
       stripe_subscription_id,
       stripe_customer_id,
       stripe_price_id,
       plan_code::text AS plan_code,
       status,
       current_period_start::text AS current_period_start,
       current_period_end::text AS current_period_end,
       cancel_at_period_end
     FROM subscriptions
     WHERE stripe_subscription_id = $1
        OR (
          organization_id = $2
          AND status IN ('active', 'trialing', 'past_due', 'incomplete')
          AND stripe_subscription_id IS NOT NULL
        )
     ORDER BY
       CASE WHEN stripe_subscription_id = $1 THEN 0 ELSE 1 END,
       updated_at DESC,
       created_at DESC
     LIMIT 1`,
    [subscription.id, organizationId]
  );
  const beforeSnapshot = existing.rows[0] ?? null;

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
  await insertSubscriptionAuditLog({
    organizationId,
    before: beforeSnapshot,
    after: nextSnapshot,
  });
  await insertScheduledPlanChangeAuditLog({
    organizationId,
    scheduledPlanChange,
  });
}
