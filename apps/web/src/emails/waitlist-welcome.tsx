import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Img,
  Link,
} from "@react-email/components";

/** PNG URL for email; Gmail/Outlook block SVG. Use NEXT_PUBLIC_APP_URL in production. */
const DEFAULT_LOGO_URL = "https://blinkify.ai/logo/blinkify-logo-color.png";

export function WaitlistWelcomeEmail({ logoSrc }: { logoSrc?: string }) {
  const src = logoSrc ?? DEFAULT_LOGO_URL;
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Section style={section}>
            <Img
              src={src}
              width="140"
              height="32"
              alt="Blinkify"
              style={logoImg}
            />
            <Text style={heading}>You&apos;re on the list!</Text>
            <Text style={paragraph}>
              Thanks for joining the Blinkify waitlist. We&apos;re building
              something special — AI-powered ad creatives that take seconds, not
              hours.
            </Text>
            <Text style={highlight}>Here&apos;s what&apos;s coming:</Text>
            <Text style={listItem}>
              ✦{"  "}Generate product images and ad creatives in 60 seconds
            </Text>
            <Text style={listItem}>
              ✦{"  "}Brand-consistent outputs, every time
            </Text>
            <Text style={listItem}>
              ✦{"  "}No designer needed — just upload and go
            </Text>
            <Text style={paragraph}>
              You&apos;ll be among the first to get access when we launch.
              We&apos;ll reach out with your invite soon.
            </Text>
            <Hr style={hr} />
            <Text style={footer}>
              Blinkify — AI-powered ad creatives
            </Text>
            <Link href="https://instagram.com/blinkify.ai" style={socialLink}>
              Follow us on Instagram →
            </Link>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default WaitlistWelcomeEmail;

const body: React.CSSProperties = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container: React.CSSProperties = {
  maxWidth: "480px",
  margin: "0 auto",
  padding: "20px 0",
};

const section: React.CSSProperties = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  padding: "40px 32px",
  textAlign: "center" as const,
};

const logoImg: React.CSSProperties = {
  margin: "0 auto 24px",
};

const heading: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 600,
  color: "#1a1a1a",
  marginBottom: "12px",
};

const paragraph: React.CSSProperties = {
  fontSize: "15px",
  color: "#4a4a4a",
  lineHeight: "1.6",
  marginBottom: "16px",
};

const highlight: React.CSSProperties = {
  fontSize: "15px",
  fontWeight: 600,
  color: "#1a1a1a",
  lineHeight: "1.6",
  marginBottom: "8px",
};

const listItem: React.CSSProperties = {
  fontSize: "15px",
  color: "#4a4a4a",
  lineHeight: "1.6",
  marginBottom: "6px",
  textAlign: "left" as const,
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  fontSize: "13px",
  color: "#8898aa",
  lineHeight: "1.5",
  marginBottom: "8px",
};

const socialLink: React.CSSProperties = {
  fontSize: "13px",
  color: "#8898aa",
  textDecoration: "underline",
  textAlign: "center" as const,
  display: "block",
};
