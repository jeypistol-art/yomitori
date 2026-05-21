import Link from "next/link";
import { LockKeyhole, ArrowRight } from "lucide-react";
import {
  canUseFeature,
  FEATURE_GATES,
  type FeatureKey,
} from "@/lib/feature_gates";
import { getPlanCatalogItem } from "@/lib/usage_catalog";

type FeatureGateNoticeProps = {
  currentPlanCode: string;
  featureKey: FeatureKey;
  className?: string;
};

export default function FeatureGateNotice({
  currentPlanCode,
  featureKey,
  className = "",
}: FeatureGateNoticeProps) {
  if (canUseFeature(currentPlanCode, featureKey)) {
    return null;
  }

  const feature = FEATURE_GATES.find((item) => item.key === featureKey);
  if (!feature) {
    return null;
  }

  const requiredPlan = getPlanCatalogItem(feature.minimumPlan);

  return (
    <section className={`border border-[#f0d6a8] bg-[#fff8eb] p-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#9a5b13]">
            <LockKeyhole className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#9a5b13]">
              {requiredPlan.name}プランの価値
            </p>
            <h2 className="mt-1 break-words text-lg font-bold">
              {feature.label}
            </h2>
            <p className="mt-2 text-sm leading-6 text-[#4b5563]">
              {feature.description}
            </p>
          </div>
        </div>
        <Link
          href="/usage"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-[#d9ded3] bg-white px-3 text-sm font-bold text-[#2f5d50]"
        >
          プランを見る
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
