"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

const companyLogos = [
  { name: "NVIDIA", src: "/NVIDIA/NVIDIA_Logo_0.svg" },
  { name: "Microsoft", src: "/Microsoft/Microsoft_Logo_0.svg" },
  { name: "Amazon", src: "/Amazon/Amazon_Logo_0.svg" },
  { name: "Netflix", src: "/Netflix/Netflix_Logo_0.svg" },
  { name: "Shopify", src: "/Shopify.com/Shopify.com_Logo_0.svg" },
  { name: "Google", src: "/Google/Google_Logo_0.svg" },
  { name: "TikTok", src: "/TikTok/TikTok_Logo_0.svg" },
];

export function CompaniesMarqueeSection() {
  const [hoveredCompany, setHoveredCompany] = useState<string | null>(null);
  return (
    <section className="py-0 bg-[#ffffff] p-1">
      <div className="max-w-[1200px] mx-auto w-full">
        <div className="w-full m-0">
          <div className="py-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center mb-2">
              LEADING COMPANIES USE AI FOR CREATIVES
            </p>
            <div
              className="relative overflow-hidden h-[72px] [mask-image:linear-gradient(to_right,transparent_0,black_60px,black_calc(100%-60px),transparent_100%)] [-webkit-mask-image:linear-gradient(to_right,transparent_0,black_60px,black_calc(100%-60px),transparent_100%)]"
            >
              <div className="flex w-max animate-marquee items-center h-full">
                {companyLogos.map((company) => (
                  <div
                    key={company.name}
                    className="shrink-0 w-[120px] h-6 flex items-center justify-center mx-3"
                    onMouseEnter={() => setHoveredCompany(company.name)}
                    onMouseLeave={() => setHoveredCompany(null)}
                  >
                    <Image
                      src={company.src}
                      alt={company.name}
                      width={120}
                      height={24}
                      className={cn(
                        "max-h-full max-w-full w-auto h-auto object-contain object-center transition-all duration-300",
                        hoveredCompany !== null &&
                          hoveredCompany !== company.name &&
                          "opacity-40 grayscale"
                      )}
                    />
                  </div>
                ))}
                {companyLogos.map((company) => (
                  <div
                    key={`${company.name}-dup`}
                    className="shrink-0 w-[120px] h-6 flex items-center justify-center mx-3"
                    onMouseEnter={() => setHoveredCompany(company.name)}
                    onMouseLeave={() => setHoveredCompany(null)}
                  >
                    <Image
                      src={company.src}
                      alt={company.name}
                      width={120}
                      height={24}
                      className={cn(
                        "max-h-full max-w-full w-auto h-auto object-contain object-center transition-all duration-300",
                        hoveredCompany !== null &&
                          hoveredCompany !== company.name &&
                          "opacity-40 grayscale"
                      )}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
