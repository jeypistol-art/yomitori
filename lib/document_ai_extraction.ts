import crypto from "crypto";
import { query } from "@/lib/db";
import { getR2DocumentsBucket } from "@/lib/r2_documents";
import { runOpenAIWithRetry, serializeOpenAIError } from "@/lib/openai_client";

const PROMPT_VERSION = "ydt-extraction-2026-05-18";
const SCHEMA_VERSION = "1.0";

const DOCUMENT_TYPES = [
  "municipal_notice",
  "contract_renewal",
  "lease_renewal",
  "insurance_renewal",
  "tenant_contract_renewal",
  "legal_change_notice",
  "inspection_report",
  "other",
  "unknown",
] as const;

type DocumentType = (typeof DOCUMENT_TYPES)[number];

type DocumentFileRow = {
  id: string;
  original_filename: string | null;
  mime_type: string;
  storage_key: string;
  size_bytes: number | null;
};

type DocumentContextRow = {
  id: string;
  organization_id: string;
  title: string;
  source_type: string;
  source_text: string | null;
  counterparty_name: string | null;
  counterparty_type: string | null;
};

type ExtractionInput = {
  organizationId: string;
  documentId: string;
  memberId: string;
};

type Confidence = {
  score?: number | null;
  level?: string | null;
  reason?: string | null;
};

type ExtractedDate = {
  date_type?: string | null;
  label?: string | null;
  date?: string | null;
  raw_date_text?: string | null;
  description?: string | null;
  is_primary_due_date?: boolean | null;
  confidence?: Confidence | null;
};

type ExtractedAction = {
  action_type?: string | null;
  title?: string | null;
  description?: string | null;
  due_date?: string | null;
  priority?: "low" | "normal" | "high" | "urgent" | null;
  suggested_assignee_role?: string | null;
  create_by_default?: boolean | null;
  confidence?: Confidence | null;
};

type ExtractedRequiredDocument = {
  name?: string | null;
  description?: string | null;
  submit_to?: string | null;
  submission_method?: string | null;
  due_date?: string | null;
  confidence?: Confidence | null;
};

export type AiExtractionOutput = {
  schema_version: string;
  language: string;
  document_classification: {
    document_type?: DocumentType;
    document_type_label?: string | null;
    subtype?: string | null;
    confidence?: Confidence | null;
    needs_human_review?: boolean | null;
  };
  document_summary: {
    title_candidate?: string | null;
    one_line_summary?: string | null;
    short_summary?: string[];
    detailed_summary?: string | null;
    key_points?: Array<{ text?: string; confidence?: Confidence | null }>;
  };
  parties?: Record<string, unknown>;
  managed_asset_candidates?: unknown[];
  important_dates: ExtractedDate[];
  required_actions: ExtractedAction[];
  required_documents: ExtractedRequiredDocument[];
  amounts?: unknown[];
  contract_terms?: Record<string, unknown>;
  risks_and_notes: Array<{ title?: string | null; description?: string | null } | string>;
  contact_points?: unknown[];
  task_candidates: ExtractedAction[];
  reminder_candidates: unknown[];
  warnings: unknown[];
  missing_information: unknown[];
  quality: {
    overall_confidence?: Confidence | null;
    ocr_quality?: Confidence | null;
  };
};

const looseObjectJsonSchema = {
  type: "object",
  properties: {},
  additionalProperties: true,
} as const;

const looseValueJsonSchema = {
  anyOf: [
    { type: "string" },
    { type: "number" },
    { type: "boolean" },
    looseObjectJsonSchema,
    { type: "null" },
  ],
} as const;

const extractionJsonSchema = {
  type: "object",
  required: [
    "schema_version",
    "language",
    "document_classification",
    "document_summary",
    "important_dates",
    "required_actions",
    "required_documents",
    "task_candidates",
    "reminder_candidates",
    "warnings",
    "missing_information",
    "quality",
  ],
  additionalProperties: true,
  properties: {
    schema_version: { type: "string" },
    language: { type: "string" },
    document_classification: {
      type: "object",
      additionalProperties: true,
      properties: {
        document_type: { type: "string", enum: DOCUMENT_TYPES },
        document_type_label: { type: ["string", "null"] },
        subtype: { type: ["string", "null"] },
        needs_human_review: { type: ["boolean", "null"] },
      },
    },
    document_summary: {
      type: "object",
      additionalProperties: true,
      properties: {
        title_candidate: { type: ["string", "null"] },
        one_line_summary: { type: ["string", "null"] },
        short_summary: { type: "array", items: { type: "string" } },
        detailed_summary: { type: ["string", "null"] },
        key_points: { type: "array", items: looseObjectJsonSchema },
      },
    },
    important_dates: { type: "array", items: looseObjectJsonSchema },
    required_actions: { type: "array", items: looseObjectJsonSchema },
    required_documents: { type: "array", items: looseObjectJsonSchema },
    task_candidates: { type: "array", items: looseObjectJsonSchema },
    reminder_candidates: { type: "array", items: looseObjectJsonSchema },
    warnings: { type: "array", items: looseValueJsonSchema },
    missing_information: { type: "array", items: looseValueJsonSchema },
    quality: { type: "object", additionalProperties: true },
  },
};

