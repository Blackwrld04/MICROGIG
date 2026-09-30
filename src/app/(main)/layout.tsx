import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { USE_MOCKS } from "@/mocks/config";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-heading focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      {USE_MOCKS ? (
        <p className="bg-heading px-4 py-1.5 text-center text-xs text-white">
          Demo mode: sample data. Actions work on this page but aren&apos;t saved.
        </p>
      ) : null}
      <SiteHeader />
      <main id="main" className="min-h-[calc(100vh-8rem)]">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
