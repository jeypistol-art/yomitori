import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth_options";
import { requireCurrentOrganization } from "@/lib/current_organization";
import { ApiError } from "@/lib/api_errors";

export async function requireApiContext() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const currentOrganization = await requireCurrentOrganization(userId);
  return {
    session,
    userId,
    currentOrganization,
  };
}
