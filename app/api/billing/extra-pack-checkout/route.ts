import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { requireBillingAccess } from "@/lib/billing_access";
import { requireAdminWrite } from "@/lib/permissions";
import { getStripe } from "@/lib/stripe";
import {
  getAppBaseUrl,
  getExtraPackPriceConfig,
  getOrCreateStripeCustomerForOrganization,
} from "@/lib/stripe_billing";

export const dynamic = "force-dynamic";

type ExtraPackCheckoutRequest = {
  pack_code?: unknown;
};

async function readJson(request: Request): Promise<ExtraPackCheckoutRequest> {
  return request.json().catch(() => ({}));
}

function getStripeErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    "message" in error &&
    String((error as { type?: unknown }).type).startsWith("Stripe")
  ) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : null;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const { session, currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);
    await requireBillingAccess(
      currentOrganization.organization_id,
      "extra_pack_purchase"
    );

    const body = await readJson(request);
    const packCode = typeof body.pack_code === "string" ? body.pack_code : "";
    const pack = getExtraPackPriceConfig(packCode);
    if (!pack) {
      throw new ApiError(400, "Invalid pack_code");
    }

    const customerId = await getOrCreateStripeCustomerForOrganization({
      organizationId: currentOrganization.organization_id,
      organizationName: currentOrganization.organization_name,
      fallbackEmail: session.user?.email,
    });
    const appBaseUrl = getAppBaseUrl();
    const metadata = {
      item_type: "extra_pack",
      organization_id: currentOrganization.organization_id,
      member_id: currentOrganization.member_id,
      pack_code: pack.code,
      purchased_count: String(pack.quantity),
      price_yen: String(pack.priceYen),
    };

    const checkoutSession = await getStripe().checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: currentOrganization.organization_id,
      line_items: [
        {
          price: pack.priceId,
          quantity: 1,
        },
      ],
      success_url: `${appBaseUrl}/usage?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appBaseUrl}/usage?checkout=cancel`,
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    return NextResponse.json({
      data: {
        checkout_url: checkoutSession.url,
      },
    });
  } catch (error) {
    const stripeMessage = getStripeErrorMessage(error);
    if (stripeMessage) {
      return jsonApiError(new ApiError(400, stripeMessage));
    }
    return jsonApiError(error);
  }
}
