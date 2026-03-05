import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai";
const isAppDomain =
  typeof baseUrl === "string" && baseUrl.includes("app.blinkify.ai");

export default function robots(): MetadataRoute.Robots {
  if (isAppDomain) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    };
  }
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/creative-studio", "/brand", "/billing", "/asset-collection", "/admin", "/settings", "/projects", "/signin", "/signup", "/reset-password"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
