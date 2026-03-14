import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const MARKETING_HOST = "blinkify.ai";
const APP_HOST = "app.blinkify.ai";

/** Use HTTPS for production hosts to avoid redirect loops (Vercel proxy may send request as HTTP). */
function redirectOrigin(hostname: string): `https://${string}` | null {
  if (hostname === APP_HOST || hostname === MARKETING_HOST || hostname === `www.${MARKETING_HOST}`) {
    return hostname === MARKETING_HOST || hostname === `www.${MARKETING_HOST}`
      ? `https://${MARKETING_HOST}`
      : `https://${APP_HOST}`;
  }
  return null;
}

const MARKETING_ONLY_PATHS = new Set(["/brand-assets", "/waitlist"]);

const APP_ROUTE_PREFIXES = [
  "/signin",
  "/signup",
  "/reset-password",
  "/setup-plan",
  "/creative-studio",
  "/brand",
  "/asset-collection",
  "/billing",
  "/settings",
  "/studio",
  "/admin",
  "/projects",
  "/dashboard",
];

function isAppRoute(pathname: string) {
  return APP_ROUTE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function isApiProxyPath(pathname: string) {
  if (pathname === "/health" || pathname === "/me") return true;
  const prefixes = ["/auth", "/checkout", "/workspaces", "/invitations"];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return NextResponse.next();
  }
  if (isApiProxyPath(pathname)) {
    return NextResponse.next();
  }

  const hostname = request.headers.get("host")?.replace(/:\d+$/, "") || "";
  const isMarketing =
    hostname === MARKETING_HOST || hostname === `www.${MARKETING_HOST}`;
  const isApp = hostname === APP_HOST;

  if (isMarketing && isAppRoute(pathname)) {
    const url = new URL(
      pathname + request.nextUrl.search,
      `https://${APP_HOST}`
    );
    return NextResponse.redirect(url);
  }

  if (isApp) {
    if (pathname === "/") {
      const base = redirectOrigin(hostname) ?? request.url;
      return NextResponse.redirect(new URL("/creative-studio", base));
    }
    if (MARKETING_ONLY_PATHS.has(pathname)) {
      const url = new URL(pathname, `https://${MARKETING_HOST}`);
      return NextResponse.redirect(url);
    }
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      return NextResponse.next({ request });
    }

    let supabaseResponse = NextResponse.next({ request });

    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              options as Parameters<typeof supabaseResponse.cookies.set>[2]
            )
          );
        },
      },
    });

    let user: { id: string } | null = null;
    const getUserResult = await supabase.auth.getUser().catch(() => ({ data: { user: null }, error: null }));
    user = getUserResult.data?.user ?? null;

    const protectedPaths = [
      "/creative-studio",
      "/brand",
      "/asset-collection",
      "/billing",
      "/settings",
      "/admin",
      "/projects",
      "/studio",
    ];
    const isProtected = protectedPaths.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );

    if (!user && isProtected) {
      const base = redirectOrigin(hostname);
      const redirectUrl = base ? new URL("/signin", base) : request.nextUrl.clone();
      redirectUrl.pathname = "/signin";
      redirectUrl.searchParams.set("returnTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    return supabaseResponse;
  } catch {
    return NextResponse.next({ request });
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4|webm)$).*)",
  ],
};
