import { sendMail } from "./mailer";
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
  const subject = "Tu registro fue rechazado";
  const html = tplRejected(name || "Cliente", reason);
  const text = htmlToText(html);
  return sendMail({ to, subject, html, text });
}