function clampConfidence(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) {
    return null;
  }
  return Math.max(0, Math.min(1, number));
}

function normalizeDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function normalizeDocumentType(value: unknown): DocumentType {
  return DOCUMENT_TYPES.includes(value as DocumentType)
    ? (value as DocumentType)
    : "unknown";
}

function getOverallConfidence(output: AiExtractionOutput) {
  return clampConfidence(output.quality?.overall_confidence?.score);
}

function extractPrimaryDueDate(output: AiExtractionOutput) {
  const primary = output.important_dates.find((item) => item.is_primary_due_date);
  return normalizeDate(primary?.date) ?? normalizeDate(output.required_actions[0]?.due_date);
}

function extractSummary(output: AiExtractionOutput) {
  return (
    output.document_summary?.one_line_summary ??
    output.document_summary?.detailed_summary ??
    output.document_summary?.short_summary?.[0] ??
    null
  );
}

function extractKeyPoints(output: AiExtractionOutput) {
  return (output.document_summary?.key_points ?? [])
    .map((point) => point.text)
    .filter((text): text is string => Boolean(text));
}

function extractRisks(output: AiExtractionOutput) {
  return (output.risks_and_notes ?? []).map((risk) =>
    typeof risk === "string" ? risk : risk.title ?? risk.description ?? ""
  ).filter(Boolean);
}

function jsonString(value: unknown) {
  return JSON.stringify(value ?? null);
}

function getResponseText(response: unknown) {
  const typed = response as {
    output_text?: string;
    output?: Array<{
      content?: Array<{ type?: string; text?: string; json?: unknown }>;
    }>;
  };
  if (typed.output_text) {
    return typed.output_text;
  }
  const parts: string[] = [];
  for (const outputItem of typed.output ?? []) {
    for (const content of outputItem.content ?? []) {
      if (typeof content.text === "string") {
        parts.push(content.text);
      } else if (content.json) {
        parts.push(JSON.stringify(content.json));
      }
    }
  }
  return parts.join("\n").trim();
}

function buildPrompt(args: {
  document: DocumentContextRow;
  assetNames: string[];
}) {
  return [
    "あなたは不動産・施設管理会社向けの書類処理AIです。",
    "入力されたPDFまたは画像から、期限管理・担当者割当・承認画面に必要な情報を抽出してください。",
    "対象書類は主に行政/自治体通知、契約更新案内、リース更新、保険満期案内、法改正に伴う提出物案内です。",
    "",
    "厳守事項:",
    "- 不明な値は推測で埋めず null または空配列にする。",
    "- 日付は判定できる場合のみ YYYY-MM-DD に正規化する。",
    "- 重要な期限が複数ある場合、主対応期限に is_primary_due_date=true を付ける。",
    "- タスク化できる対応は required_actions と task_candidates に入れる。",
    "- 日本語で返す。",
    "",
    `既存タイトル: ${args.document.title}`,
    `入力種別: ${args.document.source_type}`,
    `選択済み取引先: ${args.document.counterparty_name ?? "なし"}`,
    `選択済み管理対象: ${args.assetNames.length > 0 ? args.assetNames.join(", ") : "なし"}`,
    args.document.source_text
      ? [
          "",
          "貼り付け本文:",
          "```text",
          args.document.source_text,
          "```",
        ].join("\n")
      : "",
  ].join("\n");
}

