import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import {
  getFeatureAvailability,
  getLockedFeatures,
} from "@/lib/feature_gates";
import { getPlanCatalogItem } from "@/lib/usage_catalog";

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const plan = getPlanCatalogItem(currentOrganization.plan_code);
    return NextResponse.json({
      data: {
        current_plan: plan,
        features: getFeatureAvailability(currentOrganization.plan_code),
        locked_features: getLockedFeatures(currentOrganization.plan_code),
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
