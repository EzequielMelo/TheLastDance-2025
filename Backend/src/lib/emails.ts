import { sendMail } from "./sendgridMailer";
import { 
  tplPending, 
  tplApproved, 
  tplRejected,
  tplReservationApproved,
  tplReservationRejected
} from "./emailTemplates";

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
  
  const subject = "Estado de tu registro - The Last Dance";
  
  const html = tplRejected(name || "Cliente", reason);
  
  const text = htmlToText(html);
    
  try {
    const result = await sendMail({ to, subject, html, text });
    return result;
  } catch (error) {
    console.error("❌ [DEBUG] sendMail falló:", error);
    throw error;
  }
}

// ============================================
// Emails para Reservas
// ============================================

export async function sendReservationApprovedEmail(
  to: string,
  name: string,
  date: string,
  time: string,
  partySize: number,
  tableNumber: string
) {
  
  const subject = "¡Tu reserva fue aprobada! - Last Dance Restaurant";
  
  const html = tplReservationApproved(name || "Cliente", date, time, partySize, tableNumber);
  
  const text = htmlToText(html);
    
  try {
    const result = await sendMail({ to, subject, html, text });
    return result;
  } catch (error) {
    console.error("❌ [DEBUG] sendMail falló:", error);
    throw error;
  }
}

export async function sendReservationRejectedEmail(
  to: string,
  name: string,
  date: string,
  time: string,
  partySize: number,
  reason?: string
) {  
  const subject = "Actualización de tu reserva - Last Dance Restaurant";
  
  const html = tplReservationRejected(name || "Cliente", date, time, partySize, reason);
  
  const text = htmlToText(html);
  
  try {
    const result = await sendMail({ to, subject, html, text });
    return result;
  } catch (error) {
    console.error("❌ [DEBUG] sendMail falló:", error);
    throw error;
  }
}
