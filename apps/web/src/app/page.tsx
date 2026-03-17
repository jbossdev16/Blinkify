import dynamic from "next/dynamic";
import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";
import { HeroSection } from "@/components/landing/hero-section";
import { CompaniesMarqueeSection } from "@/components/landing/companies-marquee";

const LandingBelowFold = dynamic(
  () => import("@/components/landing/landing-below-fold"),
  {
    loading: () => <div className="min-h-[50vh] bg-[#ffffff]" aria-hidden />,
  }
);

export default function Home() {
  return (
    <>
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
