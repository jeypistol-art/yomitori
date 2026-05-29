import { query } from "@/lib/db";

type JsonRecord = Record<string, unknown>;

type DiffDocumentRow = {
  id: string;
  title: string;
  suggested_title: string | null;
  document_type: string;
  status: string;
  summary: string | null;
  due_date: string | null;
  key_points: unknown;
  required_actions: unknown;
  required_documents: unknown;
  risks: unknown;
  metadata: unknown;
  created_at: string;
  approved_at: string | null;
  counterparty_id: string | null;
  counterparty_name: string | null;
};

type AssetRow = {
  id: string;
  name: string;
  asset_type: string;
};

type AiExtractionRow = {
  normalized_output: unknown;
};

type ReviewDraftRow = {
  draft_json: unknown;
};

type CandidateRow = DiffDocumentRow & {
  asset_overlap_count: number;
  same_counterparty: boolean;
  same_type: boolean;
};

type Snapshot = {
  id: string;
  title: string;
  document_type: string;
  status: string;
  summary: string;
  due_date: string;
  key_points: string[];
  required_documents: string[];
  required_actions: string[];
  risks: string[];
  created_at: string;
  approved_at: string | null;
  counterparty_name: string | null;
  assets: AssetRow[];
};

export type DocumentDiffStatus = "added" | "removed" | "changed" | "unchanged";

export type DocumentScalarDiff = {
  key: string;
  label: string;
  previous: string;
  current: string;
  status: DocumentDiffStatus;
};

export type DocumentListDiff = {
  key: string;
  label: string;
  added: string[];
  removed: string[];
  unchanged: string[];
  previous_count: number;
  current_count: number;
};

export type DocumentDiffMatch = {
  reason: string;
  asset_overlap_count: number;
  same_counterparty: boolean;
  same_type: boolean;
  manual: boolean;
};

export type DocumentDiffCandidate = Pick<
  Snapshot,
  | "id"
  | "title"
  | "document_type"
  | "status"
  | "created_at"
  | "approved_at"
  | "counterparty_name"
> & {
  match: DocumentDiffMatch;
};

export type DocumentDiffResult = {
  current_document: Pick<
    Snapshot,
    | "id"
    | "title"
    | "document_type"
    | "status"
    | "created_at"
    | "approved_at"
    | "counterparty_name"
    | "assets"
  >;
  previous_document: Pick<
    Snapshot,
    | "id"
    | "title"
    | "document_type"
    | "status"
    | "created_at"
    | "approved_at"
    | "counterparty_name"
    | "assets"
  > | null;
  candidates: DocumentDiffCandidate[];
  match: DocumentDiffMatch | null;
  scalar_changes: DocumentScalarDiff[];
  list_changes: DocumentListDiff[];
  summary: {
    changed_count: number;
    added_count: number;
    removed_count: number;
    unchanged_count: number;
  };
};

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asRecord(value: unknown): JsonRecord {
  return isRecord(value) ? value : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecordArray(value: unknown): JsonRecord[] {
  return asArray(value).map(asRecord);
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = cleanText(record[key]);
    if (value) {
      return value;
    }
  }
  return "";
}

function dateText(value: unknown) {
  const text = cleanText(value);
  return text ? text.slice(0, 10) : "";
}

function normalizeCompareKey(value: string) {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function uniqueTexts(values: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = normalizeCompareKey(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }
  return result;
}

function formatItem(record: JsonRecord, textKeys: string[], extraKeys: string[] = []) {
  const text = firstString(record, textKeys);
  const extras = extraKeys
    .map((key) => {
      const value = cleanText(record[key]);
      return value ? `${key}: ${value}` : "";
    })
    .filter(Boolean);
  return [text, ...extras].filter(Boolean).join(" / ");
}

function normalizeTextList(
  value: unknown,
  textKeys: string[],
  extraKeys: string[] = []
) {
  return uniqueTexts(
    asArray(value)
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        return formatItem(asRecord(item), textKeys, extraKeys);
      })
      .filter(Boolean)
  );
}

function getPrimaryDueDate(source: JsonRecord, document: DiffDocumentRow) {
  const importantDates = asRecordArray(source.important_dates);
  const primary =
    importantDates.find((item) => item.is_primary_due_date === true) ??
    importantDates[0];
  return (
    dateText(primary?.date) ||
    dateText(primary?.due_date) ||
    dateText(primary?.deadline) ||
    dateText(document.due_date)
  );
}

