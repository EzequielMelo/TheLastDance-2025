import nodemailer from "nodemailer";

const SMTP_HOST = process.env['SMTP_HOST']!;
const SMTP_PORT = Number(process.env['SMTP_PORT'] || 465);
const SMTP_USER = process.env['SMTP_USER']!;
const SMTP_PASS = process.env['SMTP_PASS']!;
const FROM_NAME = process.env['MAIL_FROM_NAME'] || "Last Dance";
const FROM_EMAIL = process.env['MAIL_FROM']!; // mismo gmail que autentica

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: true, // Gmail: usar 465 con TLS implícito
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export async function sendMail({to, subject, html, text,}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  try {
    console.log("📧 Enviando email:", { to, subject, from: FROM_EMAIL });
    console.log("📧 Configuración SMTP:", { 
      host: SMTP_HOST, 
      port: SMTP_PORT, 
      user: SMTP_USER ? "✅ Configurado" : "❌ Faltante" 
    });
    
    const result = await transporter.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      text,
      html,
      headers: { "X-Auto-Response-Suppress": "All" },
    });
    
    console.log("✅ Email enviado exitosamente:", result.messageId);
    return result;
    
  } catch (error) {
    console.error("❌ Error enviando email:", error);
    console.error("❌ Detalles del error:", {
      message: error instanceof Error ? error.message : "Error desconocido",
      code: (error as any)?.code,
      command: (error as any)?.command,
    });
    throw error;
  }
}
