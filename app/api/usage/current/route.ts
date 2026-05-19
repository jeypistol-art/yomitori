import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { getOrCreateCurrentUsagePeriod } from "@/lib/usage_limits";

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const usage = await getOrCreateCurrentUsagePeriod({
      organizationId: currentOrganization.organization_id,
      planCode: currentOrganization.plan_code,
    });

    return NextResponse.json({ data: usage });
  } catch (error) {
    return jsonApiError(error);
  }
}
