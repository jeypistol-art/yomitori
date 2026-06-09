import Link from "next/link";
import { getLegalConfig } from "@/lib/legal_config";

const legalLinks = [
  { href: "/manual", label: "マニュアル" },
  { href: "/legal/terms", label: "利用規約" },
  { href: "/legal/privacy", label: "プライバシーポリシー" },
  {
    href: "/legal/specified-commercial-transactions",
    label: "特商法表記",
  },
  { href: "/enterprise/contact", label: "お問い合わせ" },
];

export default function LegalFooter() {
  const legalConfig = getLegalConfig();

  return (
    <footer className="border-t border-[#d9ded3] bg-[#f7f8f5] px-4 py-8 text-[#1f2933] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-bold">{legalConfig.serviceName}</p>
          <p className="mt-1 text-xs leading-5 text-[#6b7280]">
            {legalConfig.tagline}
          </p>
        </div>
        <nav
          aria-label="法務・お問い合わせ"
          className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold text-[#2f5d50]"
        >
          {legalLinks.map((link) => (
            <Link key={link.href} href={link.href} className="hover:underline">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
