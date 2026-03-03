import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai";

export const metadata: Metadata = {
  title: "Join the Waitlist — Blinkify",
  description:
    "Get early access to Blinkify. AI-powered product images and ad creatives for eCommerce, small businesses, and agencies. Join the waitlist.",
  alternates: { canonical: `${baseUrl}/waitlist` },
  openGraph: {
    title: "Join the Waitlist — Blinkify",
    description:
      "Get early access to Blinkify. AI product images and ad creatives in 60 seconds.",
    url: `${baseUrl}/waitlist`,
  },
};

export default function WaitlistLayout({
  children,
}: { children: React.ReactNode }) {
  return children;
}
