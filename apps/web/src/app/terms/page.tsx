import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";
import { renderContentWithBold } from "@/lib/render-content-with-bold";

export const metadata = {
  title: "Terms of Service — Blinkify",
  description: "Terms of Service for Blinkify (RollCall LLC). Rules and conditions for using the Service.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai"}/terms`,
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

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingHeader />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-[100px] pb-10 sm:pb-14">
        <h1 className="text-h2 text-foreground mb-2">
          Terms of Service — Blinkify (RollCall LLC)
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-body-sm text-muted-foreground mb-10">
          <span>{renderContentWithBold("**Effective Date:** February 19, 2026")}</span>
          <span>{renderContentWithBold("**Last Updated:** February 19, 2026")}</span>
        </div>

        <P>
          These Terms of Service ({renderContentWithBold("**Terms**")}) govern your use of{" "}
          {renderContentWithBold("**Blinkify**")} (the {renderContentWithBold("**Service**")}) operated by{" "}
          {renderContentWithBold("**RollCall LLC**")} ({renderContentWithBold("\"**RollCall**,\" \"**we**,\" \"**us**,\" or \"**our**\"")}). By accessing or using the Service, you agree to these Terms.
        </P>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">1) Acceptance</h2>
          <P>
            By creating an account or using the Service (including blinkify.ai, app.blinkify.ai, api.blinkify.ai, and related properties), you agree to these Terms and our Privacy Policy. If you do not agree, do not use the Service.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">2) Eligibility</h2>
          <P>
            You must be at least 13 years old and able to form a binding contract to use the Service. If you use the Service on behalf of an organization, you represent that you have authority to bind that organization to these Terms.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">3) Account and Security</h2>
          <P>
            You are responsible for maintaining the confidentiality of your account credentials and for all activity under your account. Notify us promptly at{" "}
            <a href="mailto:support@blinkify.ai" className="text-foreground underline hover:no-underline">
              support@blinkify.ai
            </a>{" "}
            of any unauthorized use.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">4) Use of the Service</h2>
          <P>You agree to use the Service only for lawful purposes and in accordance with these Terms. You will not:</P>
          <Ul>
            <li>Violate any applicable law or third-party rights</li>
            <li>Use the Service to harm, harass, or defraud others</li>
            <li>Attempt to gain unauthorized access to the Service, other accounts, or our systems</li>
            <li>Interfere with or disrupt the Service or servers/networks</li>
            <li>Use the Service to generate content that infringes intellectual property or that is illegal, harmful, or offensive</li>
          </Ul>
          <P>We may suspend or terminate your access if we reasonably believe you have violated these Terms.</P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">5) Subscriptions and Payment</h2>
          <P>
            Paid features are billed through {renderContentWithBold("**Polar.sh**")} (our Merchant of Record). Subscription terms, pricing, and refunds are as stated at the point of purchase and in Polar&apos;s policies. We may change pricing with notice; continued use after changes constitutes acceptance.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">6) Intellectual Property</h2>
          <P>
            We own or license the Service, including its design, code, and branding. We grant you a limited, non-exclusive, revocable license to use the Service in accordance with these Terms. You retain rights in content you create; you grant us a license to use, store, and display that content as needed to provide and improve the Service.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">7) Disclaimers</h2>
          <P>
            The Service is provided {renderContentWithBold("**as is**")} and {renderContentWithBold("**as available**")}. We disclaim all warranties to the fullest extent permitted by law. We do not guarantee uninterrupted, error-free, or secure operation of the Service.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">8) Limitation of Liability</h2>
          <P>
            To the maximum extent permitted by law, RollCall LLC and its affiliates will not be liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill, arising from your use of the Service. Our total liability will not exceed the amount you paid us in the twelve (12) months before the claim.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">9) Indemnification</h2>
          <P>
            You agree to indemnify and hold harmless RollCall LLC and its affiliates from any claims, damages, or expenses (including reasonable attorneys&apos; fees) arising from your use of the Service, your content, or your violation of these Terms.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">10) Changes to the Terms</h2>
          <P>
            We may update these Terms from time to time. We will post the updated version and update the &quot;Last Updated&quot; date. Material changes may be communicated via the Service or email. Continued use after changes constitutes acceptance.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">11) Termination</h2>
          <P>
            You may stop using the Service at any time. We may suspend or terminate your access with or without notice for breach of these Terms or for any other reason. Upon termination, your right to use the Service ceases; provisions that by their nature should survive (e.g., disclaimers, limitation of liability, indemnification) will survive.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">12) General</h2>
          <P>
            These Terms constitute the entire agreement between you and RollCall LLC regarding the Service. If any provision is held unenforceable, the remaining provisions remain in effect. Our failure to enforce any right does not waive that right. These Terms are governed by the laws of the State of Tennessee, United States, without regard to conflict of law principles.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">13) Contact</h2>
          <P>{renderContentWithBold("**RollCall LLC**")}</P>
          <P>1738 Reynolds St, Knoxville, TN 37921</P>
          <P>
            <a href="mailto:support@blinkify.ai" className="text-foreground underline hover:no-underline">
              support@blinkify.ai
            </a>
          </P>
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
