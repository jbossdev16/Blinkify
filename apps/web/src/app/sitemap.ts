import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const APP_HOST = "app.blinkify.ai";
const MARKETING_HOST = "blinkify.ai";

/** Use request host so sitemap is correct per domain regardless of NEXT_PUBLIC_APP_URL. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = await headers();
  const host = headersList.get("host")?.replace(/:\d+$/, "") ?? MARKETING_HOST;
  if (host === APP_HOST) return [];

  const baseUrl = `https://${host}`;
  const aeoMonthly = { changeFrequency: "monthly" as const, priority: 0.8 };
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    {
      url: `${baseUrl}/ai-ad-creative-generator`,
      lastModified: new Date(),
      ...aeoMonthly,
    },
    {
      url: `${baseUrl}/adcreative-ai-alternative`,
      lastModified: new Date(),
      ...aeoMonthly,
    },
    {
      url: `${baseUrl}/ai-marketing-tools-shopify`,
      lastModified: new Date(),
      ...aeoMonthly,
    },
    {
      url: `${baseUrl}/product-photo-to-ad`,
      lastModified: new Date(),
      ...aeoMonthly,
    },
    {
      url: `${baseUrl}/features`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.75,
    },
    { url: `${baseUrl}/waitlist`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/cookies`, lastModified: new Date(), changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/brand-assets`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.4 },
  ];
}
