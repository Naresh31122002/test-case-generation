import { NextRequest, NextResponse } from "next/server"

const PUBLIC_PATHS = ["/login", "/signup"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow public routes, Next.js internals, and auth API endpoints
  if (
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next()
  }

  // Cookie presence check — Flask verifies the token cryptographically on every API call
  const accessToken = request.cookies.get("access_token_cookie")

  if (!accessToken) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("next", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
