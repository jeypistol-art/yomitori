import { hasDbCode } from "@/lib/api_errors";
import { query } from "@/lib/db";

export const WEBHOOK_EVENT_TYPES = [
  {
    event: "document.created",
    label: "書類登録",
    description: "PDF、画像、メール本文が登録された時点で通知します。",
  },
  {
    event: "document.extraction_succeeded",
    label: "AI抽出完了",
    description: "要約、期限、タスク候補の抽出が成功した時点で通知します。",
  },
  {
    event: "document.approved",
    label: "承認完了",
    description: "人間の確認を経て、抽出結果が確定した時点で通知します。",
  },
  {
    event: "task.created",
    label: "タスク作成",
    description: "承認結果や手動操作からタスクが作成された時点で通知します。",
  },
  {
    event: "reminder.sent",
    label: "リマインド送信",
    description: "担当者へ通知が送信された時点で通知します。",
  },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number]["event"];

type WebhookEndpointRow = {
  id: string;
  organization_id?: string;
  name: string;
  url: string;
  secret: string;
};

type WebhookDeliveryRow = {
  id: string;
  organization_id: string;
  endpoint_id: string;
  event_id: string;
  event_type: WebhookEventType | "webhook.test";
  payload: unknown;
  attempt_count: number;
  max_attempts: number;
  url: string;
  secret: string;
};

export type ProcessWebhookDeliveriesResult = {
  scanned: number;
  sent: number;
  failed: number;
  dead: number;
  deliveries: Array<{
    id: string;
    status: "succeeded" | "failed" | "dead";
    response_status: number | null;
    error: string | null;
  }>;
};

export type WebhookDeliveryAttemptResult =
  ProcessWebhookDeliveriesResult["deliveries"][number];

const eventTypeSet = new Set<string>(
  WEBHOOK_EVENT_TYPES.map((item) => item.event)
);

function jsonString(value: unknown) {
  return JSON.stringify(value ?? null);
}

function normalizeEventType(eventType: string): WebhookEventType {
  if (!eventTypeSet.has(eventType)) {
    throw new Error(`unsupported webhook event type: ${eventType}`);
  }
  return eventType as WebhookEventType;
}

export function normalizeWebhookEventTypes(value: unknown): WebhookEventType[] {
  const raw = Array.isArray(value) ? value : [];
  const result: WebhookEventType[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !eventTypeSet.has(item)) {
      continue;
    }
    const eventType = item as WebhookEventType;
    if (!result.includes(eventType)) {
      result.push(eventType);
    }
  }
  return result;
}

function generateEventId() {
  return `evt_ydt_${crypto.randomUUID().replace(/-/g, "")}`;
}

function generateSecret() {
  return `whsec_${crypto.randomUUID().replace(/-/g, "")}${crypto
    .randomUUID()
    .replace(/-/g, "")}`;
}

export function createWebhookSecret() {
  return generateSecret();
}

export function maskWebhookSecret(secret: string | null) {
  if (!secret) {
    return null;
  }
  return `${secret.slice(0, 10)}...${secret.slice(-6)}`;
}

export async function enqueueWebhookEvent(args: {
  organizationId: string;
  eventType: WebhookEventType;
  data: unknown;
}) {
  const eventType = normalizeEventType(args.eventType);
  const eventId = generateEventId();
  const createdAt = new Date().toISOString();
  const payload = {
    id: eventId,
    type: eventType,
    created_at: createdAt,
    organization_id: args.organizationId,
    data: args.data,
  };

  const endpoints = await query<WebhookEndpointRow>(
    `SELECT
       webhook_endpoints.id,
       webhook_endpoints.name,
       webhook_endpoints.url,
       webhook_endpoints.secret
     FROM webhook_endpoints
     JOIN organizations o
       ON o.id = webhook_endpoints.organization_id
      AND o.deleted_at IS NULL
      AND o.plan_code = 'enterprise'
     WHERE webhook_endpoints.organization_id = $1
       AND webhook_endpoints.deleted_at IS NULL
       AND webhook_endpoints.is_enabled = true
       AND webhook_endpoints.event_types @> $2::jsonb
     ORDER BY webhook_endpoints.created_at ASC`,
    [args.organizationId, jsonString([eventType])]
  );

  for (const endpoint of endpoints.rows) {
    await query(
      `INSERT INTO webhook_deliveries (
         organization_id,
         endpoint_id,
         event_id,
         event_type,
         payload,
         status,
         next_attempt_at
       )
       VALUES ($1, $2, $3, $4, $5::jsonb, 'queued', now())
       ON CONFLICT (endpoint_id, event_id) DO NOTHING`,
      [
        args.organizationId,
        endpoint.id,
        eventId,
        eventType,
        jsonString(payload),
      ]
    );
  }

  return {
    event_id: eventId,
    delivery_count: endpoints.rows.length,
  };
}

