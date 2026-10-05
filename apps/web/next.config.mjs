import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const here = path.dirname(fileURLToPath(import.meta.url));

try {
  process.loadEnvFile(path.resolve(here, "../../.env"));
} catch {}
// Next reads apps/web/.env*. On Vercel the file doesn't exist and dashboard variables are used.
// forceReload: Next has already called loadEnvConfig for apps/web, and without it the cached result
// is returned and the root file is never read.
nextEnv.loadEnvConfig(path.resolve(here, "../.."), process.env.NODE_ENV !== "production", undefined, true);

const useMocks = process.env.NEXT_PUBLIC_USE_MOCKS !== "false";
const apiUrl = (process.env.API_URL ?? "").replace(/\/+$/, "");

console.log(">>> NEXT CONFIG: useMocks =", useMocks, "apiUrl =", apiUrl);

if (!useMocks && !apiUrl) {
  throw new Error('API_URL must be set when NEXT_PUBLIC_USE_MOCKS="false" (see .env.example).');
}

/** Allow next/image to optimise gig images from Unsplash and the public bucket (NEXT_PUBLIC_ASSETS_URL). */
function remotePatterns() {
  const patterns = [
    { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
  ];
  const raw = process.env.NEXT_PUBLIC_ASSETS_URL;
  if (!raw) return patterns;
  try {
    const url = new URL(raw);
    patterns.push({ protocol: url.protocol.replace(":", ""), hostname: url.hostname, pathname: "/**" });
  } catch {}
  return patterns;
}

// Appendix E: security headers and Content-Security-Policy
const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: http://localhost:4000",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: cspHeader },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  images: { remotePatterns: remotePatterns() },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },

  /**
   * Real mode: the browser always calls same-origin /api/v1/*, and Vercel proxies it to the backend.
   * Cookies set by the backend therefore land on the frontend's domain (first-party), so auth works
   * across Vercel + Render/Railway without third-party cookies or CORS.
   * `beforeFiles` makes the proxy win over the demo route handlers in src/app/api.
   */
  async rewrites() {
    if (useMocks) return [];
    return {
      beforeFiles: [{ source: "/api/v1/:path*", destination: `${apiUrl}/api/v1/:path*` }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
