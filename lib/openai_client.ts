import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isTransientConnectionError = (error: unknown) => {
  const e = error as { message?: string; status?: number };
  const message = (e?.message || "").toLowerCase();
  const status = e?.status;
  return (
    status === 408 ||
    status === 429 ||
    (typeof status === "number" && status >= 500) ||
    message.includes("connection error") ||
    message.includes("network") ||
    message.includes("fetch failed") ||
    message.includes("timeout")
  );
};

export const getOpenAIClient = () => {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  cachedClient = new OpenAI({
    apiKey,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, init),
    maxRetries: 2,
    timeout: 120000,
  });

  return cachedClient;
};

export const serializeOpenAIError = (error: unknown) => {
  const e = error as {
    name?: string;
    message?: string;
    status?: number;
    code?: string;
    type?: string;
    cause?: unknown;
  };
  return {
    name: e?.name ?? "UnknownError",
    message: e?.message ?? String(error),
    status: e?.status ?? null,
    code: e?.code ?? null,
    type: e?.type ?? null,
    cause: e?.cause ? String(e.cause) : null,
  };
};

export async function runOpenAIWithRetry<T>(
  operation: () => Promise<T>,
  maxAttempts = 3
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isTransientConnectionError(error)) {
        throw error;
      }
      await sleep(attempt * 1200);
    }
  }

  throw lastError ?? new Error("OpenAI request failed");
}

