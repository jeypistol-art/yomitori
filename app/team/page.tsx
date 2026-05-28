import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import TeamMembersClient from "@/components/TeamMembersClient";
import FeatureGateNotice from "@/components/FeatureGateNotice";
import { authOptions } from "@/lib/auth_options";
import { getCurrentOrganization } from "@/lib/current_organization";
import { canUseFeature } from "@/lib/feature_gates";

export const metadata: Metadata = {
  title: "担当者設定",
};

export default async function TeamPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const currentOrganization = await getCurrentOrganization(session.user.id);
  if (!currentOrganization) {
    redirect("/login");
  }
  const canManageTeam = canUseFeature(
    currentOrganization.plan_code,
    "team_members"
  );
  const canManagePermissions = canUseFeature(
    currentOrganization.plan_code,
    "advanced_permissions"
  );

  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
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
              Team
            </p>
            <h1 className="mt-1 text-3xl font-bold">担当者設定</h1>
          </div>
          <div className="border border-[#d9ded3] bg-white px-4 py-3 text-right">
            <p className="text-sm font-bold">{currentOrganization.organization_name}</p>
            <p className="mt-1 text-xs font-semibold uppercase text-[#5f6b5f]">
              {currentOrganization.role}
            </p>
          </div>
        </header>

        <div className="space-y-5">
          <FeatureGateNotice
            currentPlanCode={currentOrganization.plan_code}
            featureKey="team_members"
          />
          {canManageTeam ? (
            <TeamMembersClient canManagePermissions={canManagePermissions} />
          ) : null}
        </div>
      </div>
    </main>
  );
}
