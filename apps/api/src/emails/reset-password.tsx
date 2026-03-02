import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Link,
} from "@react-email/components";

interface ResetPasswordEmailProps {
  resetLink: string;
}

export function ResetPasswordEmail({ resetLink }: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Section style={section}>
            <Text style={logo}>Blinkify</Text>
            <Text style={heading}>Reset your password</Text>
            <Text style={paragraph}>
              Click the button below to set a new password for your account.
            </Text>
            <Link href={resetLink} style={button}>
              Reset Password
            </Link>
            <Text style={paragraph}>
              If you didn&apos;t request this, you can safely ignore this email.
              The link expires in 1 hour.
            </Text>
            <Hr style={hr} />
            <Text style={footer}>
              Blinkify — AI-powered ad creatives
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default ResetPasswordEmail;

// ─── Styles ──────────────────────────────────────────────────────────────────

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

const logo: React.CSSProperties = {
  fontSize: "24px",
  fontWeight: 700,
  color: "#000",
  marginBottom: "24px",
};

const heading: React.CSSProperties = {
  fontSize: "20px",
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

const button: React.CSSProperties = {
  display: "inline-block",
  backgroundColor: "#000",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  padding: "14px 28px",
  borderRadius: "8px",
  margin: "24px 0",
};

const hr: React.CSSProperties = {
  borderColor: "#e6ebf1",
  margin: "24px 0",
};

const footer: React.CSSProperties = {
  fontSize: "13px",
  color: "#8898aa",
  lineHeight: "1.5",
};
