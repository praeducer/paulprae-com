import { NextResponse, type NextRequest } from "next/server";

// ─── Allowed Origins ─────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = new Set([
  "https://paulprae.com",
  "https://www.paulprae.com",
  "https://paulprae-com-one.vercel.app",
]);

/** In development, allow localhost origins. */
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // Same-origin requests (no Origin header)
  if (ALLOWED_ORIGINS.has(origin)) return true;
  // Allow Vercel preview deployments
  if (origin.endsWith(".vercel.app") && origin.includes("paulprae")) return true;
  // Allow localhost in development
  if (
    process.env.NODE_ENV === "development" &&
    (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:"))
  ) {
    return true;
  }
  return false;
}

// ─── Proxy ──────────────────────────────────────────────────────────────────

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin");

  // ── API route protection ──────────────────────────────────────────────────
  if (pathname.startsWith("/api/")) {
    // Block cross-origin requests from unauthorized domains
    if (origin && !isAllowedOrigin(origin)) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    // Handle CORS preflight (OPTIONS)
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin && isAllowedOrigin(origin) ? origin : "",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // Only allow POST to API routes
    if (request.method !== "POST") {
      return new NextResponse("Method Not Allowed", { status: 405 });
    }
  }

  const response = NextResponse.next();

  // ── Security headers (supplement vercel.json — works in dev too) ────────
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // Set CORS header for API responses
  if (pathname.startsWith("/api/") && origin && isAllowedOrigin(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }

  return response;
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon).*)"],
};
