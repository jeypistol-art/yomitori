import crypto from "crypto";
import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { query } from "@/lib/db";
import {
  assertCounterpartyBelongsToOrganization,
  assertManagedAssetBelongsToOrganization,
  normalizeNullableText,
  requireMasterDataWrite,
} from "@/lib/master_data";
import {
  getR2DocumentsBucket,
  uploadDocumentFileToR2,
  type PreparedDocumentFile,
} from "@/lib/r2_documents";

type DocumentRow = {
  id: string;
  title: string;
  suggested_title: string | null;
  summary: string | null;
  due_date: string | null;
  document_type: string;
  source_type: string;
  status: string;
  counterparty_id: string | null;
  created_at: string;
  updated_at: string;
  file_count: number;
};

const MAX_FILES = 20;
const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024;

function isUploadFile(value: FormDataEntryValue): value is File {
  return typeof value !== "string" && value.size > 0;
}

function inferSourceType(files: File[]) {
  if (files.some((file) => file.type === "application/pdf")) {
    return "pdf";
  }
  if (files.every((file) => file.type.startsWith("image/"))) {
    return "image";
  }
  return "pdf";
}

function validateFile(file: File) {
  const allowed =
    file.type === "application/pdf" ||
    file.type === "image/png" ||
    file.type === "image/jpeg" ||
    file.type === "image/webp" ||
    file.type === "image/heic" ||
    file.type === "image/heif";

  if (!allowed) {
    throw new ApiError(400, `${file.name} is not a supported file type`);
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new ApiError(400, `${file.name} exceeds 30MB`);
  }
}

function getManagedAssetIds(formData: FormData) {
  const repeated = formData
    .getAll("managed_asset_ids")
    .filter((value): value is string => typeof value === "string")
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

  return Array.from(new Set(repeated));
}

async function prepareFile(file: File): Promise<PreparedDocumentFile & { size: number; sha256: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return {
    buffer,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name || "file",
    size: buffer.byteLength,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function GET() {
  try {
    const { currentOrganization } = await requireApiContext();
    const result = await query<DocumentRow>(
      `SELECT
         d.id,
         d.title,
         d.suggested_title,
         d.summary,
         d.due_date,
         d.document_type::text AS document_type,
         d.source_type::text AS source_type,
         d.status::text AS status,
         d.counterparty_id,
         d.created_at,
         d.updated_at,
         count(df.id)::int AS file_count
       FROM documents d
       LEFT JOIN document_files df
         ON df.organization_id = d.organization_id
        AND df.document_id = d.id
        AND df.deleted_at IS NULL
       WHERE d.organization_id = $1
         AND d.deleted_at IS NULL
       GROUP BY d.id
       ORDER BY d.created_at DESC
       LIMIT 100`,
      [currentOrganization.organization_id]
    );

    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return jsonApiError(error);
  }
}

export async function POST(request: Request) {
  let documentId: string | null = null;

  try {
    const { currentOrganization } = await requireApiContext();
    requireMasterDataWrite(currentOrganization);

    const bucket = await getR2DocumentsBucket();
    if (!bucket) {
      throw new ApiError(500, "R2 bucket is not configured");
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter(isUploadFile);
    if (files.length === 0) {
      throw new ApiError(400, "files is required");
    }
    if (files.length > MAX_FILES) {
      throw new ApiError(400, `files cannot exceed ${MAX_FILES}`);
    }
    files.forEach(validateFile);

    const counterpartyId = normalizeNullableText(formData.get("counterparty_id"));
    if (
      counterpartyId &&
      !(await assertCounterpartyBelongsToOrganization(
        currentOrganization.organization_id,
        counterpartyId
      ))
    ) {
      throw new ApiError(400, "counterparty_id is invalid");
    }

    const managedAssetIds = getManagedAssetIds(formData);
    for (const managedAssetId of managedAssetIds) {
      const exists = await assertManagedAssetBelongsToOrganization(
        currentOrganization.organization_id,
        managedAssetId
      );
      if (!exists) {
        throw new ApiError(400, "managed_asset_ids contains invalid id");
      }
    }

    const title =
      normalizeNullableText(formData.get("title")) ??
      files[0].name.replace(/\.[^.]+$/, "") ??
      "無題の書類";
    const sourceType = inferSourceType(files);

    const document = await query<{ id: string }>(
      `INSERT INTO documents (
         organization_id,
         created_by_member_id,
         counterparty_id,
         title,
         source_type,
         status
       )
       VALUES ($1, $2, $3, $4, $5, 'uploaded')
       RETURNING id`,
      [
        currentOrganization.organization_id,
        currentOrganization.member_id,
        counterpartyId,
        title,
        sourceType,
      ]
    );
    documentId = document.rows[0].id;

    for (const managedAssetId of managedAssetIds) {
      await query(
        `INSERT INTO document_assets (
           organization_id,
           document_id,
           managed_asset_id
         )
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [currentOrganization.organization_id, documentId, managedAssetId]
      );
    }

    const storedFiles = [];
    for (const file of files) {
      const preparedFile = await prepareFile(file);
      const fileId = crypto.randomUUID();
      const storageKey = await uploadDocumentFileToR2({
        bucket,
        organizationId: currentOrganization.organization_id,
        documentId,
        fileId,
        file: preparedFile,
      });

      const fileRow = await query<{
        id: string;
        original_filename: string | null;
        mime_type: string;
        storage_key: string;
        size_bytes: number | null;
        sha256: string | null;
      }>(
        `INSERT INTO document_files (
           id,
           organization_id,
           document_id,
           file_role,
           original_filename,
           mime_type,
           storage_key,
           size_bytes,
           sha256
         )
         VALUES ($1, $2, $3, 'original', $4, $5, $6, $7, $8)
         RETURNING id, original_filename, mime_type, storage_key, size_bytes, sha256`,
        [
          fileId,
          currentOrganization.organization_id,
          documentId,
          preparedFile.originalName,
          preparedFile.mimeType,
          storageKey,
          preparedFile.size,
          preparedFile.sha256,
        ]
      );

      storedFiles.push(fileRow.rows[0]);
    }

    await query(
      `INSERT INTO processing_jobs (organization_id, document_id, job_type, status)
       VALUES ($1, $2, 'ocr', 'queued')`,
      [currentOrganization.organization_id, documentId]
    );

    return NextResponse.json(
      {
        data: {
          id: documentId,
          title,
          status: "uploaded",
          file_count: storedFiles.length,
          files: storedFiles,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (documentId) {
      await query(
        `UPDATE documents
         SET status = 'failed',
             updated_at = now()
         WHERE id = $1`,
        [documentId]
      ).catch(() => undefined);
    }
    return jsonApiError(error);
  }
}
