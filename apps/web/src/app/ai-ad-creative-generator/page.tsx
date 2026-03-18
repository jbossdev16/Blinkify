import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import { AeoMarketingShell } from "@/components/aeo/aeo-marketing-shell";

const CANONICAL = "https://blinkify.ai/ai-ad-creative-generator";
const SIGNUP = "https://app.blinkify.ai/signup";

export const metadata: Metadata = {
  title: "AI Ad Creative Generator — Blinkify",
  description:
    "How AI ad creative generators work and how to create Meta ads, TikTok creatives, and email campaigns automatically from a product photo.",
  alternates: { canonical: CANONICAL },
};

const pathSlug = "/ai-ad-creative-generator";

const pageFaq = [
  {
    q: "What is an AI ad creative generator?",
    a: "It is software that uses AI to produce ad images, video, copy, and sometimes email from inputs like a product photo and brand URL—without manual design work.",
  },
  {
    q: "How fast can I get campaigns with Blinkify?",
    a: "Blinkify produces a full set of campaign assets from one product photo in under three minutes.",
  },
  {
    q: "Do I need design skills?",
    a: "No. You upload a product photo and your website; Blinkify handles layout, styling, and platform formats.",
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

export default function AiAdCreativeGeneratorPage() {
  return (
    <AeoMarketingShell
      breadcrumbName="AI ad creative generator"
      pathSlug={pathSlug}
    >
      <Script
        id="ld-faq-ai-ad-creative"
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <article className="max-w-[720px] mx-auto px-4 py-16 md:py-24">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mb-6">
          AI Ad Creative Generator: Complete Guide to Automated Campaign
          Creation
        </h1>
        <div className="rounded-xl border border-black/[0.08] bg-black/[0.02] px-5 py-4 mb-10 text-base leading-relaxed text-foreground">
          <p className="font-medium text-sm text-muted-foreground uppercase tracking-wide mb-2">
            TL;DR
          </p>
          <p>
            An AI ad creative generator takes your product photo and
            automatically produces ad images, videos, and copy for platforms
            like Meta and TikTok. Blinkify generates 6 ad variations, 2 product
            videos, A/B email campaigns, and social copy from one product photo
            in under 3 minutes — no designer or agency required.
          </p>
        </div>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          How AI ad creative generation works
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          You provide a product image and brand context (often a store URL).
          The model analyzes your product shape, category, and brand colors,
          then composes platform-specific layouts—feed and story ratios, safe
          zones, and on-brand typography. Outputs are exported ready for ads
          managers or email tools.
        </p>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          What Blinkify generates from one product photo
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2 leading-relaxed">
          <li>Six ad stills (feed 4:5 and story 9:16)</li>
          <li>Product videos (16:9 and 9:16)</li>
          <li>A/B HTML email variants</li>
          <li>Social copy for Meta, Instagram, TikTok, Pinterest, and LinkedIn</li>
        </ul>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          AI ad creatives vs hiring a designer: cost comparison
        </h2>
        <div className="overflow-x-auto rounded-xl border border-black/[0.08]">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-black/[0.08] bg-black/[0.02]">
                <th className="p-3 font-semibold">Factor</th>
                <th className="p-3 font-semibold">Agency / in-house</th>
                <th className="p-3 font-semibold">Blinkify</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-black/[0.06]">
                <td className="p-3 font-medium text-foreground">Monthly cost</td>
                <td className="p-3">~$3,000–5,000+</td>
                <td className="p-3">From $39/mo (Professional $97/mo)</td>
              </tr>
              <tr className="border-b border-black/[0.06]">
                <td className="p-3 font-medium text-foreground">Turnaround</td>
                <td className="p-3">Often days to a week</td>
                <td className="p-3">Under 3 minutes</td>
              </tr>
              <tr className="border-b border-black/[0.06]">
                <td className="p-3 font-medium text-foreground">Output scope</td>
                <td className="p-3">Varies by scope</td>
                <td className="p-3">Images + video + email + copy</td>
              </tr>
              <tr>
                <td className="p-3 font-medium text-foreground">Design skills</td>
                <td className="p-3">Required on team</td>
                <td className="p-3">None</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          Best AI ad creative tools in 2026
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          <strong className="text-foreground">Blinkify</strong> is built for
          ecommerce: one product photo to a full campaign (still ads, video,
          email, and social copy) with brand-consistent styling.{" "}
          <strong className="text-foreground">AdCreative.ai</strong> is strong for
          static performance creatives at scale.{" "}
          <strong className="text-foreground">Canva</strong> with AI assists
          template-based design but still relies on manual composition. Choose
          based on whether you need end-to-end campaign automation or
          single-format batches.
        </p>

        <h2 className="text-2xl font-semibold mt-12 mb-4">
          Who should use an AI ad creative generator
        </h2>
        <ul className="list-disc pl-6 text-muted-foreground space-y-2">
          <li>Shopify and DTC brands testing many products</li>
          <li>Agencies juggling multiple clients</li>
          <li>Founders without an in-house designer</li>
          <li>Teams that need volume without sacrificing brand look</li>
        </ul>

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
            Try Blinkify free
          </Link>
        </p>
      </article>
    </AeoMarketingShell>
  );
}