async function getDocumentContext(args: ExtractionInput) {
  const document = await query<DocumentContextRow>(
    `SELECT
       d.id,
       d.organization_id,
       d.title,
       d.source_type::text AS source_type,
       d.source_text,
       c.name AS counterparty_name,
       c.counterparty_type::text AS counterparty_type
     FROM documents d
     LEFT JOIN counterparties c
       ON c.organization_id = d.organization_id
      AND c.id = d.counterparty_id
      AND c.deleted_at IS NULL
     WHERE d.organization_id = $1
       AND d.id = $2
       AND d.deleted_at IS NULL
     LIMIT 1`,
    [args.organizationId, args.documentId]
  );

  if (!document.rows[0]) {
    throw new Error("Document not found");
  }

  const files = await query<DocumentFileRow>(
    `SELECT id, original_filename, mime_type, storage_key, size_bytes
     FROM document_files
     WHERE organization_id = $1
       AND document_id = $2
       AND file_role = 'original'
       AND deleted_at IS NULL
     ORDER BY created_at ASC`,
    [args.organizationId, args.documentId]
  );

  if (files.rows.length === 0 && !document.rows[0].source_text) {
    throw new Error("Document has no original files or source text");
  }

  const assets = await query<{ name: string }>(
    `SELECT ma.name
     FROM document_assets da
     JOIN managed_assets ma
       ON ma.organization_id = da.organization_id
      AND ma.id = da.managed_asset_id
      AND ma.deleted_at IS NULL
     WHERE da.organization_id = $1
       AND da.document_id = $2
     ORDER BY ma.name ASC`,
    [args.organizationId, args.documentId]
  );

  return {
    document: document.rows[0],
    files: files.rows,
    assetNames: assets.rows.map((asset) => asset.name),
  };
}

async function createResponse(args: {
  prompt: string;
  files: Array<DocumentFileRow & { base64: string }>;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL || "gpt-4o-mini";
  const content: Array<Record<string, unknown>> = [
    {
      type: "input_text",
      text: args.prompt,
    },
  ];

  for (const file of args.files) {
    if (file.mime_type === "application/pdf") {
      content.push({
        type: "input_file",
        filename: file.original_filename ?? "document.pdf",
        file_data: `data:${file.mime_type};base64,${file.base64}`,
      });
    } else if (file.mime_type.startsWith("image/")) {
      content.push({
        type: "input_image",
        image_url: `data:${file.mime_type};base64,${file.base64}`,
      });
    }
  }

  const response = await runOpenAIWithRetry(async () => {
    const result = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "user",
            content,
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "yomitori_docutask_extraction",
            strict: false,
            schema: extractionJsonSchema,
          },
        },
      }),
    });

    if (!result.ok) {
      const body = await result.text().catch(() => "");
      const error = new Error(`OpenAI response failed: ${result.status} ${body}`);
      (error as { status?: number }).status = result.status;
      throw error;
    }

    return result.json();
  });

  return {
    model,
    response,
  };
}

async function insertExtractedItems(args: {
  organizationId: string;
  documentId: string;
  extractionId: string;
  output: AiExtractionOutput;
}) {
  const items: Array<{
    type: string;
    label: string;
    text?: string | null;
    date?: string | null;
    json?: unknown;
    confidence?: number | null;
  }> = [];

  for (const date of args.output.important_dates ?? []) {
    items.push({
      type: "due_date",
      label: date.label ?? date.date_type ?? "重要日付",
      text: date.description ?? date.raw_date_text ?? null,
      date: normalizeDate(date.date),
      json: date,
      confidence: clampConfidence(date.confidence?.score),
    });
  }

  for (const action of args.output.required_actions ?? []) {
    items.push({
      type: "required_action",
      label: action.title ?? "必要対応",
      text: action.description ?? null,
      date: normalizeDate(action.due_date),
      json: action,
      confidence: clampConfidence(action.confidence?.score),
    });
  }

  for (const requiredDocument of args.output.required_documents ?? []) {
    items.push({
      type: "required_document",
      label: requiredDocument.name ?? "提出物",
      text: requiredDocument.description ?? null,
      date: normalizeDate(requiredDocument.due_date),
      json: requiredDocument,
      confidence: clampConfidence(requiredDocument.confidence?.score),
    });
  }

  for (const task of args.output.task_candidates ?? []) {
    items.push({
      type: "task",
      label: task.title ?? "タスク候補",
      text: task.description ?? null,
      date: normalizeDate(task.due_date),
      json: task,
      confidence: clampConfidence(task.confidence?.score),
    });
  }

  for (const item of items) {
    await query(
      `INSERT INTO extracted_items (
         organization_id,
         extraction_id,
         document_id,
         item_type,
         label,
         value_text,
         value_date,
         value_json,
         confidence,
         source_refs
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, '[]'::jsonb)`,
      [
        args.organizationId,
        args.extractionId,
        args.documentId,
        item.type,
        item.label,
        item.text ?? null,
        item.date ?? null,
        jsonString(item.json),
        item.confidence ?? null,
      ]
    );
  }
}

