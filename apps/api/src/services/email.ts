import { resend } from "../lib/resend.js";
import { InvitationEmail } from "../emails/invitation.js";
import React from "react";

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "Blinkify <noreply@blinkify.ai>";

interface SendInvitationParams {
  to: string;
  workspaceName: string;
  inviterName: string;
  role: string;
  inviteUrl: string;
}

/**
 * Send a workspace invitation email via Resend.
 * Returns { success, error } so callers can handle failures gracefully.
 */
export async function sendInvitationEmail(params: SendInvitationParams) {
  if (!resend) {
    console.warn("Email: Resend not configured. Skipping invitation email.");
    return { success: false, error: "Resend not configured" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `You've been invited to ${params.workspaceName} on Blinkify`,
      react: React.createElement(InvitationEmail, {
        workspaceName: params.workspaceName,
        inviterName: params.inviterName,
        role: params.role,
        inviteUrl: params.inviteUrl,
      }),
    });

    if (error) {
      console.error("Email: Failed to send invitation:", error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    console.error("Email: Unexpected error:", err);
    return { success: false, error: String(err) };
  }
}
