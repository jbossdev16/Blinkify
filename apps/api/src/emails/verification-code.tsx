import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
} from "@react-email/components";

interface VerificationCodeEmailProps {
  code: string;
}

export function VerificationCodeEmail({
  code = "000000",
}: VerificationCodeEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Section style={section}>
            <Text style={logo}>Blinkify</Text>
            <Text style={heading}>Verify your email</Text>
            <Text style={paragraph}>
              Enter this code to finish creating your account:
            </Text>
            <Text style={codeStyle}>{code}</Text>
            <Text style={paragraph}>
              This code expires in 10 minutes. If you didn't sign up for
              Blinkify, you can safely ignore this email.
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

export default VerificationCodeEmail;

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

const codeStyle: React.CSSProperties = {
  fontSize: "36px",
  fontWeight: 700,
  letterSpacing: "8px",
  color: "#000",
  backgroundColor: "#f4f4f5",
  borderRadius: "8px",
  padding: "16px 24px",
  margin: "24px auto",
  display: "inline-block",
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
