import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge gate for signed-in areas: redirect signed-out visitors to /login with a real 307
 * before any page streams. Only checks that a session cookie exists; pages still verify
 * the session and the account type (client XOR freelancer) via requireUser().
 * TODO(auth owner): switch the cookie name to the §13.1 access-token cookie and verify its JWT here.
 */
const SESSION_COOKIE = "mg_demo_session";

export function middleware(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/orders/:path*", "/inbox/:path*", "/wallet/:path*", "/seller/:path*", "/gigs/new", "/settings/:path*", "/admin/:path*"],
};
