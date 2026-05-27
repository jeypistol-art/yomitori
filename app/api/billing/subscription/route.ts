import { NextResponse } from "next/server";
import Stripe from "stripe";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { getBillingAccess } from "@/lib/billing_access";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { getPlanCodeByStripePriceId } from "@/lib/stripe_billing";
import { getPlanCatalogItem } from "@/lib/usage_catalog";

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

type PendingBillingUpdate = {
  source: "pending_update" | "subscription_schedule";
  price_id: string | null;
  plan_code: string | null;
  plan_name: string | null;
  effective_at: string | null;
  expires_at: string | null;
};

function stripeTimestampToIso(value: number | null | undefined) {
  return value ? new Date(value * 1000).toISOString() : null;
}

function stripePriceId(
  value: string | Stripe.Price | Stripe.DeletedPrice | null | undefined
) {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

function pendingUpdateFromPrice(args: {
  source: PendingBillingUpdate["source"];
  priceId: string | null;
  effectiveAt: string | null;
  expiresAt?: string | null;
}) {
  const planCode = getPlanCodeByStripePriceId(args.priceId);
  if (!args.priceId && !planCode) {
    return null;
  }

  return {
    source: args.source,
    price_id: args.priceId,
    plan_code: planCode,
    plan_name: planCode ? getPlanCatalogItem(planCode).name : null,
    effective_at: args.effectiveAt,
    expires_at: args.expiresAt ?? null,
  };
}

function getSchedulePendingUpdate(
  subscription: Stripe.Subscription,
  currentPriceId: string | null
) {
  const schedule = subscription.schedule;
  if (!schedule || typeof schedule === "string") {
    return null;
  }
  if (schedule.status !== "active" && schedule.status !== "not_started") {
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

  const nextPriceId = stripePriceId(nextPhase?.items[0]?.price);
  if (!nextPriceId || nextPriceId === currentPriceId) {
    return null;
  }

  return pendingUpdateFromPrice({
    source: "subscription_schedule",
    priceId: nextPriceId,
    effectiveAt: stripeTimestampToIso(nextPhase?.start_date),
  });
}

function getScheduleCancelAt(subscription: Stripe.Subscription) {
  const schedule = subscription.schedule;
  if (!schedule || typeof schedule === "string" || schedule.end_behavior !== "cancel") {
    return null;
  }
  if (schedule.status !== "active" && schedule.status !== "not_started") {
    return null;
  }

  const lastPhase = [...schedule.phases].sort((a, b) => b.end_date - a.end_date)[0];
  return stripeTimestampToIso(lastPhase?.end_date ?? schedule.current_phase?.end_date);
}

async function getLiveStripeSubscription(row: BillingSubscriptionRow) {
  if (!row.stripe_subscription_id) {
    return {
      ...row,
      cancel_at: null,
      canceled_at: null,
      scheduled_cancel_at: null,
      pending_update: null,
      stripe_sync_warning: null,
    };
  }

  try {
    const subscription = await getStripe().subscriptions.retrieve(
      row.stripe_subscription_id,
      {
        expand: ["schedule"],
      }
    );
    const firstItem = subscription.items.data[0];
    const currentPriceId = firstItem?.price.id ?? row.stripe_price_id;
    const planCode = getPlanCodeByStripePriceId(currentPriceId) ?? row.plan_code;
    const currentPeriodEnd = stripeTimestampToIso(firstItem?.current_period_end);
    const pendingUpdate =
      pendingUpdateFromPrice({
        source: "pending_update",
        priceId: subscription.pending_update?.subscription_items?.[0]?.price.id ?? null,
        effectiveAt:
          stripeTimestampToIso(subscription.pending_update?.billing_cycle_anchor) ??
          currentPeriodEnd,
        expiresAt: stripeTimestampToIso(subscription.pending_update?.expires_at),
      }) ?? getSchedulePendingUpdate(subscription, currentPriceId);
    const scheduledCancelAt =
      stripeTimestampToIso(subscription.cancel_at) ??
      (subscription.cancel_at_period_end ? currentPeriodEnd : null) ??
      getScheduleCancelAt(subscription);

    return {
      ...row,
      stripe_price_id: currentPriceId,
      plan_code: planCode,
      status: subscription.status,
      current_period_start:
        stripeTimestampToIso(firstItem?.current_period_start) ?? row.current_period_start,
      current_period_end: currentPeriodEnd ?? row.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      cancel_at: stripeTimestampToIso(subscription.cancel_at),
      canceled_at: stripeTimestampToIso(subscription.canceled_at),
      scheduled_cancel_at: scheduledCancelAt,
      pending_update: pendingUpdate,
      stripe_sync_warning: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Stripe sync failed";
    return {
      ...row,
      cancel_at: null,
      canceled_at: null,
      scheduled_cancel_at: null,
      pending_update: null,
      stripe_sync_warning: message,
    };
  }
}

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

    const subscription = result.rows[0]
      ? await getLiveStripeSubscription(result.rows[0])
      : null;

    return NextResponse.json({
      data: subscription
        ? {
            ...subscription,
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
