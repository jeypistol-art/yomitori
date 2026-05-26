import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireAdminWrite } from "@/lib/permissions";
import { getStripe } from "@/lib/stripe";
import { getAppBaseUrl } from "@/lib/stripe_billing";

export const dynamic = "force-dynamic";

type CustomerRow = {
  stripe_customer_id: string | null;
};

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

export async function POST() {
  try {
    const { currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);

    const result = await query<CustomerRow>(
      `SELECT stripe_customer_id
       FROM organizations
       WHERE id = $1
         AND deleted_at IS NULL`,
      [currentOrganization.organization_id]
    );
    const customerId = result.rows[0]?.stripe_customer_id;
    if (!customerId) {
      throw new ApiError(404, "Stripe顧客がまだ作成されていません");
    }

    const appBaseUrl = getAppBaseUrl();
    const portalConfigurationId =
      process.env.STRIPE_BILLING_PORTAL_CONFIGURATION_ID?.trim();
    const session = await getStripe().billingPortal.sessions.create({
      customer: customerId,
      ...(portalConfigurationId ? { configuration: portalConfigurationId } : {}),
      locale: "ja",
      return_url: `${appBaseUrl}/usage?billing_portal=return`,
    });

    return NextResponse.json({
      data: {
        portal_url: session.url,
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
