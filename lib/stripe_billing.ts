import { ApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import {
  EXTRA_PACK_CATALOG,
  PLAN_CATALOG,
  type ExtraPackCatalogItem,
  type PlanCatalogItem,
} from "@/lib/usage_catalog";

type PriceConfig = {
  priceId: string;
};

function optionalEnv(name: string) {
  return process.env[name]?.trim() || null;
}

function requiredFirstEnv(names: string[]) {
  for (const name of names) {
    const value = optionalEnv(name);
    if (value) {
      return value;
    }
  }

  throw new ApiError(500, `${names.join(" or ")} is not configured`);
}

function planPriceEnvNames(planCode: string) {
  const upperCode = planCode.toUpperCase();
  return [`STRIPE_${upperCode}_PRICE_ID`, `STRIPE_PRICE_${upperCode}`];
}

function extraPackPriceEnvNames(packCode: string) {
  const upperCode = packCode.toUpperCase();
  return [`STRIPE_${upperCode}_PRICE_ID`, `STRIPE_PRICE_${upperCode}`];
}

export function getAppBaseUrl() {
  return (
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3100"
  ).replace(/\/+$/, "");
}

export function getPlanPriceConfig(planCode: string): (PlanCatalogItem & PriceConfig) | null {
  const plan = PLAN_CATALOG.find((item) => item.code === planCode);
  if (!plan) {
    return null;
  }

  return {
    ...plan,
    priceId: requiredFirstEnv(planPriceEnvNames(plan.code)),
  };
}

export function getExtraPackPriceConfig(
  packCode: string
): (ExtraPackCatalogItem & PriceConfig) | null {
  const pack = EXTRA_PACK_CATALOG.find((item) => item.code === packCode);
  if (!pack) {
    return null;
  }

  return {
    ...pack,
    priceId: requiredFirstEnv(extraPackPriceEnvNames(pack.code)),
  };
}

export function getPlanCodeByStripePriceId(priceId: string | null | undefined) {
  if (!priceId) {
    return null;
  }

  return (
    PLAN_CATALOG.find((plan) => {
      return planPriceEnvNames(plan.code).some((envName) => {
        return optionalEnv(envName) === priceId;
      });
    })?.code ?? null
  );
}

export async function getOrCreateStripeCustomerForOrganization(args: {
  organizationId: string;
  organizationName: string;
  fallbackEmail?: string | null;
}) {
  const organization = await query<{
    stripe_customer_id: string | null;
    billing_email: string | null;
  }>(
    `SELECT stripe_customer_id, billing_email
     FROM organizations
     WHERE id = $1
       AND deleted_at IS NULL`,
    [args.organizationId]
  );

  const row = organization.rows[0];
  if (!row) {
    throw new ApiError(404, "Organization not found");
  }
  if (row.stripe_customer_id) {
    return row.stripe_customer_id;
  }

  const email = row.billing_email ?? args.fallbackEmail ?? undefined;
  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: args.organizationName,
    metadata: {
      organization_id: args.organizationId,
    },
  });

  await query(
    `UPDATE organizations
     SET stripe_customer_id = $2,
         billing_email = COALESCE(billing_email, $3),
         updated_at = now()
     WHERE id = $1
       AND deleted_at IS NULL`,
    [args.organizationId, customer.id, email ?? null]
  );

  return customer.id;
}
