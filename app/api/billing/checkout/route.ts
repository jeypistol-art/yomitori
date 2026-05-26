import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireAdminWrite } from "@/lib/permissions";
import { getStripe } from "@/lib/stripe";
import {
  getAppBaseUrl,
  getOrCreateStripeCustomerForOrganization,
  getPlanPriceConfig,
} from "@/lib/stripe_billing";

export const dynamic = "force-dynamic";

type CheckoutRequest = {
  plan_code?: unknown;
};

function stripeReferenceId<T extends { id: string }>(
  value: string | T | null | undefined
) {
  if (!value) {
    return null;
  }
  return typeof value === "string" ? value : value.id;
}

async function readJson(request: Request): Promise<CheckoutRequest> {
  return request.json().catch(() => ({}));
}

export async function POST(request: Request) {
  try {
    const { session, currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);

    const body = await readJson(request);
    const planCode = typeof body.plan_code === "string" ? body.plan_code : "";
    const plan = getPlanPriceConfig(planCode);
    if (!plan) {
      throw new ApiError(400, "Invalid plan_code");
    }
    if (plan.code === currentOrganization.plan_code) {
      throw new ApiError(400, "現在のプランと同じです");
    }

    const appBaseUrl = getAppBaseUrl();
    const metadata = {
      item_type: "subscription",
      organization_id: currentOrganization.organization_id,
      member_id: currentOrganization.member_id,
      plan_code: plan.code,
    };
    const stripe = getStripe();

    const activeSubscription = await query<{ stripe_subscription_id: string }>(
      `SELECT stripe_subscription_id
       FROM subscriptions
       WHERE organization_id = $1
         AND status IN ('active', 'trialing', 'past_due', 'incomplete')
         AND stripe_subscription_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [currentOrganization.organization_id]
    );
    const activeSubscriptionId = activeSubscription.rows[0]?.stripe_subscription_id;
    if (activeSubscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(activeSubscriptionId);
      const subscriptionItem = subscription.items.data[0];
      if (!subscriptionItem) {
        throw new ApiError(409, "Subscription item not found");
      }
      const customerId = stripeReferenceId(subscription.customer);
      if (!customerId) {
        throw new ApiError(409, "Subscription customer not found");
      }

      const portalConfigurationId =
        process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim();
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
        locale: "ja",
        return_url: `${appBaseUrl}/usage?plan_change=return`,
        flow_data: {
          type: "subscription_update_confirm",
          subscription_update_confirm: {
            subscription: activeSubscriptionId,
            items: [
              {
                id: subscriptionItem.id,
                price: plan.priceId,
                quantity: 1,
              },
            ],
          },
          after_completion: {
            type: "redirect",
            redirect: {
              return_url: `${appBaseUrl}/usage?plan_change=success`,
            },
          },
        },
      });

      return NextResponse.json({
        data: {
          checkout_url: portalSession.url,
        },
      });
    }

    const customerId = await getOrCreateStripeCustomerForOrganization({
      organizationId: currentOrganization.organization_id,
      organizationName: currentOrganization.organization_name,
      fallbackEmail: session.user?.email,
    });

    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: currentOrganization.organization_id,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: `${appBaseUrl}/usage?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/usage?checkout=cancel`,
      metadata,
      subscription_data: {
        metadata,
      },
    });

    return NextResponse.json({
      data: {
        checkout_url: checkoutSession.url,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
