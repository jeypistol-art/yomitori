import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is missing");
}

const useFetchHttpClient = typeof fetch === "function";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2026-01-28.clover",
  typescript: true,
  ...(useFetchHttpClient ? { httpClient: Stripe.createFetchHttpClient() } : {}),
  timeout: 20000,
  maxNetworkRetries: 1,
});

