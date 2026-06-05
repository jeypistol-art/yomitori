export const API_KEY_SCOPES = [
  {
    scope: "documents:read",
    label: "書類の参照",
    description: "外部システムから書類メタデータを参照します。",
  },
  {
    scope: "tasks:read",
    label: "タスクの参照",
    description: "外部システムからタスク一覧と状態を参照します。",
  },
  {
    scope: "webhooks:read",
    label: "Webhook履歴の参照",
    description: "配信履歴と連携状態を参照します。",
  },
] as const;

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]["scope"];

const scopeSet = new Set<string>(API_KEY_SCOPES.map((item) => item.scope));

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function normalizeApiKeyScopes(value: unknown): ApiKeyScope[] {
  const raw = Array.isArray(value) ? value : [];
  const result: ApiKeyScope[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !scopeSet.has(item)) {
      continue;
    }
    const scope = item as ApiKeyScope;
    if (!result.includes(scope)) {
      result.push(scope);
    }
  }
  return result;
}

export function createApiKeySecret() {
  const random = `${crypto.randomUUID().replace(/-/g, "")}${crypto
    .randomUUID()
    .replace(/-/g, "")}`;
  return `ydt_live_${random}`;
}

export function getApiKeyPrefix(secret: string) {
  return secret.slice(0, 18);
}

export function maskApiKey(prefix: string | null) {
  if (!prefix) {
    return null;
  }
  return `${prefix}...`;
}

export async function hashApiKey(secret: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(secret)
  );
  return bytesToHex(new Uint8Array(digest));
}