export async function safeEnqueueWebhookEvent(args: {
  organizationId: string;
  eventType: WebhookEventType;
  data: unknown;
}) {
  try {
    return await enqueueWebhookEvent(args);
  } catch (error) {
    if (hasDbCode(error, "42P01")) {
      return {
        event_id: null,
        delivery_count: 0,
        error: "webhook tables are not initialized",
      };
    }
    console.error("Webhook enqueue failed", error);
    return {
      event_id: null,
      delivery_count: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function hmacSha256(secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function nextAttemptDelayMinutes(attemptCount: number) {
  return [5, 15, 60, 240][Math.min(attemptCount, 3)] ?? 240;
}

function generateTestEventId() {
  return `evt_ydt_test_${crypto.randomUUID().replace(/-/g, "")}`;
}

async function sendDelivery(delivery: WebhookDeliveryRow) {
  const body = jsonString(delivery.payload);
  const timestamp = new Date().toISOString();
  const signature = await hmacSha256(delivery.secret, `${timestamp}.${body}`);
  const response = await fetch(delivery.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "YOMITORI-DocuTask-Webhooks/1.0",
      "YDT-Event-Id": delivery.event_id,
      "YDT-Event-Type": delivery.event_type,
      "YDT-Timestamp": timestamp,
      "YDT-Signature": `v1=${signature}`,
    },
    body,
  });
  const responseBody = (await response.text().catch(() => "")).slice(0, 2000);
  return {
    ok: response.status >= 200 && response.status < 300,
    status: response.status,
    body: responseBody,
  };
}

export async function processQueuedWebhookDeliveries(args: { limit?: number } = {}) {
  const limit = Math.min(Math.max(args.limit ?? 25, 1), 100);
  const rows = await query<WebhookDeliveryRow>(
    `SELECT
       wd.id,
       wd.organization_id,
       wd.endpoint_id,
       wd.event_id,
       wd.event_type,
       wd.payload,
       wd.attempt_count,
       wd.max_attempts,
       we.url,
       we.secret
     FROM webhook_deliveries wd
     JOIN webhook_endpoints we
       ON we.organization_id = wd.organization_id
      AND we.id = wd.endpoint_id
      AND we.deleted_at IS NULL
      AND we.is_enabled = true
     JOIN organizations o
       ON o.id = wd.organization_id
      AND o.deleted_at IS NULL
      AND o.plan_code = 'enterprise'
     WHERE wd.status IN ('queued', 'failed')
       AND wd.next_attempt_at <= now()
       AND wd.attempt_count < wd.max_attempts
     ORDER BY wd.next_attempt_at ASC, wd.created_at ASC
     LIMIT $1`,
    [limit]
  );

  const deliveries: ProcessWebhookDeliveriesResult["deliveries"] = [];
  for (const delivery of rows.rows) {
    const nextAttemptCount = delivery.attempt_count + 1;
    try {
      const response = await sendDelivery(delivery);
      deliveries.push(await persistDeliveryResponse(delivery, nextAttemptCount, response));
    } catch (error) {
      deliveries.push(await persistDeliveryError(delivery, nextAttemptCount, error));
    }
  }

  return {
    scanned: rows.rows.length,
    sent: deliveries.filter((item) => item.status === "succeeded").length,
    failed: deliveries.filter((item) => item.status === "failed").length,
    dead: deliveries.filter((item) => item.status === "dead").length,
    deliveries,
  } satisfies ProcessWebhookDeliveriesResult;
}

async function persistDeliveryResponse(
  delivery: WebhookDeliveryRow,
  attemptCount: number,
  response: { ok: boolean; status: number; body: string }
): Promise<WebhookDeliveryAttemptResult> {
  if (response.ok) {
    await query(
      `UPDATE webhook_deliveries
       SET status = 'succeeded',
           attempt_count = $2,
           last_attempt_at = now(),
           delivered_at = now(),
           response_status = $3,
           response_body = $4,
           error_message = NULL,
           updated_at = now()
       WHERE id = $1`,
      [delivery.id, attemptCount, response.status, response.body]
    );
    return {
      id: delivery.id,
      status: "succeeded",
      response_status: response.status,
      error: null,
    };
  }

  const isDead = attemptCount >= delivery.max_attempts;
  await query(
    `UPDATE webhook_deliveries
     SET status = $2,
         attempt_count = $3,
         last_attempt_at = now(),
         next_attempt_at = now() + ($4::int * INTERVAL '1 minute'),
         response_status = $5,
         response_body = $6,
         error_message = $7,
         updated_at = now()
     WHERE id = $1`,
    [
      delivery.id,
      isDead ? "dead" : "failed",
      attemptCount,
      nextAttemptDelayMinutes(attemptCount),
      response.status,
      response.body,
      `HTTP ${response.status}`,
    ]
  );
  return {
    id: delivery.id,
    status: isDead ? "dead" : "failed",
    response_status: response.status,
    error: `HTTP ${response.status}`,
  };
}

async function persistDeliveryError(
  delivery: WebhookDeliveryRow,
  attemptCount: number,
  error: unknown
): Promise<WebhookDeliveryAttemptResult> {
  const isDead = attemptCount >= delivery.max_attempts;
  const errorMessage = error instanceof Error ? error.message : String(error);
  await query(
    `UPDATE webhook_deliveries
     SET status = $2,
         attempt_count = $3,
         last_attempt_at = now(),
         next_attempt_at = now() + ($4::int * INTERVAL '1 minute'),
         response_status = NULL,
         response_body = NULL,
         error_message = $5,
         updated_at = now()
     WHERE id = $1`,
    [
      delivery.id,
      isDead ? "dead" : "failed",
      attemptCount,
      nextAttemptDelayMinutes(attemptCount),
      errorMessage,
    ]
  );
  return {
    id: delivery.id,
    status: isDead ? "dead" : "failed",
    response_status: null,
    error: errorMessage,
  };
}

export async function sendWebhookTestDelivery(args: {
  organizationId: string;
  endpointId: string;
}) {
  const endpoint = await query<WebhookEndpointRow>(
    `SELECT
       id,
       organization_id,
       name,
       url,
       secret
     FROM webhook_endpoints
     WHERE organization_id = $1
       AND id = $2
       AND deleted_at IS NULL`,
    [args.organizationId, args.endpointId]
  );

  const row = endpoint.rows[0];
  if (!row) {
    return null;
  }

  const eventId = generateTestEventId();
  const payload = {
    id: eventId,
    type: "webhook.test",
    created_at: new Date().toISOString(),
    organization_id: args.organizationId,
    data: {
      message: "YOMITORI DocuTask webhook test",
      endpoint_id: row.id,
      endpoint_name: row.name,
    },
  };

  const delivery = await query<WebhookDeliveryRow>(
    `INSERT INTO webhook_deliveries (
       organization_id,
       endpoint_id,
       event_id,
       event_type,
       payload,
       status,
       max_attempts,
       next_attempt_at
     )
     VALUES ($1, $2, $3, 'webhook.test', $4::jsonb, 'queued', 1, now())
     RETURNING
       id,
       organization_id,
       endpoint_id,
       event_id,
       event_type,
       payload,
       attempt_count,
       max_attempts,
       $5::text AS url,
       $6::text AS secret`,
    [args.organizationId, row.id, eventId, jsonString(payload), row.url, row.secret]
  );

  const deliveryRow = delivery.rows[0];
  const attempt = await sendDelivery(deliveryRow)
    .then((response) =>
      persistDeliveryResponse(deliveryRow, deliveryRow.attempt_count + 1, response)
    )
    .catch((error) =>
      persistDeliveryError(deliveryRow, deliveryRow.attempt_count + 1, error)
    );

  return {
    event_id: eventId,
    delivery: attempt,
  };
}
