import Script from "next/script";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";

const SITE = "https://blinkify.ai";

export function AeoMarketingShell({
  children,
  breadcrumbName,
  pathSlug,
}: {
  children: React.ReactNode;
  breadcrumbName: string;
  pathSlug: string;
}) {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: SITE,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: breadcrumbName,
        item: `${SITE}${pathSlug}`,
      },
    ],
  };

  return (
    <>
      <Script
        id={`breadcrumb-${pathSlug.replace(/\//g, "-")}`}
        type="application/ld+json"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <LandingHeader />
      <div aria-hidden className="w-full shrink-0">
        <div className="h-px w-full" />
      </div>
      <main className="bg-[#ffffff] min-h-[60vh]">{children}</main>
      <div aria-hidden className="w-full shrink-0">
        <div className="h-px w-full" />
      </div>
      <LandingFooter />
    </>
  );
}
