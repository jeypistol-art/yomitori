import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import DocumentReviewClient from "@/components/DocumentReviewClient";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";
import { canUseFeature } from "@/lib/feature_gates";

type PageProps = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = {
  title: "AI抽出確認・承認",
};

export default async function DocumentReviewPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentOrganization = await getCurrentOrganization(session.user.id);
  if (!currentOrganization) {
    redirect("/login");
  }

  const { id } = await params;
  const canUseSharedLedger = canUseFeature(
    currentOrganization.plan_code,
    "shared_ledger"
  );
  const canAssignTeamTasks = canUseFeature(
    currentOrganization.plan_code,
    "assignee_workflow"
  );

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-5 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/documents/new"
              className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-[#2f5d50]"
            >
              <ChevronLeft className="h-4 w-4" />
              書類一覧
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
              Review
            </p>
            <h1 className="mt-1 text-3xl font-bold">AI抽出確認・承認</h1>
          </div>
          <div className="border border-[#d9ded3] bg-white px-4 py-3 text-right">
            <p className="text-sm font-bold">{currentOrganization.organization_name}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-[#5f6b5f]">
              {currentOrganization.role}
            </p>
          </div>
        </header>

        <DocumentReviewClient
          canAssignTeamTasks={canAssignTeamTasks}
          canUseSharedLedger={canUseSharedLedger}
          documentId={id}
        />
      </div>
    </main>
  );
}
