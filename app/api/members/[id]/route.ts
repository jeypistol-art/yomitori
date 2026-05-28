import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import { requireAdminWrite } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireAdminWrite(currentOrganization);
    requireFeatureAccess(currentOrganization.plan_code, "team_members");

    if (id === currentOrganization.member_id) {
      throw new ApiError(400, "cannot delete current member");
    }

    const result = await query(
      `UPDATE organization_members
       SET deleted_at = now(),
           updated_at = now()
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
       RETURNING id`,
      [currentOrganization.organization_id, id]
    );

    if (!result.rows[0]) {
      throw new ApiError(404, "member not found");
    }

    await query(
      `UPDATE tasks
       SET assignee_member_id = NULL,
           updated_at = now()
       WHERE organization_id = $1
         AND assignee_member_id = $2
         AND deleted_at IS NULL`,
      [currentOrganization.organization_id, id]
    );

    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return jsonApiError(error);
  }
}