function buildSnapshot(args: {
  document: DiffDocumentRow;
  assets: AssetRow[];
  extraction: AiExtractionRow | null;
  draft: ReviewDraftRow | null;
}): Snapshot {
  const source = asRecord(
    args.draft?.draft_json ?? args.extraction?.normalized_output ?? {}
  );
  const summary = asRecord(source.document_summary);
  const classification = asRecord(source.document_classification);

  return {
    id: args.document.id,
    title:
      firstString(summary, ["title_candidate", "title"]) ||
      args.document.suggested_title ||
      args.document.title,
    document_type:
      firstString(classification, ["document_type"]) || args.document.document_type,
    status: args.document.status,
    summary:
      firstString(summary, ["one_line_summary", "summary"]) ||
      cleanText(args.document.summary),
    due_date: getPrimaryDueDate(source, args.document),
    key_points: normalizeTextList(
      summary.key_points ?? source.key_points ?? args.document.key_points,
      ["text", "key_point", "point", "content", "title", "description"]
    ),
    required_documents: normalizeTextList(
      source.required_documents ?? args.document.required_documents,
      ["name", "document_name", "document", "document_type", "label", "title"],
      ["submit_to", "due_date"]
    ),
    required_actions: normalizeTextList(
      source.task_candidates ?? source.required_actions ?? args.document.required_actions,
      ["title", "task", "task_description", "action", "action_description", "label"],
      ["due_date", "priority"]
    ),
    risks: normalizeTextList(
      source.risks_and_notes ?? args.document.risks,
      ["title", "warning", "description", "risk", "text", "message", "content"]
    ),
    created_at: args.document.created_at,
    approved_at: args.document.approved_at,
    counterparty_name: args.document.counterparty_name,
    assets: args.assets,
  };
}

function scalarDiff(
  key: string,
  label: string,
  previous: string,
  current: string
): DocumentScalarDiff {
  const previousText = previous.trim();
  const currentText = current.trim();
  const previousKey = normalizeCompareKey(previousText);
  const currentKey = normalizeCompareKey(currentText);
  const status: DocumentDiffStatus =
    previousKey === currentKey
      ? "unchanged"
      : previousText && currentText
        ? "changed"
        : currentText
          ? "added"
          : "removed";
  return {
    key,
    label,
    previous: previousText,
    current: currentText,
    status,
  };
}

function listDiff(
  key: string,
  label: string,
  previous: string[],
  current: string[]
): DocumentListDiff {
  const previousMap = new Map(previous.map((item) => [normalizeCompareKey(item), item]));
  const currentMap = new Map(current.map((item) => [normalizeCompareKey(item), item]));

  const added = current.filter((item) => !previousMap.has(normalizeCompareKey(item)));
  const removed = previous.filter((item) => !currentMap.has(normalizeCompareKey(item)));
  const unchanged = current.filter((item) =>
    previousMap.has(normalizeCompareKey(item))
  );

  return {
    key,
    label,
    added,
    removed,
    unchanged,
    previous_count: previous.length,
    current_count: current.length,
  };
}

function summarizeDiffs(
  scalarChanges: DocumentScalarDiff[],
  listChanges: DocumentListDiff[]
) {
  return {
    changed_count:
      scalarChanges.filter((item) => item.status === "changed").length +
      listChanges.filter((item) => item.added.length || item.removed.length).length,
    added_count:
      scalarChanges.filter((item) => item.status === "added").length +
      listChanges.reduce((sum, item) => sum + item.added.length, 0),
    removed_count:
      scalarChanges.filter((item) => item.status === "removed").length +
      listChanges.reduce((sum, item) => sum + item.removed.length, 0),
    unchanged_count:
      scalarChanges.filter((item) => item.status === "unchanged").length +
      listChanges.reduce((sum, item) => sum + item.unchanged.length, 0),
  };
}

