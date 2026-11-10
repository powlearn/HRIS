/**
 * Email notification abstraction.
 *
 * - `console` driver prints messages (development / demo default).
 * - `smtp` driver uses nodemailer when configured via environment variables.
 *
 * Business modules never talk to a transport directly; they call `sendMail`.
 */
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type MailResult = { delivered: boolean; driver: string; error?: string };

const driver = process.env.MAIL_DRIVER === "smtp" ? "smtp" : "console";

async function sendViaSmtp(message: MailMessage): Promise<MailResult> {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD } = process.env;
  if (!SMTP_HOST) {
    return { delivered: false, driver: "smtp", error: "SMTP_HOST belum dikonfigurasi." };
  }
  try {
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(SMTP_PORT ?? 587),
      secure: Number(SMTP_PORT ?? 587) === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
    await transport.sendMail({
      from: process.env.MAIL_FROM ?? "no-reply@nexahr.local",
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
    return { delivered: true, driver: "smtp" };
  } catch (error) {
    console.error("[mail] SMTP delivery failed", error);
    return { delivered: false, driver: "smtp", error: error instanceof Error ? error.message : "unknown" };
  }
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  if (driver === "smtp") return sendViaSmtp(message);
  console.info(
    `[mail:console] → ${message.to} | ${message.subject}\n${message.text}\n(Atur MAIL_DRIVER=smtp untuk pengiriman nyata.)`,
  );
  return { delivered: false, driver: "console" };
}

export function passwordResetEmail(name: string, resetUrl: string): MailMessage {
  return {
    to: "",
    subject: "Reset kata sandi NexaHR",
    text: `Halo ${name},\n\nKami menerima permintaan reset kata sandi. Buka tautan berikut (berlaku 30 menit):\n${resetUrl}\n\nJika Anda tidak meminta reset, abaikan email ini.`,
  };
}
