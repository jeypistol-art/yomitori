import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireAdminWrite } from "@/lib/permissions";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

type BillingProfileRow = {
  id: string;
  name: string;
  billing_email: string | null;
  stripe_customer_id: string | null;
  updated_at: string;
};

type BillingProfileRequest = {
  name?: unknown;
  billing_email?: unknown;
};

async function readJson(request: Request): Promise<BillingProfileRequest> {
  return request.json().catch(() => ({}));
}

function normalizeName(value: unknown) {
  if (typeof value !== "string") {
    throw new ApiError(400, "会社名・組織名は必須です");
  }
  const name = value.trim();
  if (!name) {
    throw new ApiError(400, "会社名・組織名は必須です");
  }
  if (name.length > 120) {
    throw new ApiError(400, "会社名・組織名は120文字以内で入力してください");
  }
  return name;
}

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") {
    throw new ApiError(400, "請求先メールは必須です");
  }
  const email = value.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "有効な請求先メールを入力してください");
  }
  if (email.length > 254) {
    throw new ApiError(400, "請求先メールは254文字以内で入力してください");
  }
  return email;
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

async function getBillingProfile(organizationId: string) {
  const result = await query<BillingProfileRow>(
    `SELECT
       id::text AS id,
       name,
       billing_email,
       stripe_customer_id,
       updated_at::text AS updated_at
     FROM organizations
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [organizationId]
  );
  const profile = result.rows[0];
  if (!profile) {
    throw new ApiError(404, "Organization not found");
  }
  return profile;
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const profile = await getBillingProfile(currentOrganization.organization_id);

    return NextResponse.json({
      data: {
        ...profile,
        can_edit: ["owner", "admin"].includes(currentOrganization.role),
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);

    const body = await readJson(request);
    const name = normalizeName(body.name);
    const billingEmail = normalizeEmail(body.billing_email);
    const before = await getBillingProfile(currentOrganization.organization_id);

    if (before.stripe_customer_id) {
      await getStripe().customers.update(before.stripe_customer_id, {
        name,
        email: billingEmail,
        metadata: {
          organization_id: currentOrganization.organization_id,
        },
      });
    }

    const result = await query<BillingProfileRow>(
      `UPDATE organizations
       SET name = $2,
           billing_email = $3,
           updated_at = now()
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING
         id::text AS id,
         name,
         billing_email,
         stripe_customer_id,
         updated_at::text AS updated_at`,
      [currentOrganization.organization_id, name, billingEmail]
    );

    const after = result.rows[0];
    if (!after) {
      throw new ApiError(404, "Organization not found");
    }

    await query(
      `INSERT INTO audit_logs (
         organization_id,
         actor_member_id,
         action,
         target_type,
         target_id,
         before_json,
         after_json
       )
       VALUES ($1, $2, 'billing.profile_updated', 'organization', $1, $3::jsonb, $4::jsonb)`,
      [
        currentOrganization.organization_id,
        currentOrganization.member_id,
        JSON.stringify({
          name: before.name,
          billing_email: before.billing_email,
        }),
        JSON.stringify({
          name: after.name,
          billing_email: after.billing_email,
          stripe_customer_synced: Boolean(before.stripe_customer_id),
        }),
      ]
    );

    return NextResponse.json({
      data: {
        ...after,
        can_edit: true,
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