async function getDocumentRow(organizationId: string, documentId: string) {
  const result = await query<DiffDocumentRow>(
    `SELECT
       d.id,
       d.title,
       d.suggested_title,
       d.document_type::text AS document_type,
       d.status::text AS status,
       d.summary,
       d.due_date::text AS due_date,
       d.key_points,
       d.required_actions,
       d.required_documents,
       d.risks,
       d.metadata,
       d.created_at,
       d.approved_at,
       d.counterparty_id,
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
    [organizationId, documentId]
  );

  return result.rows[0] ?? null;
}

async function getAssets(organizationId: string, documentId: string) {
  const result = await query<AssetRow>(
    `SELECT ma.id, ma.name, ma.asset_type::text AS asset_type
     FROM document_assets da
     JOIN managed_assets ma
       ON ma.organization_id = da.organization_id
      AND ma.id = da.managed_asset_id
      AND ma.deleted_at IS NULL
     WHERE da.organization_id = $1
       AND da.document_id = $2
     ORDER BY ma.name ASC`,
    [organizationId, documentId]
  );
  return result.rows;
}

async function getLatestExtraction(organizationId: string, documentId: string) {
  const result = await query<AiExtractionRow>(
    `SELECT normalized_output
     FROM ai_extractions
     WHERE organization_id = $1
       AND document_id = $2
       AND status = 'succeeded'
     ORDER BY created_at DESC
     LIMIT 1`,
    [organizationId, documentId]
  );
  return result.rows[0] ?? null;
}

async function getReviewDraft(organizationId: string, documentId: string) {
  const result = await query<ReviewDraftRow>(
    `SELECT draft_json
     FROM review_drafts
     WHERE organization_id = $1
       AND document_id = $2
     LIMIT 1`,
    [organizationId, documentId]
  );
  return result.rows[0] ?? null;
}

async function findPreviousDocuments(args: {
  organizationId: string;
  currentDocument: DiffDocumentRow;
  currentAssetIds: string[];
}) {
  const result = await query<CandidateRow>(
    `SELECT
       d.id,
       d.title,
       d.suggested_title,
       d.document_type::text AS document_type,
       d.status::text AS status,
       d.summary,
       d.due_date::text AS due_date,
       d.key_points,
       d.required_actions,
       d.required_documents,
       d.risks,
       d.metadata,
       d.created_at,
       d.approved_at,
       d.counterparty_id,
       c.name AS counterparty_name,
       (
         SELECT count(*)::int
         FROM document_assets da
         WHERE da.organization_id = d.organization_id
           AND da.document_id = d.id
           AND da.managed_asset_id = ANY($3::uuid[])
       ) AS asset_overlap_count,
       (
         $4::uuid IS NOT NULL
         AND d.counterparty_id = $4::uuid
       ) AS same_counterparty,
       (
         $5::text <> 'unknown'
         AND d.document_type::text = $5::text
       ) AS same_type
     FROM documents d
     LEFT JOIN counterparties c
       ON c.organization_id = d.organization_id
      AND c.id = d.counterparty_id
      AND c.deleted_at IS NULL
     WHERE d.organization_id = $1
       AND d.id <> $2
       AND d.deleted_at IS NULL
       AND d.status <> 'failed'
       AND d.created_at < $6::timestamptz
     ORDER BY
       asset_overlap_count DESC,
       same_counterparty DESC,
       same_type DESC,
       d.approved_at DESC NULLS LAST,
       d.created_at DESC
     LIMIT 20`,
    [
      args.organizationId,
      args.currentDocument.id,
      args.currentAssetIds,
      args.currentDocument.counterparty_id,
      args.currentDocument.document_type,
      args.currentDocument.created_at,
    ]
  );

  return result.rows;
}

function publicSnapshot(snapshot: Snapshot) {
  return {
    id: snapshot.id,
    title: snapshot.title,
    document_type: snapshot.document_type,
    status: snapshot.status,
    created_at: snapshot.created_at,
    approved_at: snapshot.approved_at,
    counterparty_name: snapshot.counterparty_name,
    assets: snapshot.assets,
  };
}

function matchReason(candidate: CandidateRow) {
  const reasons = [];
  if (candidate.asset_overlap_count > 0) {
    reasons.push(`管理対象が${candidate.asset_overlap_count}件一致`);
  }
  if (candidate.same_counterparty) {
    reasons.push("取引先が一致");
  }
  if (candidate.same_type) {
    reasons.push("書類種別が一致");
  }
  return reasons.join(" / ") || "作成日時が近い過去書類";
}

function isMatchedCandidate(candidate: CandidateRow) {
  return (
    candidate.asset_overlap_count > 0 ||
    candidate.same_counterparty ||
    candidate.same_type
  );
}

function matchFromCandidate(
  candidate: CandidateRow,
  manual = false
): DocumentDiffMatch {
  return {
    reason: manual ? `手動選択 / ${matchReason(candidate)}` : matchReason(candidate),
    asset_overlap_count: candidate.asset_overlap_count,
    same_counterparty: candidate.same_counterparty,
    same_type: candidate.same_type,
    manual,
  };
}

function manualMatch(): DocumentDiffMatch {
  return {
    reason: "手動選択",
    asset_overlap_count: 0,
    same_counterparty: false,
    same_type: false,
    manual: true,
  };
}

function publicCandidate(candidate: CandidateRow): DocumentDiffCandidate {
  return {
    id: candidate.id,
    title: candidate.suggested_title || candidate.title,
    document_type: candidate.document_type,
    status: candidate.status,
    created_at: candidate.created_at,
    approved_at: candidate.approved_at,
    counterparty_name: candidate.counterparty_name,
    match: matchFromCandidate(candidate),
  };
}

export async function buildDocumentDiff(args: {
  organizationId: string;
  documentId: string;
  compareDocumentId?: string | null;
}): Promise<DocumentDiffResult> {
  const currentDocument = await getDocumentRow(args.organizationId, args.documentId);
  if (!currentDocument) {
    throw new Error("document not found");
  }

  const [currentAssets, currentExtraction, currentDraft] = await Promise.all([
    getAssets(args.organizationId, args.documentId),
    getLatestExtraction(args.organizationId, args.documentId),
    getReviewDraft(args.organizationId, args.documentId),
  ]);
  const currentSnapshot = buildSnapshot({
    document: currentDocument,
    assets: currentAssets,
    extraction: currentExtraction,
    draft: currentDraft,
  });

  const candidateRows = await findPreviousDocuments({
    organizationId: args.organizationId,
    currentDocument,
    currentAssetIds: currentAssets.map((asset) => asset.id),
  });
  const candidates = candidateRows.map(publicCandidate);
  const selectedCandidate = args.compareDocumentId
    ? candidateRows.find((candidate) => candidate.id === args.compareDocumentId)
    : null;
  const selectedManualDocument =
    args.compareDocumentId && !selectedCandidate
      ? await getDocumentRow(args.organizationId, args.compareDocumentId)
      : null;
  const autoCandidate = candidateRows.find(isMatchedCandidate) ?? null;
  const hasManualSelection = Boolean(args.compareDocumentId);
  const previousDocument = hasManualSelection
    ? selectedCandidate ?? selectedManualDocument ?? null
    : autoCandidate;
  const match = selectedCandidate
    ? matchFromCandidate(selectedCandidate, Boolean(args.compareDocumentId))
    : selectedManualDocument
      ? manualMatch()
      : autoCandidate
        ? matchFromCandidate(autoCandidate)
        : null;

  if (args.compareDocumentId) {
    if (args.compareDocumentId === currentDocument.id) {
      throw new Error("cannot compare same document");
    }
    if (!previousDocument || previousDocument.status === "failed") {
      throw new Error("compare document not found");
    }
    if (new Date(previousDocument.created_at) >= new Date(currentDocument.created_at)) {
      throw new Error("compare document must be older");
    }
  }

  if (!previousDocument) {
    return {
      current_document: publicSnapshot(currentSnapshot),
      previous_document: null,
      candidates,
      match: null,
      scalar_changes: [],
      list_changes: [],
      summary: {
        changed_count: 0,
        added_count: 0,
        removed_count: 0,
        unchanged_count: 0,
      },
    };
  }

  const [previousAssets, previousExtraction, previousDraft] = await Promise.all([
    getAssets(args.organizationId, previousDocument.id),
    getLatestExtraction(args.organizationId, previousDocument.id),
    getReviewDraft(args.organizationId, previousDocument.id),
  ]);
  const previousSnapshot = buildSnapshot({
    document: previousDocument,
    assets: previousAssets,
    extraction: previousExtraction,
    draft: previousDraft,
  });

  const scalarChanges = [
    scalarDiff(
      "document_type",
      "書類種別",
      previousSnapshot.document_type,
      currentSnapshot.document_type
    ),
    scalarDiff("due_date", "主期限", previousSnapshot.due_date, currentSnapshot.due_date),
    scalarDiff("summary", "要約", previousSnapshot.summary, currentSnapshot.summary),
  ];
  const listChanges = [
    listDiff(
      "key_points",
      "重要事項",
      previousSnapshot.key_points,
      currentSnapshot.key_points
    ),
    listDiff(
      "required_documents",
      "提出物",
      previousSnapshot.required_documents,
      currentSnapshot.required_documents
    ),
    listDiff(
      "required_actions",
      "タスク候補",
      previousSnapshot.required_actions,
      currentSnapshot.required_actions
    ),
    listDiff("risks", "リスク・注意点", previousSnapshot.risks, currentSnapshot.risks),
  ];

  return {
    current_document: publicSnapshot(currentSnapshot),
    previous_document: publicSnapshot(previousSnapshot),
    candidates,
    match,
    scalar_changes: scalarChanges,
    list_changes: listChanges,
    summary: summarizeDiffs(scalarChanges, listChanges),
  };
}
