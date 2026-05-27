import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { findExtraPackCatalogItem } from "@/lib/usage_catalog";

export const dynamic = "force-dynamic";

type ExtraPackRow = {
  id: string;
  pack_code: string;
  purchased_count: number;
  price_yen: number;
  purchased_at: string;
  period_start: string;
  period_end: string;
};

type ExtraPackSummaryRow = {
  total_count: string;
  total_purchased_count: string;
  total_price_yen: string;
  current_period_purchased_count: string;
};

function toNumber(value: string | number | null | undefined) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const organizationId = currentOrganization.organization_id;

    const [items, summary] = await Promise.all([
      query<ExtraPackRow>(
        `SELECT
           ep.id::text AS id,
           ep.pack_code,
           ep.purchased_count,
           ep.price_yen,
           ep.purchased_at::text AS purchased_at,
           up.period_start::text AS period_start,
           up.period_end::text AS period_end
         FROM extra_packs ep
         JOIN usage_periods up
           ON up.organization_id = ep.organization_id
          AND up.id = ep.usage_period_id
         WHERE ep.organization_id = $1
         ORDER BY ep.purchased_at DESC
         LIMIT 20`,
        [organizationId]
      ),
      query<ExtraPackSummaryRow>(
        `SELECT
           count(*)::text AS total_count,
           COALESCE(sum(ep.purchased_count), 0)::text AS total_purchased_count,
           COALESCE(sum(ep.price_yen), 0)::text AS total_price_yen,
           COALESCE(sum(ep.purchased_count) FILTER (
             WHERE current_date BETWEEN up.period_start AND up.period_end
           ), 0)::text AS current_period_purchased_count
         FROM extra_packs ep
         JOIN usage_periods up
           ON up.organization_id = ep.organization_id
          AND up.id = ep.usage_period_id
         WHERE ep.organization_id = $1`,
        [organizationId]
      ),
    ]);

    const summaryRow = summary.rows[0];
    return NextResponse.json({
      data: {
        summary: {
          total_count: toNumber(summaryRow?.total_count),
          total_purchased_count: toNumber(summaryRow?.total_purchased_count),
          total_price_yen: toNumber(summaryRow?.total_price_yen),
          current_period_purchased_count: toNumber(
            summaryRow?.current_period_purchased_count
          ),
        },
        items: items.rows.map((item) => ({
          ...item,
          pack_name: findExtraPackCatalogItem(item.pack_code)?.name ?? item.pack_code,
        })),
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
