import { sendMail } from "./sendgridMailer";
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
  console.log("🔄 [DEBUG] sendRejectedEmail iniciado con:", { to, name, reason });
  
  const subject = "Estado de tu registro - The Last Dance";
  console.log("🔄 [DEBUG] Subject generado:", subject);
  
  const html = tplRejected(name || "Cliente", reason);
  console.log("🔄 [DEBUG] HTML template generado, longitud:", html.length);
  
  const text = htmlToText(html);
  console.log("🔄 [DEBUG] Text generado, longitud:", text.length);
  
  console.log("🔄 [DEBUG] Llamando sendMail con parámetros:", { to, subject });
  
  try {
    const result = await sendMail({ to, subject, html, text });
    console.log("✅ [DEBUG] sendMail completado exitosamente:", result);
    return result;
  } catch (error) {
    console.error("❌ [DEBUG] sendMail falló:", error);
    throw error;
  }
}
