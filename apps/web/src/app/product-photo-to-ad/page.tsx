import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { AeoMarketingShell } from "@/components/aeo/aeo-marketing-shell";

const CANONICAL = "https://blinkify.ai/product-photo-to-ad";
const SIGNUP = "https://app.blinkify.ai/signup";

export const metadata: Metadata = {
  title: "Product Photo to Ad Campaign — Blinkify AI Generator",
  description:
    "How to turn a product photo into a complete Meta and TikTok ad campaign using AI. Step-by-step guide with Blinkify.",
  alternates: { canonical: CANONICAL },
};

const pageFaq = [
  {
    q: "What image quality do I need?",
    a: "Use a clear, well-lit product shot on a simple background when possible; avoid heavy compression.",
  },
  {
    q: "Does Blinkify use my exact product in the ads?",
    a: "Yes—your upload is used as the visual reference so compositions stay on-brand and product-accurate.",
  },
  {
    q: "How long until I can publish?",
    a: "Generation completes in under three minutes; then you download and publish to your ad accounts.",
  },
];

const faqLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: pageFaq.map((item) => ({
    "@type": "Question",
    name: item.q,
    acceptedAnswer: { "@type": "Answer", text: item.a },
  })),
};

export default function ProductPhotoToAdPage() {
  return (
    <AeoMarketingShell
      breadcrumbName="Product photo to ad"
      pathSlug="/product-photo-to-ad"
    >
      <Script
        id="ld-faq-product-photo"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <article className="max-w-[720px] mx-auto px-4 py-16 md:py-24">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-6">
          Product Photo to Ad: How to Turn One Image Into a Complete Campaign
        </h1>
        <div className="rounded-xl border border-black/[0.08] bg-black/[0.02] px-5 py-4 mb-10 text-base leading-relaxed">
          <p className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">
            TL;DR
          </p>
          <p>
            You can turn a product photo into a complete Meta and TikTok ad
            campaign using Blinkify. Upload your product photo, enter your
            website URL, and the AI generates 6 ad variations, 2 product videos,
            email marketing, and social copy — all styled to your brand — in
            under 3 minutes.
          </p>
        </div>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          What you need to create ads from a product photo
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>One clear product image (PNG or JPG)</li>
          <li>Your brand website URL for colors and tone</li>
          <li>A Blinkify account (free trial available)</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          Step-by-step: product photo to live ad campaign
        </h2>
        <ol className="list-decimal pl-6 text-muted-foreground space-y-4 leading-relaxed">
          <li>
            <strong className="text-foreground">Upload</strong> your product
            photo in Blinkify.
          </li>
          <li>
            <strong className="text-foreground">Apply brand</strong> — enter
            your site URL so the AI extracts palette and style.
          </li>
          <li>
            <strong className="text-foreground">Generate</strong> — run the
            campaign job; wait under 3 minutes.
          </li>
          <li>
            <strong className="text-foreground">Download</strong> stills, video,
            email HTML, and copy.
          </li>
          <li>
            <strong className="text-foreground">Publish</strong> in Meta Ads
            Manager, TikTok Ads, and your ESP.
          </li>
        </ol>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          What Blinkify generates from your product photo
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          Six ad variations (feed and story), two video aspect ratios, paired
          email creatives, and platform-specific social captions—aligned to
          your brand system.
        </p>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          Product photo tips for best AI ad results
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>
            <strong className="text-foreground">Lighting:</strong> even, soft
            light reduces harsh shadows the model must fix.
          </li>
          <li>
            <strong className="text-foreground">Background:</strong> neutral or
            clean backdrops help the product read clearly in new compositions.
          </li>
          <li>
            <strong className="text-foreground">Angle:</strong> a three-quarter
            or straight-on hero shot usually generalizes better than extreme
            angles.
          </li>
        </ul>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          How long does it take
        </h2>
        <p className="text-muted-foreground leading-relaxed">
          End-to-end generation is under three minutes for a standard campaign
          run, before you spend time in ad platforms uploading and targeting.
        </p>

        <h2 className="text-2xl font-semibold mt-12 mb-8">FAQ</h2>
        <dl className="space-y-6">
          {pageFaq.map((item) => (
            <div key={item.q}>
              <dt className="font-semibold text-foreground mb-2">{item.q}</dt>
              <dd className="text-muted-foreground leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-14 text-center">
          <Link
            href={SIGNUP}
            className="inline-flex items-center justify-center rounded-xl bg-foreground text-background px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            Start with your product photo
          </Link>
        </p>
      </article>
    </AeoMarketingShell>
  );
}
