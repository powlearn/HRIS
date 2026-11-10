import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const { auth } = NextAuth(authConfig);

const PUBLIC_PAGES = ["/login", "/forgot-password", "/reset-password", "/verify"];
const PUBLIC_API = ["/api/auth", "/api/health"];

function isPublic(pathname: string) {
  return (
    PUBLIC_PAGES.some((path) => pathname === path || pathname.startsWith(`${path}/`)) ||
    PUBLIC_API.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Throttle credential submissions and public auth endpoints by IP.
  if (pathname.startsWith("/api/auth") && req.method === "POST") {
    const result = rateLimit(`auth:${clientIp(req.headers)}`, 10, 60_000);
    if (!result.success) {
      return NextResponse.json(
        { error: { message: "Terlalu banyak percobaan masuk. Coba lagi beberapa saat lagi.", code: "RATE_LIMITED" } },
        { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
      );
    }
  }

  const isLoggedIn = Boolean(req.auth?.user?.id);

  // NOTE: a JWT can outlive its database record (seeded/reset data, revoked
  // session). Server components validate the session against the database and
  // redirect to /login; keeping /login reachable avoids a redirect loop.
  if (isPublic(pathname)) return NextResponse.next();

  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { message: "Sesi tidak valid. Silakan masuk kembali.", code: "UNAUTHORIZED" } },
        { status: 401 },
      );
    }
    const loginUrl = new URL("/login", req.nextUrl);
    if (pathname !== "/") loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|css|js|woff2?)$).*)"],
};
