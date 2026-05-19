import { ApiError } from "@/lib/api_errors";
import type { CurrentOrganization } from "@/lib/current_organization";

type Role = "owner" | "admin" | "member" | "viewer";

function requireRole(current: CurrentOrganization, allowed: Role[], label: string) {
  if (!allowed.includes(current.role as Role)) {
    throw new ApiError(403, `${label}: insufficient permissions`);
  }
}

export function requireAdminWrite(current: CurrentOrganization) {
  requireRole(current, ["owner", "admin"], "admin write");
}

export function requireOperationalWrite(current: CurrentOrganization) {
  requireRole(current, ["owner", "admin", "member"], "operational write");
}

export function requireAuditRead(current: CurrentOrganization) {
  requireRole(current, ["owner", "admin"], "audit read");
}

export function requireDocumentDelete(current: CurrentOrganization) {
  requireRole(current, ["owner", "admin"], "document delete");
}

export function requireTaskDelete(current: CurrentOrganization) {
  requireRole(current, ["owner", "admin"], "task delete");
}
