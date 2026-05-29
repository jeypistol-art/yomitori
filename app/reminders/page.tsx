import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import HeaderAccountActions from "@/components/HeaderAccountActions";
import ReminderListClient from "@/components/ReminderListClient";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";

export const metadata: Metadata = {
  title: "リマインド",
};

type RemindersPageProps = {
  searchParams: Promise<{
    status?: string;
    timing?: string;
  }>;
};

const allowedStatusFilters = new Set(["all", "scheduled", "sent", "canceled", "failed"]);
const allowedTimingFilters = new Set(["all", "overdue", "today", "week"]);

function normalizeFilter(value: string | undefined, allowed: Set<string>, fallback: string) {
  return value && allowed.has(value) ? value : fallback;
}

export default async function RemindersPage({ searchParams }: RemindersPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentOrganization = await getCurrentOrganization(session.user.id);
  if (!currentOrganization) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const initialStatusFilter = normalizeFilter(
    resolvedSearchParams.status,
    allowedStatusFilters,
    "scheduled"
  );
  const initialTimingFilter = normalizeFilter(
    resolvedSearchParams.timing,
    allowedTimingFilters,
    "all"
  );

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#2f5d50]"
            >
              <ChevronLeft className="h-4 w-4" />
              ダッシュボード
            </Link>
            <p className="text-xs font-semibold text-[#2f5d50]">Reminders</p>
            <h1 className="mt-1 text-3xl font-bold">リマインド</h1>
          </div>
          <HeaderAccountActions
            organizationName={currentOrganization.organization_name}
            role={currentOrganization.role}
          />
        </header>

        <ReminderListClient
          initialStatusFilter={initialStatusFilter}
          initialTimingFilter={initialTimingFilter}
        />
      </div>
    </main>
  );
}
