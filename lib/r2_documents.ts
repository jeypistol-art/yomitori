import { getCloudflareContext } from "@opennextjs/cloudflare";

export const R2_DOCUMENTS_BUCKET_NAME = "yomitori-docutask-documents";
export const R2_DOCUMENTS_BINDING = "YOMITORI_DOCUMENTS";

type MinimalR2Bucket = {
  get?: (
    key: string
  ) => Promise<{
    arrayBuffer: () => Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
    customMetadata?: Record<string, string>;
  } | null>;
  put: (
    key: string,
    value: ArrayBuffer | ArrayBufferView,
    options?: {
      httpMetadata?: { contentType?: string };
      customMetadata?: Record<string, string>;
    }
  ) => Promise<unknown>;
};

const sanitizeFileName = (name: string) => {
  const trimmed = (name || "file").trim();
  const safe = trimmed.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.length > 0 ? safe : "file";
};

export type PreparedDocumentFile = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

export async function getR2DocumentsBucket(): Promise<MinimalR2Bucket | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = (env as Record<string, unknown>)[R2_DOCUMENTS_BINDING] as
      | MinimalR2Bucket
      | undefined;
    if (!bucket || typeof bucket.put !== "function") {
      return null;
    }
    return bucket;
  } catch {
    return null;
  }
}

export function buildDocumentObjectKey(args: {
  organizationId: string;
  documentId: string;
  fileId: string;
  fileName: string;
  role?: "original" | "processed" | "preview";
}) {
  const safeName = sanitizeFileName(args.fileName);
  const role = args.role ?? "original";
  return `documents/${args.organizationId}/${args.documentId}/${role}/${args.fileId}-${safeName}`;
}

export async function uploadDocumentFileToR2(args: {
  bucket: MinimalR2Bucket;
  organizationId: string;
  documentId: string;
  fileId: string;
  file: PreparedDocumentFile;
}) {
  const key = buildDocumentObjectKey({
    organizationId: args.organizationId,
    documentId: args.documentId,
    fileId: args.fileId,
    fileName: args.file.originalName,
    role: "original",
  });

  await args.bucket.put(key, args.file.buffer, {
    httpMetadata: {
      contentType: args.file.mimeType || "application/octet-stream",
    },
    customMetadata: {
      originalName: args.file.originalName || "file",
      uploadedAt: new Date().toISOString(),
      organizationId: args.organizationId,
      documentId: args.documentId,
      fileId: args.fileId,
    },
  });

  return key;
}

