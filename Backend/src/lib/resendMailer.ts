import { Resend } from 'resend';

const RESEND_API_KEY = process.env['RESEND_API_KEY'];
const FROM_EMAIL = process.env['MAIL_FROM'] || 'onboarding@resend.dev';
const FROM_NAME = process.env['MAIL_FROM_NAME'] || 'Last Dance';

// Verificar configuración
if (!RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY no está configurada");
} else {
  console.log("✅ Resend configurado correctamente");
}

// Inicializar Resend
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function sendMail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}) {
  try {
    if (!resend || !RESEND_API_KEY) {
      throw new Error("Resend no está configurado correctamente");
    }

    console.log("📧 Enviando email con Resend:", { to, subject, from: FROM_EMAIL });

    // Preparar el objeto de email
    const emailData: any = {
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
    };

    // Agregar contenido según lo que esté disponible
    if (html) {
      emailData.html = html;
    }
    if (text) {
      emailData.text = text;
    }

    const result = await resend.emails.send(emailData);

    if (result.error) {
      throw new Error(`Resend error: ${result.error.message}`);
    }

    console.log("✅ Email enviado exitosamente con Resend:", result.data?.id);
    return { messageId: result.data?.id };
    
  } catch (error) {
    console.error("❌ Error enviando email con Resend:", error);
    console.error("❌ Detalles del error:", {
      message: error instanceof Error ? error.message : "Error desconocido",
      name: (error as any)?.name,
    });
    throw error;
  }
}

// Función para verificar que Resend esté funcionando
export async function verifyTransporter() {
  try {
    if (!resend || !RESEND_API_KEY) {
      console.log("❌ Resend no está configurado");
      return false;
    }
    
    console.log("🔍 Verificando configuración de Resend...");
    console.log("📧 Configuración Resend:", { 
      apiKey: RESEND_API_KEY ? "✅ Configurada" : "❌ Faltante",
      fromEmail: FROM_EMAIL,
      fromName: FROM_NAME
    });
    
    // Resend no tiene un método verify directo, pero verificamos la configuración
    return true;
    
  } catch (error) {
    console.error("❌ Error verificando Resend:", error);
    return false;
  }
}