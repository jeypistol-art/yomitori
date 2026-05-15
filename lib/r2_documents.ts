import { getCloudflareContext } from "@opennextjs/cloudflare";
import crypto from "crypto";

export const R2_DOCUMENTS_BUCKET_NAME =
  process.env.R2_BUCKET_NAME || "yomitori-docutask-documents";
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

const hmac = (key: crypto.BinaryLike | crypto.KeyObject, value: string) =>
  crypto.createHmac("sha256", key).update(value).digest();

const sha256Hex = (value: crypto.BinaryLike) =>
  crypto.createHash("sha256").update(value).digest("hex");

const encodePathSegment = (value: string) =>
  encodeURIComponent(value).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );

const encodeObjectPath = (bucketName: string, key: string) =>
  `/${encodePathSegment(bucketName)}/${key
    .split("/")
    .map(encodePathSegment)
    .join("/")}`;

const normalizeMetadataValue = (value: string) =>
  encodeURIComponent(value).slice(0, 1024);

const sanitizeFileName = (name: string) => {
  const trimmed = (name || "file").trim();
  const safe = trimmed.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "_");
  return safe.length > 0 ? safe : "file";
};

function getLocalR2Config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || R2_DOCUMENTS_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    return null;
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    endpointHost: `${accountId}.r2.cloudflarestorage.com`,
  };
}

async function signedR2Request(args: {
  method: "GET" | "PUT";
  key: string;
  body?: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}) {
  const config = getLocalR2Config();
  if (!config) {
    throw new Error("R2 environment variables are not set");
  }

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payload = args.body ?? Buffer.alloc(0);
  const payloadHash = sha256Hex(payload);
  const path = encodeObjectPath(config.bucketName, args.key);
  const url = `https://${config.endpointHost}${path}`;

  const headers: Record<string, string> = {
    host: config.endpointHost,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };

  if (args.contentType) {
    headers["content-type"] = args.contentType;
  }

  for (const [key, value] of Object.entries(args.metadata ?? {})) {
    headers[`x-amz-meta-${key.toLowerCase()}`] = normalizeMetadataValue(value);
  }

  const sortedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = sortedHeaderNames
    .map((name) => `${name}:${headers[name].trim().replace(/\s+/g, " ")}\n`)
    .join("");
  const signedHeaders = sortedHeaderNames.join(";");
  const canonicalRequest = [
    args.method,
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, "auto");
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = crypto
    .createHmac("sha256", signingKey)
    .update(stringToSign)
    .digest("hex");

  const response = await fetch(url, {
    method: args.method,
    headers: {
      ...headers,
      authorization: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
    body: args.method === "PUT" ? (payload as unknown as BodyInit) : undefined,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `R2 ${args.method} failed: ${response.status} ${response.statusText} ${detail}`
    );
  }

  return response;
}

function getLocalR2Bucket(): MinimalR2Bucket | null {
  const config = getLocalR2Config();
  if (!config) {
    return null;
  }

  return {
    async get(key) {
      const response = await signedR2Request({ method: "GET", key });
      return {
        arrayBuffer: () => response.arrayBuffer(),
        httpMetadata: {
          contentType: response.headers.get("content-type") ?? undefined,
        },
        customMetadata: {},
      };
    },
    async put(key, value, options) {
      const body = Buffer.isBuffer(value)
        ? value
        : Buffer.from(
            value instanceof ArrayBuffer
              ? value
              : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength)
          );
      await signedR2Request({
        method: "PUT",
        key,
        body,
        contentType: options?.httpMetadata?.contentType,
        metadata: options?.customMetadata,
      });
    },
  };
}

export type PreparedDocumentFile = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

export async function getR2DocumentsBucket(): Promise<MinimalR2Bucket | null> {
  const localBucket = getLocalR2Bucket();
  if (localBucket) {
    return localBucket;
  }

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
