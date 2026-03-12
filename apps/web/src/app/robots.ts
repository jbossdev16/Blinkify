import type { MetadataRoute } from "next";
import { headers } from "next/headers";

/** Use request host so robots.txt is correct per domain (blinkify.ai vs app.blinkify.ai) regardless of NEXT_PUBLIC_APP_URL. */
export const dynamic = "force-dynamic";

const APP_HOST = "app.blinkify.ai";
const MARKETING_HOST = "blinkify.ai";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get("host")?.replace(/:\d+$/, "") ?? MARKETING_HOST;
  const isAppDomain = host === APP_HOST;

  if (isAppDomain) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    };
  }

  const baseUrl = `https://${host}`;
  const canonicalHost = host === `www.${MARKETING_HOST}` ? MARKETING_HOST : host;

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/creative-studio",
          "/brand",
          "/asset-collection",
          "/billing",
          "/admin",
          "/settings",
          "/projects",
          "/signin",
          "/signup",
          "/reset-password",
          "/setup-plan",
          "/studio",
          "/dashboard",
          "/invitations",
          "/auth",
          "/checkout",
          "/workspaces",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: canonicalHost,
  };
}
