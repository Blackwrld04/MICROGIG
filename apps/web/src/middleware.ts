import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate for signed-in areas: redirect signed-out visitors to /login with a real 307
 * before any page streams. Only checks that a session cookie exists; pages still verify
 * the session and the account type (client XOR freelancer) via requireUser().
 * TODO(auth owner): verify the access-token JWT here (edge-safe, e.g. `jose`), not just its presence.
 */
const SESSION_COOKIES = [
  "mg_demo_session", // demo mode
  "sid", // real backend (server/): opaque session id, proxied through /api/v1 so it lands on this domain
  "__Host-access_token", // real backend (§13.1), proxied through /api/v1 so it lands on this domain
  "__Host-refresh_token", // expired access token + valid refresh: let the page trigger a refresh
];

export function middleware(request: NextRequest) {
  if (SESSION_COOKIES.some((name) => request.cookies.has(name))) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/orders/:path*", "/inbox/:path*", "/wallet/:path*", "/seller/:path*", "/gigs/new", "/settings/:path*", "/admin/:path*"],
};
