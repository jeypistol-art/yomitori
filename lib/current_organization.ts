import { query } from "@/lib/db";

export type CurrentOrganization = {
  organization_id: string;
  organization_name: string;
  plan_code: string;
  member_id: string;
  role: string;
};

export async function getCurrentOrganization(
  userId: string
): Promise<CurrentOrganization | null> {
  const result = await query<CurrentOrganization>(
    `SELECT
       o.id AS organization_id,
       o.name AS organization_name,
       o.plan_code::text AS plan_code,
       om.id AS member_id,
       om.role::text AS role
     FROM organization_members om
     JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = $1
       AND om.deleted_at IS NULL
       AND o.deleted_at IS NULL
     ORDER BY om.created_at ASC
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] ?? null;
}

export async function requireCurrentOrganization(userId: string) {
  const current = await getCurrentOrganization(userId);
  if (!current) {
    throw new Error("Current organization not found");
  }
  return current;
}

