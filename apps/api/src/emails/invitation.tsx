import * as React from "react";
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Img,
} from "@react-email/components";

interface InvitationEmailProps {
  workspaceName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}

export function InvitationEmail({
  workspaceName = "Blinkify Workspace",
  inviterName = "Someone",
  role = "member",
  inviteUrl = "https://app.blinkify.ai/invite/abc123",
}: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={body}>
        <Container style={container}>
          <Section style={section}>
            <Text style={logo}>Blinkify</Text>
            <Text style={heading}>You've been invited</Text>
            <Text style={paragraph}>
              <strong>{inviterName}</strong> invited you to join{" "}
              <strong>{workspaceName}</strong> as a <strong>{role}</strong>.
            </Text>
            <Button style={button} href={inviteUrl}>
              Accept Invitation
            </Button>
            <Hr style={hr} />
            <Text style={footer}>
              This invitation expires in 7 days. If you didn't expect this
              email, you can safely ignore it.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export default InvitationEmail;

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
  marginBottom: "24px",
};

const button: React.CSSProperties = {
  backgroundColor: "#000",
  color: "#fff",
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  textAlign: "center" as const,
  display: "block",
  padding: "12px 24px",
  borderRadius: "6px",
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
