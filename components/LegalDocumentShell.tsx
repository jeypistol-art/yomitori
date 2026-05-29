import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type LegalDocumentShellProps = {
  title: string;
  lead: string;
  lastUpdated: string;
  children: React.ReactNode;
};

export default function LegalDocumentShell({
  title,
  lead,
  lastUpdated,
  children,
}: LegalDocumentShellProps) {
  return (
    <main className="min-h-screen bg-[#f7f8f5] px-4 py-6 text-[#1f2933] sm:px-6 lg:px-8">
      <article className="mx-auto max-w-4xl border border-[#d9ded3] bg-white">
        <header className="border-b border-[#e5e9df] px-5 py-5">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-[#2f5d50]"
          >
            <ChevronLeft className="h-4 w-4" />
            トップ
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#2f5d50]">
            Legal
          </p>
          <h1 className="mt-2 text-3xl font-bold">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-[#4b5563]">{lead}</p>
          <p className="mt-4 text-xs font-semibold text-[#6b7280]">
            最終更新日: {lastUpdated}
          </p>
        </header>
        <div className="space-y-8 px-5 py-6">{children}</div>
      </article>
    </main>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-[#4b5563]">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-[#2f5d50]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
