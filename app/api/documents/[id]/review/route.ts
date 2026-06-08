import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import { requireFeatureAccess } from "@/lib/feature_gates";
import {
  assertManagedAssetBelongsToOrganization,
} from "@/lib/master_data";
import { requireOperationalWrite } from "@/lib/permissions";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function jsonString(value: unknown) {
  return JSON.stringify(value ?? {});
}

function normalizeIdList(value: unknown) {
  if (!Array.isArray(value)) {
    throw new ApiError(400, "managed_asset_ids must be an array");
  }
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();

    const document = await query(
      `SELECT
         d.id,
         d.title,
         d.suggested_title,
         d.document_type::text AS document_type,
         NULLIF(d.metadata->>'document_type_label', '') AS document_type_label,
         d.source_type::text AS source_type,
         d.status::text AS status,
         d.document_date::text AS document_date,
         d.due_date::text AS due_date,
         d.summary,
         d.source_text,
         d.key_points,
         d.required_actions,
         d.required_documents,
         d.risks,
         d.metadata,
         d.approved_at,
         d.created_at,
         d.updated_at,
         (
           SELECT count(DISTINCT d2.id)::int
           FROM documents d2
           LEFT JOIN document_files df
             ON df.organization_id = d.organization_id
            AND df.document_id = d.id
            AND df.deleted_at IS NULL
           LEFT JOIN document_files df2
             ON df2.organization_id = d2.organization_id
            AND df2.document_id = d2.id
            AND df2.deleted_at IS NULL
           WHERE d2.organization_id = d.organization_id
             AND d2.id <> d.id
             AND d2.deleted_at IS NULL
             AND (
               (
                 d.source_text IS NOT NULL
                 AND d2.source_text IS NOT NULL
                 AND md5(d2.source_text) = md5(d.source_text)
               )
               OR (
                 df.sha256 IS NOT NULL
                 AND df2.sha256 = df.sha256
               )
             )
         ) AS duplicate_count,
         c.id AS counterparty_id,
         c.name AS counterparty_name
       FROM documents d
       LEFT JOIN counterparties c
         ON c.organization_id = d.organization_id
        AND c.id = d.counterparty_id
        AND c.deleted_at IS NULL
       WHERE d.organization_id = $1
         AND d.id = $2
         AND d.deleted_at IS NULL
       LIMIT 1`,
      [currentOrganization.organization_id, id]
    );

    if (!document.rows[0]) {
      throw new ApiError(404, "document not found");
    }

    const [files, assets, extraction, items, draft, members, managedAssets, counterparties] =
      await Promise.all([
        query(
          `SELECT id, original_filename, mime_type, size_bytes, created_at
           FROM document_files
           WHERE organization_id = $1
             AND document_id = $2
             AND deleted_at IS NULL
           ORDER BY created_at ASC`,
          [currentOrganization.organization_id, id]
        ),
        query(
          `SELECT ma.id, ma.name, ma.asset_type::text AS asset_type, ma.asset_type_label
           FROM document_assets da
           JOIN managed_assets ma
             ON ma.organization_id = da.organization_id
            AND ma.id = da.managed_asset_id
            AND ma.deleted_at IS NULL
           WHERE da.organization_id = $1
             AND da.document_id = $2
           ORDER BY ma.name ASC`,
          [currentOrganization.organization_id, id]
        ),
        query(
          `SELECT id, status::text AS status, model, normalized_output, overall_confidence, created_at, completed_at
           FROM ai_extractions
           WHERE organization_id = $1
             AND document_id = $2
           ORDER BY created_at DESC
           LIMIT 1`,
          [currentOrganization.organization_id, id]
        ),
        query(
          `SELECT
             id,
             item_type::text AS item_type,
             label,
             value_text,
             value_date,
             value_json,
             confidence,
             accepted
           FROM extracted_items
           WHERE organization_id = $1
             AND document_id = $2
           ORDER BY created_at ASC`,
          [currentOrganization.organization_id, id]
        ),
        query(
          `SELECT id, draft_json, version, updated_at
           FROM review_drafts
           WHERE organization_id = $1
             AND document_id = $2
           LIMIT 1`,
          [currentOrganization.organization_id, id]
        ),
        query(
          `SELECT om.id, om.role::text AS role, u.name, u.email
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
        ),
        query(
          `SELECT id, asset_type::text AS asset_type, asset_type_label, name
           FROM managed_assets
           WHERE organization_id = $1
             AND deleted_at IS NULL
           ORDER BY name ASC`,
          [currentOrganization.organization_id]
        ),
        query(
          `SELECT id, counterparty_type::text AS counterparty_type, counterparty_type_label, name
           FROM counterparties
           WHERE organization_id = $1
             AND deleted_at IS NULL
           ORDER BY name ASC`,
          [currentOrganization.organization_id]
        ),
      ]);

    return NextResponse.json({
      data: {
        document: document.rows[0],
        files: files.rows,
        assets: assets.rows,
        latest_extraction: extraction.rows[0] ?? null,
        extracted_items: items.rows,
        review_draft: draft.rows[0] ?? null,
        members: members.rows,
        managed_assets: managedAssets.rows,
        counterparties: counterparties.rows,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const { currentOrganization } = await requireApiContext();
    requireOperationalWrite(currentOrganization);

    const body = (await request.json().catch(() => ({}))) as {
      draft?: unknown;
      managed_asset_ids?: unknown;
    };
    const hasDraft = "draft" in body;
    const hasManagedAssetIds = "managed_asset_ids" in body;
    if (!hasDraft && !hasManagedAssetIds) {
      throw new ApiError(400, "draft or managed_asset_ids is required");
    }
    if (hasDraft && (!body.draft || typeof body.draft !== "object")) {
      throw new ApiError(400, "draft is required");
    }

    const document = await query<{ id: string }>(
      `SELECT id
       FROM documents
       WHERE organization_id = $1
         AND id = $2
         AND deleted_at IS NULL
       LIMIT 1`,
      [currentOrganization.organization_id, id]
    );
    if (!document.rows[0]) {
      throw new ApiError(404, "document not found");
    }

    const result = hasDraft
      ? await query(
          `INSERT INTO review_drafts (
             organization_id,
             document_id,
             edited_by_member_id,
             draft_json,
             version
           )
           VALUES ($1, $2, $3, $4::jsonb, 1)
           ON CONFLICT (document_id)
           DO UPDATE SET
             edited_by_member_id = EXCLUDED.edited_by_member_id,
             draft_json = EXCLUDED.draft_json,
             version = review_drafts.version + 1,
             updated_at = now()
           RETURNING id, draft_json, version, updated_at`,
          [
            currentOrganization.organization_id,
            id,
            currentOrganization.member_id,
            jsonString(body.draft),
          ]
        )
      : null;

    let managedAssetIds: string[] | null = null;
    if (hasManagedAssetIds) {
      requireFeatureAccess(currentOrganization.plan_code, "shared_ledger");
      managedAssetIds = normalizeIdList(body.managed_asset_ids);
      for (const managedAssetId of managedAssetIds) {
        const exists = await assertManagedAssetBelongsToOrganization(
          currentOrganization.organization_id,
          managedAssetId
        );
        if (!exists) {
          throw new ApiError(400, "managed_asset_ids contains invalid id");
        }
      }

      await query(
        `DELETE FROM document_assets
         WHERE organization_id = $1
           AND document_id = $2`,
        [currentOrganization.organization_id, id]
      );
      for (const managedAssetId of managedAssetIds) {
        await query(
          `INSERT INTO document_assets (
             organization_id,
             document_id,
             managed_asset_id
           )
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING`,
          [currentOrganization.organization_id, id, managedAssetId]
        );
      }
    }

    await query(
      `INSERT INTO audit_logs (
         organization_id,
         actor_member_id,
         action,
         target_type,
         target_id,
         after_json
       )
       VALUES ($1, $2, 'review_draft.saved', 'document', $3, $4::jsonb)`,
      [
        currentOrganization.organization_id,
        currentOrganization.member_id,
        id,
        jsonString({
          draft_version: result?.rows[0]?.version ?? null,
          managed_asset_count: managedAssetIds?.length ?? null,
        }),
      ]
    );

    return NextResponse.json({
      data: {
        review_draft: result?.rows[0] ?? null,
        managed_asset_ids: managedAssetIds,
      },
    });
  } catch (error) {
    return jsonApiError(error);
  }
}
