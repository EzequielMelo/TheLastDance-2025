import { sendMail } from '../lib/sendgridMailer';

interface InvoiceEmailData {
  clientName: string;
  tableNumber: string;
  invoiceNumber: string;
  totalAmount: number;
  invoiceDate: string;
}

export class InvoiceEmailService {
  /**
   * Envía factura por email a usuarios registrados
   */
  static async sendInvoiceByEmail(
    userEmail: string,
    invoiceHTML: string,
    invoiceData: InvoiceEmailData
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Crear el email con la factura embebida
      const subject = `Factura ${invoiceData.invoiceNumber} - The Last Dance`;
      const emailHTML = this.createInvoiceEmailTemplate(invoiceData, invoiceHTML);
      const emailText = this.createInvoiceEmailText(invoiceData);

      // Enviar el email
      await sendMail({
        to: userEmail,
        subject,
        html: emailHTML,
        text: emailText
      });

      console.log(`✅ Factura enviada por email a: ${userEmail}`);
      return { success: true };

    } catch (error) {
      console.error('❌ Error enviando factura por email:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Error desconocido' 
      };
    }
  }

  /**
   * Crear template de email con factura embebida
   */
  private static createInvoiceEmailTemplate(
    invoiceData: InvoiceEmailData,
    invoiceHTML: string
  ): string {
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu Factura - The Last Dance</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #d4af37 0%, #b8941f 50%, #d4af37 100%);
            color: #1a1a1a;
            padding: 30px;
            text-align: center;
            border-radius: 10px 10px 0 0;
        }
        .content {
            background: #f8f9fa;
            padding: 30px;
            border-radius: 0 0 10px 10px;
        }

        .invoice-container {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin: 20px 0;
            border: 1px solid #ddd;
            max-height: 600px;
            overflow-y: auto;
        }
        .footer {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin-top: 30px;
        }
    </style>
</head>
<body>
    <div class="header">
        <div style="margin-bottom: 20px;">
            <img src="https://eahhbvsassnukebtvate.supabase.co/storage/v1/object/public/Icon/icono.png" 
                 alt="Last Dance Logo" 
                 style="width: 60px; height: 60px; border-radius: 12px; box-shadow: 0 8px 16px rgba(212,175,55,0.3);" />
        </div>
        <h1>Tu Factura está Lista</h1>
        <p>Gracias por tu visita a The Last Dance</p>
    </div>
    
    <div class="content">
        <p>Hola <strong>${invoiceData.clientName}</strong>,</p>
        
        <p>Te enviamos tu factura correspondiente a tu consumo en nuestra mesa <strong>${invoiceData.tableNumber}</strong>.</p>
        
        <h3>Factura Completa</h3>
        <p>A continuación encontrarás tu factura oficial con formato AFIP:</p>
        
        <div class="invoice-container">
            ${invoiceHTML}
        </div>
        
        <p><strong>Importante:</strong> Puedes guardar este email como comprobante de tu compra. La factura incluye todos los datos fiscales requeridos por AFIP.</p>
        
        <p>¡Esperamos verte pronto nuevamente!</p>
        
        <p>Saludos cordiales,<br>
        <strong>El equipo de The Last Dance</strong></p>
    </div>
    
    <div class="footer">
        <p>The Last Dance Restaurant | Av. Principal 123, CABA</p>
        <p>Este es un email automático, por favor no respondas a esta dirección.</p>
    </div>
</body>
</html>`;
  }

  /**
   * Crear versión texto plano del email
   */
  private static createInvoiceEmailText(invoiceData: InvoiceEmailData): string {
    return `
Tu Factura - The Last Dance

Hola ${invoiceData.clientName},

Te enviamos tu factura correspondiente a tu consumo en nuestra mesa ${invoiceData.tableNumber}.

Esta factura incluye todos los datos fiscales requeridos por AFIP.

¡Esperamos verte pronto nuevamente!

Saludos cordiales,
El equipo de The Last Dance

---
The Last Dance Restaurant | Av. Principal 123, CABA
Este es un email automático, por favor no respondas a esta dirección.
`;
  }
}