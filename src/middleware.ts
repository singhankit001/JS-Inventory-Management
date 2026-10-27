import { NextResponse, type NextRequest } from "next/server";

// Cheap edge gate: no cookie → login. Signature, expiry and permissions are verified server-side
// in requireSession()/requirePermission(); this middleware is not the security boundary.
export function middleware(req: NextRequest) {
  if (!req.cookies.has("jis_session")) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!login|_next|favicon.ico|icon.svg).*)"] };
