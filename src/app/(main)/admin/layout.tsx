import { notFound } from "next/navigation";
import { SectionNav } from "@/components/layout/section-nav";
import { getCurrentUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

/** Admin area — guarded by users.is_admin (AUTH-05). Non-admins get a 404, not a hint that it exists. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) notFound();

  return (
    <div className="container grid gap-8 py-8 md:grid-cols-[200px_1fr]">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">Admin</p>
        <SectionNav
          label="Admin"
          items={[
            { href: "/admin/verifications", label: "ID verifications" },
            { href: "/admin/disputes", label: "Disputes" },
          ]}
        />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
