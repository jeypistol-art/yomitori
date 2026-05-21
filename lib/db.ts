import { neon } from "@neondatabase/serverless";

export type QueryResultRow = Record<string, unknown>;

export type QueryResult<T = QueryResultRow> = {
  rows: T[];
  rowCount: number;
};

let currentDatabaseUrl = "";
let sql: ReturnType<typeof neon> | null = null;

function getClient() {
  const databaseUrl = process.env.DATABASE_URL?.trim() ?? "";
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  if (!sql || currentDatabaseUrl !== databaseUrl) {
    currentDatabaseUrl = databaseUrl;
    sql = neon(databaseUrl);
  }

  return sql;
}

function resetClient() {
  sql = currentDatabaseUrl ? neon(currentDatabaseUrl) : null;
}

export async function query<T = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  try {
    const rows = await getClient()(text, params as unknown[]);
    return {
      rows: (rows as T[]) ?? [],
      rowCount: (rows as T[])?.length ?? 0,
    };
  } catch (err: unknown) {
    const code =
      typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: unknown }).code ?? "")
        : "";
    if (code === "ECONNRESET") {
      resetClient();
      const retry = await getClient()(text, params as unknown[]);
      return {
        rows: (retry as T[]) ?? [],
        rowCount: (retry as T[])?.length ?? 0,
      };
    }
    throw err;
  }
}
