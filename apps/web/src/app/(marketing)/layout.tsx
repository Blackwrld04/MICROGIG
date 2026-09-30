import { MarketingHeader } from "@/components/landing/marketing-header";
import { SiteFooter } from "@/components/layout/site-footer";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-heading focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <MarketingHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
