import { neon } from "@neondatabase/serverless";

export type QueryResultRow = Record<string, unknown>;

export type QueryResult<T = QueryResultRow> = {
  rows: T[];
  rowCount: number;
};

const databaseUrl = process.env.DATABASE_URL ?? "";
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

let sql = neon(databaseUrl);

function resetClient() {
  sql = neon(databaseUrl);
}

export async function query<T = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  try {
    const rows = await sql(text, params as unknown[]);
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
      const retry = await sql(text, params as unknown[]);
      return {
        rows: (retry as T[]) ?? [],
        rowCount: (retry as T[])?.length ?? 0,
      };
    }
    throw err;
  }
}

