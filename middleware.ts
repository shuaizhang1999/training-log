import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isValidSession } from "@/lib/auth";

/**
 * Gate everything behind the shared password: pages redirect to /login,
 * API routes answer 401 JSON (the client outbox treats that as "go log in
 * again", not as a lost row).
 */
export async function middleware(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE)?.value;
  if (await isValidSession(cookie, process.env.APP_PASSWORD)) {
    return NextResponse.next();
  }

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except: login page + auth endpoint, Next internals, and the
  // files a PWA must fetch before login (manifest, service worker, icons).
  matcher: [
    "/((?!login|api/auth|_next/|icons/|manifest\\.webmanifest|sw\\.js|favicon\\.ico).*)",
  ],
};
