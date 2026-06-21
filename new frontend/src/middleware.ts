import { NextResponse, type NextRequest } from "next/server";

/**
 * Route protection + redirect logic.
 *
 * Auth is JWT in httpOnly cookies set by the Flask backend
 * (`access_token_cookie` / `refresh_token_cookie`). Middleware can't decode the
 * JWT, but it can check cookie *presence* to do a fast first-pass gate:
 *
 *   - Unauthenticated user hitting a protected route → /login?next=<path>
 *   - Authenticated user hitting an auth route (login/signup/…) → /stories
 *
 * The client-side AuthProvider + apiClient 401-refresh remain the source of
 * truth for actual validity (an expired-but-present cookie is handled there).
 */

const ACCESS_COOKIE = "access_token_cookie";
const REFRESH_COOKIE = "refresh_token_cookie";
// Matches next.config.js: basePath "/app" is only active in production builds.
const APP_BASE_PATH = process.env.NODE_ENV === "production" ? "/app" : "";

// Routes that make up the auth journey — reachable while logged OUT.
const AUTH_ROUTES = [
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
];

// Auth routes that are ALSO valid while logged IN (so we don't bounce an
// authenticated user away). Verifying email happens after signup, while logged in.
const AUTH_ROUTES_ALLOWED_WHEN_AUTHED = ["/verify-email"];

// Public, non-app routes (no gating either way).
const PUBLIC_PREFIXES = ["/_next", "/favicon", "/icon", "/apple", "/android", "/site.webmanifest", "/admin"];

function hasSession(req: NextRequest): boolean {
  return req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);
}

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

function withBasePath(path: string): string {
  if (path === APP_BASE_PATH || path.startsWith(`${APP_BASE_PATH}/`)) return path;
  if (path === "/") return APP_BASE_PATH;
  return `${APP_BASE_PATH}${path}`;
}

function stripBasePath(pathname: string): string {
  if (pathname === APP_BASE_PATH) return "/";
  if (pathname.startsWith(`${APP_BASE_PATH}/`)) {
    return pathname.slice(APP_BASE_PATH.length) || "/";
  }
  return pathname;
}

export function middleware(req: NextRequest) {
  const { search } = req.nextUrl;
  const pathname = stripBasePath(req.nextUrl.pathname);

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const authed = hasSession(req);
  const onAuthRoute = isAuthRoute(pathname);
  const allowedWhenAuthed = AUTH_ROUTES_ALLOWED_WHEN_AUTHED.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );

  // Logged-in users shouldn't see login/signup — send them to the app. But let
  // them reach /verify-email (they're authenticated when clicking the link).
  if (authed && onAuthRoute && !allowedWhenAuthed) {
    return NextResponse.redirect(new URL(withBasePath("/stories"), req.url));
  }

  // Logged-out users hitting a protected (non-auth) route → login with return path.
  if (!authed && !onAuthRoute) {
    const loginUrl = new URL(withBasePath("/login"), req.url);
    loginUrl.searchParams.set("next", withBasePath(pathname + search));
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!(?:app/)?_next/static|(?:app/)?_next/image|favicon.ico|(?:app/)?api/|.*\\.(?:png|jpg|jpeg|svg|ico|webmanifest)$).*)"],
};
