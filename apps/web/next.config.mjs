import path from "node:path";
import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";

const here = path.dirname(fileURLToPath(import.meta.url));

// All credentials live in ONE .env at the repo root (see /.env.example). Locally, load it before
try {
  process.loadEnvFile(path.resolve(here, "../../.env"));
} catch {}
nextEnv.loadEnvConfig(path.resolve(here, "../.."), process.env.NODE_ENV !== "production");

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

// Appendix E: security headers. (A CSP needs per-request nonces with Next inline scripts; add with the backend.)
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
