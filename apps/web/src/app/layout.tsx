import type { Metadata } from "next";
import { headers } from "next/headers";
import { Inter } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "microgig", template: "%s · microgig" },
  description: "Fixed-price micro-gigs under $50, delivered in 24–48 hours with escrow protection.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading the request headers renders every page per request, so each page gets the CSP
  // nonce set by middleware (a pre-built static page would carry no nonce and be blocked).
  headers();
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
