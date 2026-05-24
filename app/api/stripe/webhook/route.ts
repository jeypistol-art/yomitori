import Stripe from "stripe";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getOrCreateCurrentUsagePeriod } from "@/lib/usage_limits";
import { findExtraPackCatalogItem } from "@/lib/usage_catalog";
import { getPlanCodeByStripePriceId } from "@/lib/stripe_billing";

export const dynamic = "force-dynamic";

type OrganizationPlanRow = {
  plan_code: string;
};

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is missing");
  }
  return secret;
}

function metadataValue(
  metadata: Stripe.Metadata | null | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" ? value : "";
}

function stripeReferenceId<T extends { id: string }>(
  value: string | T | null | undefined
) {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

function nullableUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  )
    ? value
    : null;
}

function stripeTimestampToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

async function beginStripeEvent(event: Stripe.Event) {
  const result = await query<{ processed_at: string | null }>(
    `INSERT INTO stripe_events (stripe_event_id, event_type, payload)
     VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (stripe_event_id)
     DO UPDATE SET
       event_type = EXCLUDED.event_type,
       payload = EXCLUDED.payload
     RETURNING processed_at`,
    [event.id, event.type, JSON.stringify(event)]
  );

  return !result.rows[0]?.processed_at;
}

async function markStripeEventProcessed(eventId: string) {
  await query(
    `UPDATE stripe_events
     SET processed_at = now(),
         error_message = NULL
     WHERE stripe_event_id = $1`,
    [eventId]
  );
}

async function markStripeEventFailed(eventId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown webhook error";
  await query(
    `UPDATE stripe_events
     SET error_message = $2
     WHERE stripe_event_id = $1`,
    [eventId, message.slice(0, 1000)]
  );
}

async function getOrganizationPlan(organizationId: string) {
  const result = await query<OrganizationPlanRow>(
    `SELECT plan_code::text AS plan_code
     FROM organizations
     WHERE id = $1
       AND deleted_at IS NULL`,
    [organizationId]
  );
  return result.rows[0]?.plan_code ?? null;
}

async function fulfillExtraPackCheckout(session: Stripe.Checkout.Session) {
  const organizationId = metadataValue(session.metadata, "organization_id");
  const packCode = metadataValue(session.metadata, "pack_code");
  const memberId = nullableUuid(metadataValue(session.metadata, "member_id"));
  const pack = findExtraPackCatalogItem(packCode);

  if (!organizationId || !pack) {
    throw new Error("Extra pack checkout metadata is invalid");
  }

  const planCode = await getOrganizationPlan(organizationId);
  if (!planCode) {
    throw new Error("Organization for extra pack checkout was not found");
  }

  const period = await getOrCreateCurrentUsagePeriod({
    organizationId,
    planCode,
  });
  const paymentIntentId = stripeReferenceId(session.payment_intent);

  await query(
    `WITH inserted AS (
       INSERT INTO extra_packs (
         organization_id,
         usage_period_id,
         pack_code,
         purchased_count,
         price_yen,
         stripe_checkout_session_id,
         stripe_payment_intent_id
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (stripe_checkout_session_id)
       WHERE stripe_checkout_session_id IS NOT NULL
       DO NOTHING
       RETURNING organization_id, usage_period_id, purchased_count
     ),
     updated AS (
       UPDATE usage_periods up
       SET purchased_extra_count = up.purchased_extra_count + inserted.purchased_count,
           updated_at = now()
       FROM inserted
       WHERE up.organization_id = inserted.organization_id
         AND up.id = inserted.usage_period_id
       RETURNING
         inserted.organization_id,
         inserted.usage_period_id,
         inserted.purchased_count
     )
     INSERT INTO usage_events (
       organization_id,
       usage_period_id,
       event_type,
       quantity,
       reason,
       stripe_payment_intent_id,
       created_by_member_id
     )
     SELECT
       organization_id,
       usage_period_id,
       'purchase_extra',
       purchased_count,
       $8,
       $7,
       $9::uuid
     FROM updated`,
    [
      organizationId,
      period.id,
      pack.code,
      pack.quantity,
      pack.priceYen,
      session.id,
      paymentIntentId,
      `stripe_checkout:${pack.code}`,
      memberId,
    ]
  );
}

async function upsertSubscription(subscription: Stripe.Subscription) {
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

async function handleCheckoutSession(
  session: Stripe.Checkout.Session,
  eventType: string
) {
  const itemType = metadataValue(session.metadata, "item_type");

  if (itemType === "extra_pack") {
    if (eventType === "checkout.session.async_payment_failed") {
      return;
    }
    if (
      eventType === "checkout.session.completed" &&
      session.payment_status !== "paid"
    ) {
      return;
    }
    await fulfillExtraPackCheckout(session);
    return;
  }

  if (itemType === "subscription") {
    const subscriptionId = stripeReferenceId(session.subscription);
    if (!subscriptionId) {
      return;
    }
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
    await upsertSubscription(subscription);
  }
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
    case "checkout.session.async_payment_failed":
    case "checkout.session.expired":
      await handleCheckoutSession(
        event.data.object as Stripe.Checkout.Session,
        event.type
      );
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await upsertSubscription(event.data.object as Stripe.Subscription);
      return;
    case "invoice.payment_succeeded":
    case "invoice.payment_failed":
      return;
    default:
      return;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 });
  }

  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = await getStripe().webhooks.constructEventAsync(
      body,
      signature,
      getWebhookSecret(),
      undefined,
      Stripe.createSubtleCryptoProvider()
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const shouldProcess = await beginStripeEvent(event);
  if (!shouldProcess) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  try {
    await handleStripeEvent(event);
    await markStripeEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    await markStripeEventFailed(event.id, error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
