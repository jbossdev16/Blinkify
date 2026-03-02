import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;

if (!apiKey) {
  console.warn("Resend: RESEND_API_KEY missing. Emails will not be sent.");
}

/**
 * Resend client for transactional emails (invitations, alerts, etc.).
 */
export const resend = apiKey ? new Resend(apiKey) : null;
