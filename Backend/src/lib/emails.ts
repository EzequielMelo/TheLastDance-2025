import { sendMail } from "./resendMailer";
import { tplPending, tplApproved, tplRejected } from "./emailTemplates";

const htmlToText = (html: string) =>
  html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .trim();

export async function sendPendingEmail(to: string, name: string) {
  const subject = "¡Recibimos tu registro!";
  const html = tplPending(name || "Cliente");
  const text = htmlToText(html);
  return sendMail({ to, subject, html, text });
}

export async function sendApprovedEmail(to: string, name: string) {
  const subject = "¡Tu cuenta fue aprobada!";
  const html = tplApproved(name || "Cliente");
  const text = htmlToText(html);
  return sendMail({ to, subject, html, text });
}

export async function sendRejectedEmail(to: string, name: string, reason?: string) {
  try {
    console.log("📧 Iniciando sendRejectedEmail:", { to, name, reason });
    
    const subject = "Tu registro fue rechazado";
    const html = tplRejected(name || "Cliente", reason);
    const text = htmlToText(html);
    
    console.log("📧 Template generado, enviando email...");
    const result = await sendMail({ to, subject, html, text });
    
    console.log("✅ sendRejectedEmail completado exitosamente");
    return result;
    
  } catch (error) {
    console.error("❌ Error en sendRejectedEmail:", error);
    throw error;
  }
}
