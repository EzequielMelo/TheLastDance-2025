import { Request, Response } from 'express';
import { verifyTransporter, sendMail } from '../lib/mailer';
import { sendPendingEmail } from '../lib/emails';

export async function testEmail(req: Request, res: Response): Promise<void> {
  try {
    const { to, type = 'test' } = req.body;
    
    // Validar que se proporcione un email
    if (!to) {
      res.status(400).json({
        success: false,
        error: "El campo 'to' es requerido"
      });
      return;
    }
    
    console.log("🧪 Iniciando test de email:", { to, type });
    
    // Verificar variables de entorno
    const envCheck = {
      SMTP_HOST: !!process.env['SMTP_HOST'],
      SMTP_PORT: !!process.env['SMTP_PORT'],
      SMTP_USER: !!process.env['SMTP_USER'],
      SMTP_PASS: !!process.env['SMTP_PASS'],
      MAIL_FROM: !!process.env['MAIL_FROM'],
    };
    
    console.log("🔍 Variables de entorno:", envCheck);
    
    // Verificar conexión SMTP
    const isConnected = await verifyTransporter();
    console.log("🔗 Conexión SMTP:", isConnected ? "✅ OK" : "❌ FALLO");
    
    if (!isConnected) {
      res.status(500).json({
        success: false,
        error: "No se pudo conectar al servidor SMTP",
        envCheck,
        smtpConnection: false
      });
      return;
    }
    
    // Enviar email de prueba
    let result;
    if (type === 'pending') {
      result = await sendPendingEmail(to, 'Usuario de Prueba');
    } else {
      result = await sendMail({
        to,
        subject: '🧪 Test de Email - Last Dance',
        html: `
          <h2>Test de Email exitoso!</h2>
          <p>Este es un email de prueba desde el backend de Last Dance.</p>
          <p><strong>Servidor:</strong> ${process.env['NODE_ENV'] || 'development'}</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
        `,
        text: `Test de Email exitoso! Servidor: ${process.env['NODE_ENV'] || 'development'} - ${new Date().toISOString()}`
      });
    }
    
    console.log("✅ Email de prueba enviado exitosamente");
    
    res.json({
      success: true,
      message: "Email enviado exitosamente",
      messageId: result.messageId,
      envCheck,
      smtpConnection: true
    });
    
  } catch (error) {
    console.error("❌ Error en test de email:", error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Error desconocido",
      details: {
        name: (error as any)?.name,
        code: (error as any)?.code,
        command: (error as any)?.command
      }
    });
  }
}