import { LandingHeader } from "@/components/landing-header";
import { LandingFooter } from "@/components/landing-footer";
import { renderContentWithBold } from "@/lib/render-content-with-bold";

export const metadata = {
  title: "Privacy Policy — Blinkify",
  description: "Privacy Policy for Blinkify (RollCall LLC). How we collect, use, and protect your information.",
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://blinkify.ai"}/privacy`,
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

export default function PrivacyPage() {
  return (
    <>
      <ContentGuideLines />
      <LandingHeader />
      <main className="bg-[#ffffff]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <h1 className="text-h2 text-foreground mb-2">
          Privacy Policy — Blinkify (RollCall LLC)
        </h1>
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-body-sm text-muted-foreground mb-10">
          <span>{renderContentWithBold("**Effective Date:** February 19, 2026")}</span>
          <span>{renderContentWithBold("**Last Updated:** February 19, 2026")}</span>
        </div>

        <P>
          This Privacy Policy explains how{" "}
          {renderContentWithBold(
            "**RollCall LLC** (\"**RollCall**,\" \"**we**,\" \"**us**,\" or \"**our**\")"
          )}{" "}
          collects, uses, discloses, and protects information when you use{" "}
          {renderContentWithBold("**Blinkify**")} (the{" "}
          {renderContentWithBold("**Service**")}), including:
        </P>
        <Ul>
          <li>blinkify.ai</li>
          <li>app.blinkify.ai</li>
          <li>api.blinkify.ai</li>
          <li>mail.blinkify.ai</li>
        </Ul>
        <P>By using the Service, you agree to this Privacy Policy.</P>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">1) Who We Are</h2>
          <P>
            {renderContentWithBold("**Company:**")} RollCall LLC
          </P>
          <P>
            {renderContentWithBold("**Address:**")} 1738 Reynolds St, Knoxville, TN 37921, United States
          </P>
          <P>
            {renderContentWithBold("**Support:**")}{" "}
            <a href="mailto:support@blinkify.ai" className="text-foreground underline hover:no-underline">
              support@blinkify.ai
            </a>
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">2) Information We Collect</h2>

          <h3 className="text-h5 text-foreground mt-6 mb-2">A) Information you provide</h3>
          <P>We collect:</P>
          <Ul>
            <li>
              {renderContentWithBold("**Account information:**")} email address, first name, last name
            </li>
            <li>
              {renderContentWithBold("**Authentication information:**")} login method (Google OAuth and/or email/password).{" "}
              <em>Note:</em> We do not store your Google password. For email/password accounts, we store credential data in a secure, hashed form.
            </li>
          </Ul>

          <h3 className="text-h5 text-foreground mt-6 mb-2">B) Payment information</h3>
          <P>
            Payments and taxes for Blinkify are handled by {renderContentWithBold("**Polar.sh**")} as our{" "}
            {renderContentWithBold("**Merchant of Record (MoR)**")}, and Polar may use{" "}
            {renderContentWithBold("**Stripe Express**")} for payment processing. We generally receive only limited payment-related information (such as subscription status, plan, and transaction identifiers) needed to provide the Service.
          </P>
          <P>
            {renderContentWithBold("**Polar (and its processors) may collect billing details**")} such as billing address and tax/VAT information depending on your region and transaction requirements. Please review Polar&apos;s privacy policy for details on what they collect and how they handle it.
          </P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">C) Automatically collected information</h3>
          <P>
            We use cookies and similar technologies. We also use:
          </P>
          <Ul>
            <li>{renderContentWithBold("**Google Analytics**")} (usage measurement)</li>
            <li>{renderContentWithBold("**Meta Pixel**")} (advertising measurement)</li>
          </Ul>
          <P>
            These tools may collect information such as pages viewed, actions taken, approximate location, device/browser information, and identifiers (via cookies or similar technologies), depending on your settings and browser/device controls.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">3) What We Do Not Collect</h2>
          <P>
            We do {renderContentWithBold("**not**")} intentionally collect:
          </P>
          <Ul>
            <li>Sensitive personal information (such as government IDs) through Blinkify</li>
            <li>
              Content you generate (&quot;UGC&quot;) {renderContentWithBold("**as a dedicated data category**")} beyond what is necessary to deliver the Service and store your account&apos;s outputs/assets (see Section 6)
            </li>
          </Ul>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">4) How We Use Information</h2>
          <P>We use information to:</P>
          <Ul>
            <li>Create and manage user accounts</li>
            <li>Provide and operate the Service (including delivering generated outputs and related features)</li>
            <li>Process subscriptions and manage billing status (via Polar)</li>
            <li>Send service messages (e.g., account notices, security alerts)</li>
            <li>Send {renderContentWithBold("**marketing emails**")} (you can opt out; see Section 10)</li>
            <li>Measure performance and improve the Service</li>
            <li>Detect, prevent, and address fraud, abuse, and security incidents</li>
            <li>Comply with legal obligations and enforce our terms</li>
          </Ul>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">5) Cookies, Analytics, and Advertising</h2>
          <P>We use cookies and similar technologies for:</P>
          <Ul>
            <li>Authentication and session management</li>
            <li>Preferences and functionality</li>
            <li>Analytics and measurement</li>
            <li>Advertising measurement (Meta Pixel)</li>
          </Ul>
          <P>
            You can control cookies through browser settings and, where available, consent tools. Blocking cookies may impact functionality.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">6) Data Storage and Retention</h2>

          <h3 className="text-h5 text-foreground mt-6 mb-2">Storage</h3>
          <P>
            We store Service data using {renderContentWithBold("**Supabase**")} (a managed database/storage provider). Your data may be stored and processed in countries where our vendors operate.
          </P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">Retention</h3>
          <Ul>
            <li>
              If you {renderContentWithBold("**delete your account**")}, your data may remain in our systems for up to {renderContentWithBold("**30 days**")} for recovery, operational continuity, and legal/compliance needs.
            </li>
            <li>
              After that period, the data is {renderContentWithBold("**permanently deleted**")} from our active systems, subject to limited exceptions (e.g., legal compliance, dispute resolution, and backup systems where deletion may occur on a rolling schedule).
            </li>
          </Ul>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">7) How We Share Information</h2>
          <P>We may share information with:</P>
          <Ul>
            <li>
              {renderContentWithBold("**Service providers**")} that help us operate the Service (e.g., hosting, database/storage, email delivery, analytics, security)
            </li>
            <li>
              {renderContentWithBold("**Polar.sh (Merchant of Record)**")} and its payment processors (e.g., Stripe Express) to process payments, manage taxes, and handle billing
            </li>
            <li>
              {renderContentWithBold("**Advertising/analytics providers**")} (Google Analytics, Meta Pixel) for measurement as described above
            </li>
            <li>
              {renderContentWithBold("**Legal and safety authorities**")} if required to comply with law or protect rights, safety, and integrity
            </li>
            <li>
              {renderContentWithBold("**Business transfers**")} (e.g., merger, acquisition, financing, sale of assets), where data may be transferred as part of that transaction
            </li>
          </Ul>
          <P>We do {renderContentWithBold("**not**")} sell your personal information.</P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">8) Legal Bases for Processing (EEA/UK and similar regions)</h2>
          <P>
            If you are in the EEA/UK (or similar jurisdictions), we process personal data under these legal bases where applicable:
          </P>
          <Ul>
            <li>{renderContentWithBold("**Contract:**")} to provide the Service you request</li>
            <li>{renderContentWithBold("**Legitimate interests:**")} to secure, improve, and market the Service (balanced against your rights)</li>
            <li>{renderContentWithBold("**Consent:**")} where required (e.g., certain cookies/marketing depending on region)</li>
            <li>{renderContentWithBold("**Legal obligations:**")} compliance with applicable laws</li>
          </Ul>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">9) International Data Transfers</h2>
          <P>
            Blinkify is offered worldwide. Your information may be processed outside your country, including in the United States and other locations where our providers operate. Where required, we use appropriate safeguards for international transfers.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">10) Your Choices and Rights</h2>

          <h3 className="text-h5 text-foreground mt-6 mb-2">A) Marketing emails</h3>
          <P>
            We send marketing emails using {renderContentWithBold("**Resend**")}. You can opt out using the {renderContentWithBold("**unsubscribe**")} link in the email or by contacting{" "}
            <a href="mailto:support@blinkify.ai" className="text-foreground underline hover:no-underline">
              support@blinkify.ai
            </a>
            . Transactional/service emails may still be sent when necessary.
          </P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">B) Account access, correction, deletion</h3>
          <P>
            You may request access, correction, or deletion of your personal information by contacting{" "}
            <a href="mailto:support@blinkify.ai" className="text-foreground underline hover:no-underline">
              support@blinkify.ai
            </a>
            .
          </P>

          <h3 className="text-h5 text-foreground mt-6 mb-2">C) Regional privacy rights (including U.S. states)</h3>
          <P>Depending on your location, you may have rights to:</P>
          <Ul>
            <li>Request access to personal information we hold about you</li>
            <li>Request deletion</li>
            <li>Request correction</li>
            <li>Opt out of certain processing where applicable</li>
            <li>Non-discrimination for exercising privacy rights</li>
          </Ul>
          <P>We will verify requests as required by law.</P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">11) Security</h2>
          <P>
            We use reasonable administrative, technical, and organizational safeguards designed to protect information. No system is 100% secure, and we cannot guarantee absolute security.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">12) Children&apos;s Privacy</h2>
          <P>
            Blinkify is {renderContentWithBold("**not directed to children under 13**")}, and we do not knowingly collect personal information from children under 13. If you believe a child has provided personal information, contact{" "}
            <a href="mailto:support@blinkify.ai" className="text-foreground underline hover:no-underline">
              support@blinkify.ai
            </a>
            .
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">13) Changes to This Policy</h2>
          <P>
            We may update this Privacy Policy from time to time. We will post the updated version and revise the &quot;Last Updated&quot; date. Material changes may be communicated through the Service or by email.
          </P>
        </section>

        <hr className="border-border my-10" />

        <section className="mb-10">
          <h2 className="text-h4 text-foreground mb-4">14) Contact</h2>
          <P>{renderContentWithBold("**RollCall LLC**")}</P>
          <P>1738 Reynolds St, Knoxville, TN 37921</P>
          <P>
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
