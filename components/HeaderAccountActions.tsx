import LogoutButton from "@/components/LogoutButton";

type HeaderAccountActionsProps = {
  organizationName: string;
  role: string;
};

export default function HeaderAccountActions({
  organizationName,
  role,
}: HeaderAccountActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="border border-[#d9ded3] bg-white px-4 py-3 text-right">
        <p className="text-sm font-bold">{organizationName}</p>
        <p className="mt-1 text-xs font-semibold text-[#5f6b5f]">{role}</p>
      </div>
      <LogoutButton />
    </div>
  );
}
