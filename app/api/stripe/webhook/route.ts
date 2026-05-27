import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import {
  beginStripeEvent,
  markStripeEventFailed,
  markStripeEventProcessed,
  processStripeEvent,
} from "@/lib/stripe_webhook_processing";

export const dynamic = "force-dynamic";

function getWebhookSecret() {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is missing");
  }
  return secret;
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
    await processStripeEvent(event);
    await markStripeEventProcessed(event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook failed", error);
    await markStripeEventFailed(event.id, error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
