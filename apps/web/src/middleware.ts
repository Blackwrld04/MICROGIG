import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs on every page request and does two things:
 *
 * 1. Content-Security-Policy with a per-request nonce (Appendix E, issue #12). Production allows
 *    only scripts carrying this request's nonce ('strict-dynamic'), so no 'unsafe-inline'.
 *    Next.js reads the nonce from the request's CSP header and adds it to its own scripts.
 *
 * 2. Sign-in gate for signed-in areas: signed-out visitors get a real 307 to /login before any
 *    page streams. It only checks that a session cookie exists; pages still verify the session
 *    and the account type (client XOR freelancer) via requireUser().
 */

const SESSION_COOKIES = [
  "mg_demo_session", // demo mode
  "sid", // backend session (opaque session id, apps/api/src/plugins/authenticate.ts)
  "__Host-sid",
];

const PROTECTED_PREFIXES = ["/orders", "/inbox", "/wallet", "/seller", "/gigs/new", "/settings", "/admin"];

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function contentSecurityPolicy(nonce: string) {
  const dev = process.env.NODE_ENV !== "production";
  return [
    "default-src 'self'",
    // Dev needs eval for React Fast Refresh; production allows only nonce'd scripts.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    // Inline styles stay allowed: next/font and Radix set style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    // https: covers direct uploads to the S3/R2 presigned URL.
    `connect-src 'self' https:${dev ? " ws: http://localhost:4000" : ""}`,
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; ");
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (isProtected(pathname) && !SESSION_COOKIES.some((name) => request.cookies.has(name))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = contentSecurityPolicy(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Every page, but not API routes, Next's static assets, or files in /public.
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|images/|icon.svg|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
