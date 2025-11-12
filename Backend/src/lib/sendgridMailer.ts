import sgMail from '@sendgrid/mail';

const SENDGRID_API_KEY = process.env['SENDGRID_API_KEY'];
const FROM_EMAIL = process.env['MAIL_FROM'] || 'noreply@lastdance.com';
const FROM_NAME = process.env['MAIL_FROM_NAME'] || 'Last Dance Restaurant';

// Verificar configuración
if (!SENDGRID_API_KEY) {
  console.error("❌ SENDGRID_API_KEY no está configurada");
} else {
  console.log("✅ SendGrid configurado correctamente");
  sgMail.setApiKey(SENDGRID_API_KEY);
}

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
    if (!SENDGRID_API_KEY) {
      throw new Error("SendGrid no está configurado correctamente");
    }

    // Preparar el objeto de email
    const msg: any = {
      to: to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: subject
    };

    // Agregar contenido solo si está presente
    if (html) {
      msg.html = html;
    }
    if (text) {
      msg.text = text;
    } else if (html) {
      // Generar texto plano desde HTML si no se proporciona texto
      msg.text = html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }

    const result = await sgMail.send(msg);

    return { messageId: result[0]?.headers?.['x-message-id'] };
    
  } catch (error: any) {
    console.error("❌ Error enviando email con SendGrid:", error);
    
    // Manejar errores específicos de SendGrid
    if (error.response) {
      console.error("❌ Respuesta de SendGrid:", {
        statusCode: error.response.statusCode,
        body: error.response.body
      });
    }
    
    console.error("❌ Detalles del error:", {
      message: error.message || "Error desconocido",
      code: error.code
    });
    
    throw new Error(`SendGrid error: ${error.message || 'Error enviando email'}`);
  }
}

// Función para verificar que SendGrid esté funcionando
export async function verifyTransporter() {
  try {
    if (!SENDGRID_API_KEY) {
      console.log("❌ SendGrid no está configurado");
      return false;
    }
    
    console.log("🔍 Verificando configuración de SendGrid...");
    console.log("📧 Configuración SendGrid:", { 
      apiKey: SENDGRID_API_KEY ? "✅ Configurada" : "❌ Faltante",
      fromEmail: FROM_EMAIL,
      fromName: FROM_NAME
    });
    
    // SendGrid no tiene un método verify directo, pero verificamos la configuración
    return true;
    
  } catch (error) {
    console.error("❌ Error verificando SendGrid:", error);
    return false;
  }
}