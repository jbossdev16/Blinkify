import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";
import { renderContentWithBold } from "@/lib/render-content-with-bold";

export const metadata = {
  title: "Cookie Policy — Blinkify",
  description: "Cookie Policy for Blinkify (RollCall LLC). How we use cookies and similar technologies.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai"}/cookies`,
  },
};

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-body-md text-muted-foreground mb-4">{children}</p>;
}

function Ul({ children }: { children: React.ReactNode }) {
  return (
    <ul className="list-disc pl-6 text-body-md text-muted-foreground mb-4 space-y-1">
      {children}
    </ul>
  );
}

function ContentGuideLines() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[1] hidden md:flex justify-center"
    >
      <div className="w-full max-w-[1200px] mx-auto h-full flex">
        <div className="flex-1" />
      </div>
    </div>
  );
}

function SectionDivider() {
  return (
    <div aria-hidden className="hidden md:block w-full">
      <div className="h-px" />
    </div>
  );
}

export default function CookiePolicyPage() {
  return (
    <>
      <ContentGuideLines />
      <LandingHeader />
      <main className="bg-[#ffffff]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-h2 text-foreground mb-2">
          Cookie Policy — Blinkify (RollCall LLC)
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-body-sm text-muted-foreground mb-10">
          <span>{renderContentWithBold("**Effective Date:** February 19, 2026")}</span>
          <span>{renderContentWithBold("**Last Updated:** February 19, 2026")}</span>
        </div>

        <P>
          This Cookie Policy explains how {renderContentWithBold("**RollCall LLC**")} (&quot;RollCall,&quot; &quot;we,&quot; &quot;us&quot;) uses cookies and similar technologies on {renderContentWithBold("**Blinkify**")}, including:
        </P>
        <Ul>
          <li>{renderContentWithBold("**blinkify.ai**")}</li>
          <li>{renderContentWithBold("**app.blinkify.ai**")}</li>
          <li>{renderContentWithBold("**api.blinkify.ai**")}</li>
          <li>{renderContentWithBold("**mail.blinkify.ai**")}</li>
        </Ul>
        <P>
          This Cookie Policy should be read together with our{" "}
          <a href="/privacy" className="text-foreground underline hover:no-underline">
            Privacy Policy
          </a>
          .
        </P>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">1) What Are Cookies?</h2>
          <P>
            Cookies are small text files placed on your device when you visit a website. They help websites work properly, remember preferences, and understand usage. We also use similar technologies such as pixels and local storage (together referred to as &quot;cookies&quot; in this policy).
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">2) Why We Use Cookies</h2>
          <P>We use cookies for the following purposes:</P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">A) Strictly Necessary Cookies</h3>
          <P>
            These are required for the Service to function and cannot be switched off in our systems. They are used for:
          </P>
          <Ul>
            <li>Authentication and session management (keeping you logged in)</li>
            <li>Security (fraud prevention, abuse protection)</li>
            <li>Basic site/app functionality (routing, load balancing)</li>
          </Ul>

          <h3 className="text-h5 text-foreground mt-6 mb-2">B) Analytics Cookies</h3>
          <P>
            These help us understand how users interact with Blinkify so we can improve performance and user experience.
          </P>
          <P>
            {renderContentWithBold("**Tool we use:**")} {renderContentWithBold("**Google Analytics**")}
          </P>
          <P>
            Google Analytics may set cookies and collect information such as pages visited, actions taken, approximate location, device/browser information, and identifiers.
          </P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">C) Advertising / Measurement Cookies</h3>
          <P>
            These help us measure the effectiveness of advertising and understand conversions (e.g., when someone visits after seeing an ad).
          </P>
          <P>
            {renderContentWithBold("**Tool we use:**")} {renderContentWithBold("**Meta Pixel**")}
          </P>
          <P>
            Meta Pixel may use cookies or similar technologies to measure ad performance and may associate events with Meta accounts depending on your settings and Meta&apos;s policies.
          </P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">D) Functional Cookies (if/when enabled)</h3>
          <P>
            These remember your preferences (e.g., settings) to provide a more personalized experience. If we use these, they will be described in our cookie settings/consent tool.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">3) Cookies We Use (Typical Categories)</h2>
          <P>
            Because cookies can change over time (e.g., when providers update their tools), we describe them by category rather than listing every cookie name.
          </P>
          <Ul>
            <li>{renderContentWithBold("**Necessary:**")} login/session, security</li>
            <li>{renderContentWithBold("**Analytics:**")} Google Analytics cookies/identifiers</li>
            <li>{renderContentWithBold("**Advertising/Measurement:**")} Meta Pixel cookies/identifiers</li>
          </Ul>
          <P>
            If you use a cookie banner/consent tool, it should display the specific categories you can accept or reject.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">4) Your Choices</h2>

          <h3 className="text-h5 text-foreground mt-6 mb-2">A) Cookie Consent (EEA/UK and similar regions)</h3>
          <P>
            Where required by law, we will ask for your consent before placing {renderContentWithBold("**non-essential**")} cookies (e.g., analytics and advertising cookies). You can change your choices at any time via the cookie settings link/banner (if available).
          </P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">B) Browser Controls</h3>
          <P>Most browsers allow you to:</P>
          <Ul>
            <li>See what cookies you have and delete them</li>
            <li>Block third-party cookies</li>
            <li>Block all cookies</li>
          </Ul>
          <P>
            If you block necessary cookies, Blinkify may not function correctly (including login).
          </P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">C) Google Analytics Opt-Out</h3>
          <P>You can limit Google Analytics data collection via:</P>
          <Ul>
            <li>Browser cookie settings</li>
            <li>Google&apos;s analytics opt-out mechanisms (where available)</li>
          </Ul>

          <h3 className="text-h5 text-foreground mt-6 mb-2">D) Meta / Ad Preferences</h3>
          <P>
            You can manage how Meta shows you ads through your Meta account ad settings and your browser/device privacy settings.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">5) Do Not Track</h2>
          <P>
            Some browsers offer a &quot;Do Not Track&quot; (DNT) setting. There is no consistent industry standard for responding to DNT signals, so our sites may not respond to them uniformly.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">6) How Long Cookies Last</h2>
          <P>Cookies may be:</P>
          <Ul>
            <li>{renderContentWithBold("**Session cookies**")} (deleted when you close your browser), or</li>
            <li>{renderContentWithBold("**Persistent cookies**")} (remain until they expire or you delete them)</li>
          </Ul>
          <P>Retention depends on the cookie type and provider settings.</P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">7) Updates to This Cookie Policy</h2>
          <P>
            We may update this Cookie Policy from time to time. The &quot;Last Updated&quot; date will reflect the most recent changes.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">8) Contact</h2>
          <P>{renderContentWithBold("**RollCall LLC**")}</P>
          <P>1738 Reynolds St, Knoxville, TN 37921, United States</P>
          <P>
            {renderContentWithBold("**Email:**")}{" "}
            <a href="mailto:support@blinkify.ai" className="text-foreground underline hover:no-underline">
              support@blinkify.ai
            </a>
          </P>
        </section>
        </div>
      </main>
      <SectionDivider />
      <LandingFooter />
    </>
  );
}
