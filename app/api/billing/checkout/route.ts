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

    const activeSubscription = await query<{ id: string }>(
      `SELECT id
       FROM subscriptions
       WHERE organization_id = $1
         AND status IN ('active', 'trialing', 'past_due', 'incomplete')
       ORDER BY created_at DESC
       LIMIT 1`,
      [currentOrganization.organization_id]
    );
    if (activeSubscription.rows[0]) {
      throw new ApiError(
        409,
        "既存サブスクリプションのプラン変更は管理画面実装後に有効化します"
      );
    }

    const customerId = await getOrCreateStripeCustomerForOrganization({
      organizationId: currentOrganization.organization_id,
      organizationName: currentOrganization.organization_name,
      fallbackEmail: session.user?.email,
    });
    const appBaseUrl = getAppBaseUrl();
    const metadata = {
      item_type: "subscription",
      organization_id: currentOrganization.organization_id,
      member_id: currentOrganization.member_id,
      plan_code: plan.code,
    };

    const checkoutSession = await getStripe().checkout.sessions.create({
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
