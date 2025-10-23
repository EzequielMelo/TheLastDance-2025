import nodemailer from "nodemailer";

const SMTP_HOST = process.env['SMTP_HOST']!;
const SMTP_PORT = Number(process.env['SMTP_PORT'] || 465);
const SMTP_USER = process.env['SMTP_USER']!;
const SMTP_PASS = process.env['SMTP_PASS']!;
const FROM_NAME = process.env['MAIL_FROM_NAME'] || "Last Dance";
const FROM_EMAIL = process.env['MAIL_FROM']!; // mismo gmail que autentica

// Verificar variables de entorno críticas
if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !FROM_EMAIL) {
  console.error("❌ Variables de entorno SMTP faltantes:", {
    SMTP_HOST: SMTP_HOST ? "✅" : "❌",
    SMTP_USER: SMTP_USER ? "✅" : "❌", 
    SMTP_PASS: SMTP_PASS ? "✅" : "❌",
    FROM_EMAIL: FROM_EMAIL ? "✅" : "❌"
  });
}

export const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // true para 465, false para otros puertos
  auth: { 
    user: SMTP_USER, 
    pass: SMTP_PASS 
  },
  // Configuraciones adicionales para Render
  connectionTimeout: 60000, // 60 segundos
  greetingTimeout: 30000,   // 30 segundos
  socketTimeout: 60000,     // 60 segundos
});

// Función para verificar conectividad SMTP
export async function verifyTransporter() {
  try {
    console.log("🔍 Verificando conexión SMTP...");
    await transporter.verify();
    console.log("✅ Conexión SMTP verificada exitosamente");
    return true;
  } catch (error) {
    console.error("❌ Error verificando conexión SMTP:", error);
    return false;
  }
}

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
      user: SMTP_USER ? "✅ Configurado" : "❌ Faltante",
      secure: SMTP_PORT === 465
    });
    
    // Verificar conexión antes de enviar
    const isConnected = await verifyTransporter();
    if (!isConnected) {
      throw new Error("No se pudo establecer conexión SMTP");
    }
    
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
      name: (error as any)?.name,
      code: (error as any)?.code,
      command: (error as any)?.command,
      response: (error as any)?.response,
      responseCode: (error as any)?.responseCode,
    });
    
    // Re-lanzar el error para que el llamador pueda manejarlo
    throw error;
  }
}
