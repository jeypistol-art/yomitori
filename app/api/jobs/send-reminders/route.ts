import { NextResponse } from "next/server";
import { ApiError, jsonApiError } from "@/lib/api_errors";
import { processDueReminders } from "@/lib/reminder_dispatcher";

function requireJobSecret(request: Request) {
  const secret = process.env.NOTIFICATION_JOB_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new ApiError(500, "NOTIFICATION_JOB_SECRET is not configured");
    }
    return;
  }

  const authorization = request.headers.get("authorization") ?? "";
  const bearer = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  const headerSecret = request.headers.get("x-job-secret")?.trim() ?? "";
  if (bearer !== secret && headerSecret !== secret) {
    throw new ApiError(401, "Unauthorized");
  }
}

export async function POST(request: Request) {
  try {
    requireJobSecret(request);
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit");
    const result = await processDueReminders({
      limit: limit ? Number(limit) : undefined,
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    return jsonApiError(error);
  }
}
