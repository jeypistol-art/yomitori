import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { getLockedFeatures } from "@/lib/feature_gates";
import { getPlanCatalogItem } from "@/lib/usage_catalog";

export default function PlanUpgradePanel({
  currentPlanCode,
}: {
  currentPlanCode: string;
}) {
  const locked = getLockedFeatures(currentPlanCode);
  if (locked.length === 0) {
    return null;
  }

  const nextLocked = locked[0];
  const requiredPlan = getPlanCatalogItem(nextLocked.minimumPlan);

  return (
    <section className="border border-[#d9ded3] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#fff8eb] text-[#9a5b13]">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#2f5d50]">
              Upgrade
            </p>
            <h2 className="mt-1 break-words text-xl font-bold">
              {requiredPlan.name}で「{nextLocked.label}」を使えます
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#4b5563]">
              {nextLocked.description}
            </p>
          </div>
        </div>
        <Link
          href="/usage"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-[#d9ded3] px-3 text-sm font-bold text-[#2f5d50]"
        >
          プランを見る
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
