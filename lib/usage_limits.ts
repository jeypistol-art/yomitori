import { ApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";

export type UsageSummary = {
  id: string;
  period_start: string;
  period_end: string;
  plan_code: string;
  included_count: number;
  purchased_extra_count: number;
  used_count: number;
  remaining_count: number;
};

const PLAN_INCLUDED_COUNTS: Record<string, number> = {
  personal: 50,
  business: 300,
  pro: 500,
  enterprise: 1000,
};

function getIncludedCount(planCode: string) {
  return PLAN_INCLUDED_COUNTS[planCode] ?? PLAN_INCLUDED_COUNTS.personal;
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function getCurrentTokyoMonthBounds(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    periodStart: formatDate(year, month, 1),
    periodEnd: formatDate(year, month, lastDay),
  };
}

function toUsageSummary(row: Omit<UsageSummary, "remaining_count"> & { remaining_count?: number }) {
  return {
    ...row,
    remaining_count:
      row.remaining_count ??
      row.included_count + row.purchased_extra_count - row.used_count,
  };
}

export async function getOrCreateCurrentUsagePeriod(args: {
  organizationId: string;
  planCode: string;
}) {
  const { periodStart, periodEnd } = getCurrentTokyoMonthBounds();
  const includedCount = getIncludedCount(args.planCode);
  const result = await query<UsageSummary>(
    `INSERT INTO usage_periods (
       organization_id,
       period_start,
       period_end,
       included_count,
       purchased_extra_count,
       used_count
     )
     VALUES ($1, $2, $3, $4, 0, 0)
     ON CONFLICT (organization_id, period_start, period_end)
     DO UPDATE SET
       included_count = EXCLUDED.included_count,
       updated_at = now()
     RETURNING
       id,
       period_start::text AS period_start,
       period_end::text AS period_end,
       $5::text AS plan_code,
       included_count,
       purchased_extra_count,
       used_count,
       (included_count + purchased_extra_count - used_count)::int AS remaining_count`,
    [
      args.organizationId,
      periodStart,
      periodEnd,
      includedCount,
      args.planCode,
    ]
  );

  return toUsageSummary(result.rows[0]);
}

export async function consumeDocumentUsage(args: {
  organizationId: string;
  planCode: string;
  memberId: string;
  documentId: string;
}) {
  const period = await getOrCreateCurrentUsagePeriod({
    organizationId: args.organizationId,
    planCode: args.planCode,
  });

  const result = await query<UsageSummary>(
    `WITH updated AS (
       UPDATE usage_periods
       SET used_count = used_count + 1,
           updated_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND used_count + 1 <= included_count + purchased_extra_count
       RETURNING *
     ),
     event AS (
       INSERT INTO usage_events (
         organization_id,
         usage_period_id,
         document_id,
         event_type,
         quantity,
         reason,
         created_by_member_id
       )
       SELECT
         organization_id,
         id,
         $3,
         'consume',
         1,
         'document_registration',
         $4
       FROM updated
       RETURNING id
     )
     SELECT
       updated.id,
       updated.period_start::text AS period_start,
       updated.period_end::text AS period_end,
       $5::text AS plan_code,
       updated.included_count,
       updated.purchased_extra_count,
       updated.used_count,
       (updated.included_count + updated.purchased_extra_count - updated.used_count)::int AS remaining_count
     FROM updated`,
    [
      period.id,
      args.organizationId,
      args.documentId,
      args.memberId,
      args.planCode,
    ]
  );

  if (!result.rows[0]) {
    throw new ApiError(402, "今月の書類登録上限に達しました");
  }

  return toUsageSummary(result.rows[0]);
}
