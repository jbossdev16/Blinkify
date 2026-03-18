import type { Metadata } from "next";
import Link from "next/link";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";

export const metadata: Metadata = {
  title:
    "Blinkify Features — AI Campaign Generation, Meta Ads, TikTok Creatives, Email Marketing",
  description:
    "AI campaign generation: Meta feed and story ads, TikTok creatives, product video, email marketing, and social copy from one product photo.",
  alternates: { canonical: "https://blinkify.ai/features" },
};

export default function FeaturesPage() {
  return (
    <>
      <LandingHeader />
      <main className="bg-[#ffffff] max-w-[720px] mx-auto px-4 py-16 md:py-24">
        <h1 className="text-3xl font-semibold tracking-tight mb-4">
          Features
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Blinkify turns one product photo into a full marketing campaign—see the
          full breakdown on the homepage.
        </p>
        <Link
          href="/#value"
          className="text-foreground font-medium underline underline-offset-4 hover:opacity-80"
        >
          View features on homepage →
        </Link>
      </main>
      <LandingFooter />
    </>
  );
}
