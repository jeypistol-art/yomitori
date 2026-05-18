import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { normalizeNullableText, requireMasterDataWrite } from "@/lib/master_data";

const memberRoles = new Set(["owner", "admin", "member", "viewer"]);

function normalizeEmail(value: unknown) {
  const email = normalizeNullableText(value)?.toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "valid email is required");
  }
  return email;
}

function normalizeRole(value: unknown) {
  const role = normalizeNullableText(value) ?? "member";
  return memberRoles.has(role) ? role : "member";
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const result = await query(
      `SELECT
         om.id,
         om.role::text AS role,
         om.joined_at,
         om.created_at,
         u.name,
         u.email
       FROM organization_members om
       JOIN users u ON u.id = om.user_id
       WHERE om.organization_id = $1
         AND om.deleted_at IS NULL
         AND u.deleted_at IS NULL
       ORDER BY
         CASE om.role
           WHEN 'owner' THEN 1
           WHEN 'admin' THEN 2
           WHEN 'member' THEN 3
           ELSE 4
         END,
         u.name ASC NULLS LAST,
         u.email ASC`,
      [currentOrganization.organization_id]
    );
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { currentOrganization } = await requireApiContext();
    requireMasterDataWrite(currentOrganization);

    const body = (await request.json().catch(() => ({}))) as {
      email?: unknown;
      name?: unknown;
      role?: unknown;
    };
    const email = normalizeEmail(body.email);
    const name = normalizeNullableText(body.name);
    const role = normalizeRole(body.role);

    const user = await query<{ id: string }>(
      `INSERT INTO users (
         email,
         name,
         auth_provider,
         auth_provider_subject
       )
       VALUES ($1, $2, 'manual', $3)
       ON CONFLICT (email)
       DO UPDATE SET
         name = COALESCE(EXCLUDED.name, users.name),
         deleted_at = NULL,
         updated_at = now()
       RETURNING id`,
      [email, name, `manual:${crypto.randomUUID()}`]
    );

    const member = await query(
      `INSERT INTO organization_members (
         organization_id,
         user_id,
         role,
         joined_at
       )
       VALUES ($1, $2, $3, now())
       ON CONFLICT (organization_id, user_id)
       DO UPDATE SET
         role = EXCLUDED.role,
         deleted_at = NULL,
         updated_at = now()
       RETURNING id, role::text AS role, created_at, joined_at`,
      [currentOrganization.organization_id, user.rows[0].id, role]
    );

    return NextResponse.json({ data: member.rows[0] }, { status: 201 });
  } catch (error) {
    return jsonApiError(error);
  }
}
