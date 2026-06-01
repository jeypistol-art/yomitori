import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import FeatureGateNotice from "@/components/FeatureGateNotice";
import HeaderAccountActions from "@/components/HeaderAccountActions";
import MasterDataClient from "@/components/MasterDataClient";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";
import { canUseFeature } from "@/lib/feature_gates";

export const metadata: Metadata = {
  title: "台帳設定",
};

export default async function MasterDataPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentOrganization = await getCurrentOrganization(session.user.id);
  if (!currentOrganization) {
    redirect("/login");
  }
  const canUseSharedLedger = canUseFeature(
    currentOrganization.plan_code,
    "shared_ledger"
  );
  const canUseBranchLedgers = canUseFeature(
    currentOrganization.plan_code,
    "branch_ledgers"
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
              Master Data
            </p>
            <h1 className="mt-1 text-3xl font-bold">台帳設定</h1>
          </div>
          <HeaderAccountActions
            organizationName={currentOrganization.organization_name}
            role={currentOrganization.role}
          />
        </header>

        <div className="space-y-5">
          <FeatureGateNotice
            currentPlanCode={currentOrganization.plan_code}
            featureKey="shared_ledger"
          />
          {canUseSharedLedger ? (
            <>
              <FeatureGateNotice
                currentPlanCode={currentOrganization.plan_code}
                featureKey="branch_ledgers"
              />
              <MasterDataClient canUseBranchLedgers={canUseBranchLedgers} />
            </>
          ) : null}
        </div>
      </div>
    </main>
  );
}
