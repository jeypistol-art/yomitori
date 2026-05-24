import Stripe from "stripe";

const useFetchHttpClient = typeof fetch === "function";

let stripeClient: Stripe | null = null;
let currentSecretKey = "";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is missing");
  }

  if (!stripeClient || currentSecretKey !== secretKey) {
    currentSecretKey = secretKey;
    stripeClient = new Stripe(secretKey, {
      apiVersion: "2026-01-28.clover",
      typescript: true,
      ...(useFetchHttpClient ? { httpClient: Stripe.createFetchHttpClient() } : {}),
      timeout: 20000,
      maxNetworkRetries: 1,
    });
  }

  return stripeClient;
}
