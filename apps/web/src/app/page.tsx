import dynamic from "next/dynamic";
import type { Metadata } from "next";
import Script from "next/script";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { CompaniesMarqueeSection } from "@/components/landing/companies-marquee";
import { HOMEPAGE_FAQ_FOR_SCHEMA } from "@/lib/homepage-faq-schema";

const LandingBelowFold = dynamic(
  () => import("@/components/landing/landing-below-fold"),
  {
    loading: () => <div className="min-h-[50vh] bg-[#ffffff]" aria-hidden />,
  }
);

const CANONICAL = "https://blinkify.ai";

export const metadata: Metadata = {
  title:
    "Blinkify — AI Ad Creative Generator | Product Photo to Campaign in 3 Minutes",
  description:
    "Turn one product photo into a complete marketing campaign in 3 minutes. AI-generated Meta ads, TikTok creatives, product videos, and email marketing — all brand-consistent. Free plan to start.",
  keywords: [
    "AI ad creative generator",
    "AI marketing tool for ecommerce",
    "Meta ads generator",
    "TikTok ad creator AI",
    "product photo to ad campaign",
    "AdCreative.ai alternative",
    "AI marketing for Shopify",
    "ecommerce ad creative automation",
    "AI campaign generator",
    "no designer ad creation",
  ],
  openGraph: {
    title: "Blinkify — AI Ad Creative Generator",
    description:
      "One product photo. Full campaign in 3 minutes. Meta ads, TikTok, email, and social copy — all AI generated.",
    url: CANONICAL,
    siteName: "Blinkify",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blinkify — AI Ad Creative Generator",
    description: "One product photo. Full campaign in 3 minutes.",
  },
  alternates: {
    canonical: CANONICAL,
  },
  other: {
    "application-name": "Blinkify",
  },
};

const softwareApplicationLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Blinkify",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "MarketingApplication",
  operatingSystem: "Web",
  url: CANONICAL,
  description:
    "AI-powered ad creative generation platform that turns one product photo into a complete marketing campaign including Meta ads, TikTok creatives, product videos, and email marketing in under 3 minutes.",
  screenshot: "https://blinkify.ai/og-image.png",
  featureList: [
    "AI ad creative generation",
    "Meta feed ad creation",
    "TikTok story ad creation",
    "Product video generation",
    "AI email marketing",
    "Brand-consistent campaigns",
    "Automatic brand analysis",
    "Social copy generation",
    "6 creative variations per campaign",
  ],
  offers: [
    {
      "@type": "Offer",
      name: "Standard",
      price: "39",
      priceCurrency: "USD",
      billingIncrement: "P1M",
    },
    {
      "@type": "Offer",
      name: "Professional",
      price: "97",
      priceCurrency: "USD",
      billingIncrement: "P1M",
    },
    {
      "@type": "Offer",
      name: "Agency",
      price: "297",
      priceCurrency: "USD",
      billingIncrement: "P1M",
    },
  ],
};

const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Blinkify",
  url: CANONICAL,
  logo: "https://blinkify.ai/logo.png",
  description:
    "AI marketing platform for ecommerce brands. Generate complete ad campaigns from a single product photo.",
  foundingDate: "2026",
  sameAs: [
    "https://x.com/blinkifyai",
    "https://www.linkedin.com/company/blinkifyai",
  ],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    url: CANONICAL,
  },
};

const faqPageLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: HOMEPAGE_FAQ_FOR_SCHEMA.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.a,
    },
  })),
};

export default function Home() {
  return (
    <>
      <Script
        id="ld-software-application"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(softwareApplicationLd),
        }}
      />
      <Script
        id="ld-organization"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationLd) }}
      />
      <Script
        id="ld-faq-page"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqPageLd) }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1] hidden md:flex justify-center"
      >
        <div className="w-full max-w-[1200px] mx-auto h-full flex">
          <div className="flex-1" />
        </div>
      </div>
      <LandingHeader />
      <div aria-hidden className="w-full shrink-0">
        <div className="h-px w-full" />
      </div>
      <main className="bg-[#ffffff]">
        <div className="min-h-0 md:min-h-[calc(100svh-68px)] flex flex-col">
          <div className="flex-none md:flex-1 flex flex-col min-h-0">
            <HeroSection />
          </div>
          <div className="hidden md:block">
            <CompaniesMarqueeSection />
          </div>
        </div>
        <div className="md:hidden">
          <CompaniesMarqueeSection />
        </div>
        <div aria-hidden className="hidden md:block max-w-[1200px] mx-auto w-full">
          <div className="h-px" />
        </div>
        <LandingBelowFold />
      </main>
      <div aria-hidden className="w-full shrink-0">
        <div className="h-px w-full" />
      </div>
      <LandingFooter />
    </>
  );
}
