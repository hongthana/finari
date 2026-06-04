import { Resend } from "resend";

import { getEmailFrom } from "@/lib/env";

export async function sendMagicLinkEmail(params: {
  identifier: string;
  url: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`Finari sign-in link for ${params.identifier}: ${params.url}`);
      return;
    }
    throw new Error("RESEND_API_KEY is not configured");
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: getEmailFrom(),
    to: params.identifier,
    subject: "Sign in to Finari",
    text: `Sign in to Finari:\n${params.url}\n\nIf you did not request this email, you can ignore it.`,
    html: `
      <div style="font-family:Inter,Arial,sans-serif;line-height:1.5;color:#18181b">
        <h1 style="font-size:20px">Sign in to Finari</h1>
        <p>Open this secure link to continue to your equity research workspace.</p>
        <p><a href="${params.url}" style="display:inline-block;background:#18181b;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Sign in</a></p>
        <p style="font-size:12px;color:#71717a">If you did not request this email, you can ignore it.</p>
      </div>
    `,
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
}
