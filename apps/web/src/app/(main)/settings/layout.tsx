import { SectionNav } from "@/components/layout/section-nav";
import { requireUser } from "@/modules/auth/session";

export const dynamic = "force-dynamic";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireUser({ next: "/settings/security" });
  return (
    <div className="container grid gap-8 py-8 md:grid-cols-[200px_1fr]">
      <div className="space-y-3">
        <p className="text-sm font-semibold text-muted-foreground">Settings</p>
        <SectionNav
          label="Settings"
          items={[
            { href: "/settings/security", label: "Security" },
            { href: "/settings/notifications", label: "Notifications" },
          ]}
        />
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
