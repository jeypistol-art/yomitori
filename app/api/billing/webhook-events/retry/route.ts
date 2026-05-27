import Stripe from "stripe";
import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireAdminWrite } from "@/lib/permissions";
import {
  markStripeEventFailed,
  markStripeEventProcessed,
  processStripeEvent,
} from "@/lib/stripe_webhook_processing";

export const dynamic = "force-dynamic";

type RetryRequest = {
  event_id?: unknown;
};

type StripeEventRetryRow = {
  id: string;
  stripe_event_id: string;
  event_type: string;
  payload: Stripe.Event;
  processed_at: string | null;
  error_message: string | null;
};

async function readJson(request: Request): Promise<RetryRequest> {
  return request.json().catch(() => ({}));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Webhook event retry failed";
}

export async function POST(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);

    const body = await readJson(request);
    const eventId = typeof body.event_id === "string" ? body.event_id : "";
    if (!eventId) {
      throw new ApiError(400, "event_id is required");
    }

    const organizationId = currentOrganization.organization_id;
    const subscriptionIds = await query<{ stripe_subscription_id: string }>(
      `SELECT stripe_subscription_id
       FROM subscriptions
       WHERE organization_id = $1
         AND stripe_subscription_id IS NOT NULL`,
      [organizationId]
    );
    const stripeSubscriptionIds = subscriptionIds.rows.map(
      (row) => row.stripe_subscription_id
    );
    const organizationFilter = `
      (
        payload #>> '{data,object,metadata,organization_id}' = $1
        OR payload #>> '{data,object,client_reference_id}' = $1
        OR payload #>> '{data,object,subscription_details,metadata,organization_id}' = $1
        OR payload #>> '{data,object,parent,subscription_details,metadata,organization_id}' = $1
        OR (
          cardinality($2::text[]) > 0
          AND (
            payload #>> '{data,object,id}' = ANY($2::text[])
            OR payload #>> '{data,object,subscription}' = ANY($2::text[])
          )
        )
      )`;
    const result = await query<StripeEventRetryRow>(
      `SELECT
         id::text AS id,
         stripe_event_id,
         event_type,
         payload,
         processed_at::text AS processed_at,
         error_message
       FROM stripe_events
       WHERE id = $3::uuid
         AND ${organizationFilter}
       LIMIT 1`,
      [organizationId, stripeSubscriptionIds, eventId]
    );
    const row = result.rows[0];
    if (!row) {
      throw new ApiError(404, "Webhook event not found");
    }
    if (row.processed_at && !row.error_message) {
      return NextResponse.json({
        data: {
          retried: false,
          already_processed: true,
        },
      });
    }

    try {
      await processStripeEvent(row.payload);
      await markStripeEventProcessed(row.stripe_event_id);
    } catch (error) {
      await markStripeEventFailed(row.stripe_event_id, error);
      throw new ApiError(500, errorMessage(error));
    }

    return NextResponse.json({
      data: {
        retried: true,
        already_processed: false,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