export async function runDocumentAiExtraction(args: ExtractionInput) {
  const context = await getDocumentContext(args);
  const bucket = context.files.length > 0 ? await getR2DocumentsBucket() : null;
  if (context.files.length > 0 && !bucket?.get) {
    throw new Error("R2 bucket get is not configured");
  }

  const extraction = await query<{ id: string }>(
    `INSERT INTO ai_extractions (
       organization_id,
       document_id,
       status,
       model,
       prompt_version,
       schema_version,
       created_by_member_id
     )
     VALUES ($1, $2, 'processing', $3, $4, $5, $6)
     RETURNING id`,
    [
      args.organizationId,
      args.documentId,
      process.env.OPENAI_DOCUMENT_EXTRACTION_MODEL || "gpt-4o-mini",
      PROMPT_VERSION,
      SCHEMA_VERSION,
      args.memberId,
    ]
  );
  const extractionId = extraction.rows[0].id;

  try {
    const filesWithData = [];
    const hash = crypto.createHash("sha256");
    if (context.document.source_text) {
      hash.update(context.document.source_text);
    }
    for (const file of context.files.slice(0, 5)) {
      const object = await bucket!.get!(file.storage_key);
      if (!object) {
        throw new Error(`R2 object not found: ${file.storage_key}`);
      }
      const buffer = Buffer.from(await object.arrayBuffer());
      hash.update(buffer);
      filesWithData.push({
        ...file,
        base64: buffer.toString("base64"),
      });
    }

    const { model, response } = await createResponse({
      prompt: buildPrompt({
        document: context.document,
        assetNames: context.assetNames,
      }),
      files: filesWithData,
    });
    const text = getResponseText(response);
    const output = JSON.parse(text) as AiExtractionOutput;

    const confidence = getOverallConfidence(output);
    await query(
      `UPDATE ai_extractions
       SET status = 'succeeded',
           model = $4,
           input_text_hash = $5,
           raw_output = $6::jsonb,
           normalized_output = $7::jsonb,
           overall_confidence = $8,
           completed_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND document_id = $3`,
      [
        extractionId,
        args.organizationId,
        args.documentId,
        model,
        hash.digest("hex"),
        jsonString(response),
        jsonString(output),
        confidence,
      ]
    );

    await insertExtractedItems({
      organizationId: args.organizationId,
      documentId: args.documentId,
      extractionId,
      output,
    });

    const documentType = normalizeDocumentType(
      output.document_classification?.document_type
    );
    const titleCandidate = output.document_summary?.title_candidate ?? null;
    const dueDate = extractPrimaryDueDate(output);
    const summary = extractSummary(output);
    const keyPoints = extractKeyPoints(output);
    const risks = extractRisks(output);
    const status =
      (output.required_actions?.length ?? 0) > 0 ? "action_required" : "needs_review";

    await query(
      `UPDATE documents
       SET suggested_title = $3,
           document_type = $4,
           status = $5,
           due_date = $6,
           summary = $7,
           key_points = $8::jsonb,
           required_actions = $9::jsonb,
           required_documents = $10::jsonb,
           risks = $11::jsonb,
           metadata = metadata || $12::jsonb,
           updated_at = now()
       WHERE organization_id = $1
         AND id = $2`,
      [
        args.organizationId,
        args.documentId,
        titleCandidate,
        documentType,
        status,
        dueDate,
        summary,
        jsonString(keyPoints),
        jsonString(output.required_actions ?? []),
        jsonString(output.required_documents ?? []),
        jsonString(risks),
        jsonString({
          latest_extraction_id: extractionId,
          extraction_prompt_version: PROMPT_VERSION,
        }),
      ]
    );

    await query(
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
         updated_at = now()`,
      [args.organizationId, args.documentId, args.memberId, jsonString(output)]
    );

    await query(
      `UPDATE processing_jobs
       SET status = 'succeeded',
           finished_at = now(),
           updated_at = now()
       WHERE organization_id = $1
         AND document_id = $2
         AND job_type = 'ai_extract'
         AND status IN ('queued', 'running')`,
      [args.organizationId, args.documentId]
    );

    return {
      extractionId,
      output,
      document: {
        id: args.documentId,
        status,
        document_type: documentType,
        suggested_title: titleCandidate,
        due_date: dueDate,
        summary,
      },
    };
  } catch (error) {
    await query(
      `UPDATE ai_extractions
       SET status = 'failed',
           raw_output = $4::jsonb,
           completed_at = now()
       WHERE id = $1
         AND organization_id = $2
         AND document_id = $3`,
      [
        extractionId,
        args.organizationId,
        args.documentId,
        jsonString({ error: serializeOpenAIError(error) }),
      ]
    ).catch(() => undefined);
    await query(
      `UPDATE processing_jobs
       SET status = 'failed',
           error_message = $3,
           finished_at = now(),
           updated_at = now()
       WHERE organization_id = $1
         AND document_id = $2
         AND job_type = 'ai_extract'
         AND status IN ('queued', 'running')`,
      [
        args.organizationId,
        args.documentId,
        error instanceof Error ? error.message : String(error),
      ]
    ).catch(() => undefined);
    throw error;
  }
}
