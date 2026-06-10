import { NextRequest, NextResponse } from "next/server";

// Lightweight page gate: redirect to /login when no session cookie exists.
// Actual session validation happens server-side in requireUser()/API routes —
// this just avoids rendering app pages for obviously anonymous visitors.
const PUBLIC_PREFIXES = ["/login", "/signup", "/invite", "/api/auth"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();
  if (pathname.startsWith("/api")) return NextResponse.next(); // APIs return 401 themselves
  if (!req.cookies.get("cm_session")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
