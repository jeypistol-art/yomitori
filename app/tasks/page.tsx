import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import TaskListClient from "@/components/TaskListClient";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";

export const metadata: Metadata = {
  title: "タスク一覧",
};

type TasksPageProps = {
  searchParams: Promise<{
    due?: string;
    status?: string;
    assignee?: string;
  }>;
};

const allowedDueFilters = new Set(["all", "overdue", "week", "none"]);
const allowedStatusFilters = new Set([
  "active",
  "all",
  "todo",
  "in_progress",
  "waiting_review",
  "done",
  "unnecessary",
  "canceled",
]);

function normalizeFilter(value: string | undefined, allowed: Set<string>, fallback: string) {
  return value && allowed.has(value) ? value : fallback;
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentOrganization = await getCurrentOrganization(session.user.id);
  if (!currentOrganization) {
    redirect("/login");
  }

  const resolvedSearchParams = await searchParams;
  const initialDueFilter = normalizeFilter(
    resolvedSearchParams.due,
    allowedDueFilters,
    "all"
  );
  const initialStatusFilter = normalizeFilter(
    resolvedSearchParams.status,
    allowedStatusFilters,
    "active"
  );
  const initialAssigneeFilter = resolvedSearchParams.assignee ?? "all";

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#2f5d50]"
            >
              <ChevronLeft className="h-4 w-4" />
              ダッシュボード
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
              Tasks
            </p>
            <h1 className="mt-1 text-3xl font-bold">タスク一覧</h1>
          </div>
          <div className="border border-[#d9ded3] bg-white px-4 py-3 text-right">
            <p className="text-sm font-bold">{currentOrganization.organization_name}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-[#5f6b5f]">
              {currentOrganization.role}
            </p>
          </div>
        </header>

        <TaskListClient
          initialAssigneeFilter={initialAssigneeFilter}
          initialDueFilter={initialDueFilter}
          initialStatusFilter={initialStatusFilter}
        />
      </div>
    </main>
  );
}
