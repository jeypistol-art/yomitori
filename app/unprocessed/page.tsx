import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import FeatureGateNotice from "@/components/FeatureGateNotice";
import HeaderAccountActions from "@/components/HeaderAccountActions";
import UnprocessedQueueClient from "@/components/UnprocessedQueueClient";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";
import { canUseFeature } from "@/lib/feature_gates";

export const metadata: Metadata = {
  title: "未処理一覧",
};

export default async function UnprocessedPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentOrganization = await getCurrentOrganization(session.user.id);
  if (!currentOrganization) {
    redirect("/login");
  }
  const canUseWorkQueue = canUseFeature(
    currentOrganization.plan_code,
    "monthly_work_queue"
  );

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
            <p className="text-xs font-semibold text-[#2f5d50]">Work Queue</p>
            <h1 className="mt-1 text-3xl font-bold">未処理一覧</h1>
          </div>
          <HeaderAccountActions
            organizationName={currentOrganization.organization_name}
            role={currentOrganization.role}
          />
        </header>

        <div className="space-y-5">
          <FeatureGateNotice
            currentPlanCode={currentOrganization.plan_code}
            featureKey="monthly_work_queue"
          />
          {canUseWorkQueue ? <UnprocessedQueueClient /> : null}
        </div>
      </div>
    </main>
  );
}
