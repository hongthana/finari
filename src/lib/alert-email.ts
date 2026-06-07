import { Resend } from "resend";

import { getEmailFrom } from "@/lib/env";

type AlertEmailParams = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type AlertEmailResult = {
  status: "sent" | "failed" | "skipped";
  errorMessage?: string;
};

export async function sendAlertDeliveryEmail(params: AlertEmailParams): Promise<AlertEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info(`Finari alert for ${params.to}: ${params.subject}\n${params.text}`);
      return { status: "skipped" };
    }

    return {
      status: "skipped",
      errorMessage: "RESEND_API_KEY is not configured",
    };
  }

  try {
    const resend = new Resend(apiKey);
    const result = await resend.emails.send({
      from: getEmailFrom(),
      to: params.to,
      subject: params.subject,
      text: params.text,
      html: params.html,
    });

    if (result.error) {
      return { status: "failed", errorMessage: result.error.message };
    }

    return { status: "sent" };
  } catch (error) {
    return {
      status: "failed",
      errorMessage: error instanceof Error ? error.message : "Unknown email error",
    };
  }
}
