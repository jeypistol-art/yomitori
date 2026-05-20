import { NextResponse } from "next/server";
import { requireApiContext } from "@/lib/api_context";
import { jsonApiError } from "@/lib/api_errors";
import { getEmailDeliveryStatus } from "@/lib/email_delivery";

export async function GET() {
  try {
    await requireApiContext();
    return NextResponse.json({ data: getEmailDeliveryStatus() });
  } catch (error) {
    return jsonApiError(error);
  }
}
