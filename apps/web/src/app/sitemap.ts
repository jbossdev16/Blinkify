import type { MetadataRoute } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai";
const isAppDomain =
  typeof baseUrl === "string" && baseUrl.includes("app.blinkify.ai");

export default function sitemap(): MetadataRoute.Sitemap {
  if (isAppDomain) return [];
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/cookies`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/brand-assets`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];
}
