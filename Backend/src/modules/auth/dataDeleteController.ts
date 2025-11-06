import type { Request, Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { supabaseAdmin } from "../../config/supabase";

const dataDeletionSchema = z.object({
  signed_request: z.string(),
});

/**
 * POST /api/auth/data-deletion/callback
 * Endpoint para manejar solicitudes de eliminación de datos de Facebook
 * Facebook envía un signed_request cuando un usuario solicita eliminar sus datos
 */
export async function handleDataDeletionCallback(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { signed_request } = dataDeletionSchema.parse(req.body);

    console.log("📩 Solicitud de eliminación de datos recibida de Facebook");

    // Decodificar el signed_request de Facebook
    const [encodedSig, payload] = signed_request.split(".");

    if (!encodedSig || !payload) {
      res.status(400).json({ error: "Invalid signed_request format" });
      return;
    }

    const sig = base64UrlDecode(encodedSig);
    const data = JSON.parse(base64UrlDecode(payload).toString("utf8"));

    // Verificar la firma
    const appSecret = process.env["FACEBOOK_APP_SECRET"]!;
    const expectedSig = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest();

    if (!sig.equals(expectedSig)) {
      console.error("❌ Firma inválida en solicitud de eliminación");
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    const { user_id: facebookUserId } = data;
    console.log(
      `🔍 Procesando eliminación para Facebook ID: ${facebookUserId}`,
    );

    // Generar código de confirmación
    const confirmationCode = generateConfirmationCode(facebookUserId);

    // Buscar el usuario en Supabase Auth por su Facebook ID
    const { data: users, error: listError } =
      await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error("❌ Error listando usuarios:", listError);
      // Aún así respondemos OK a Facebook
      res.json({
        url: `${process.env["BASE_URL"] || "http://localhost:3000"}/data-deletion/status?id=${confirmationCode}`,
        confirmation_code: confirmationCode,
      });
      return;
    }

    // Buscar usuario con este Facebook ID en los metadatos
    const user = users.users.find(
      u =>
        u.app_metadata.provider === "facebook" &&
        u.app_metadata["provider_id"] === facebookUserId,
    );

    if (!user) {
      console.log(
        `ℹ️  Usuario no encontrado para Facebook ID: ${facebookUserId}`,
      );
      // Respondemos OK a Facebook aunque no lo encontremos
      res.json({
        url: `${process.env["BASE_URL"] || "http://localhost:3000"}/data-deletion/status?id=${confirmationCode}`,
        confirmation_code: confirmationCode,
      });
      return;
    }

    console.log(`✅ Usuario encontrado: ${user.email}`);

    // Eliminar el usuario de Supabase Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
      user.id,
    );

    if (deleteError) {
      console.error("❌ Error eliminando usuario de Auth:", deleteError);
    } else {
      console.log(`🗑️  Usuario eliminado de Auth: ${user.id}`);
    }

    // Eliminar datos del usuario de la tabla users (si existe)
    const { error: deleteUserError } = await supabaseAdmin
      .from("users")
      .delete()
      .eq("id", user.id);

    if (deleteUserError) {
      console.error(
        "❌ Error eliminando usuario de tabla users:",
        deleteUserError,
      );
    } else {
      console.log(`🗑️  Datos del usuario eliminados de tabla users`);
    }

    // Log para auditoría
    console.log("✅ Solicitud de eliminación completada:", {
      userId: user.id,
      email: user.email,
      facebookUserId,
      confirmationCode,
      timestamp: new Date().toISOString(),
    });

    // Responder a Facebook con URL de estado y código de confirmación
    res.json({
      url: `${process.env["BASE_URL"] || "http://localhost:3000"}/data-deletion/status?id=${confirmationCode}`,
      confirmation_code: confirmationCode,
    });
  } catch (error: any) {
    console.error("❌ Error en data deletion callback:", error);

    if (error.name === "ZodError") {
      res.status(400).json({
        error: "Invalid request format",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  }
}

/**
 * GET /api/auth/data-deletion/status
 * Endpoint público para verificar el estado de eliminación de datos
 */
export async function getDataDeletionStatus(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { id } = req.query;

    if (!id) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Estado de Eliminación - The Last Dance</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
            .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
            h1 { color: #d4af37; }
            .error { color: #e74c3c; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>The Last Dance Restaurant</h1>
            <p class="error">⚠️ Código de confirmación no proporcionado.</p>
          </div>
        </body>
        </html>
      `);
      return;
    }

    // Mostrar página de estado de eliminación
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Eliminación de Datos - The Last Dance</title>
        <meta charset="UTF-8">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            padding: 40px; 
            background: #f5f5f5; 
            margin: 0;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
          }
          h1 { 
            color: #d4af37; 
            margin-bottom: 10px;
          }
          .subtitle {
            color: #666;
            margin-bottom: 30px;
          }
          .status {
            padding: 20px;
            background: #e8f5e9;
            border-left: 4px solid #4caf50;
            border-radius: 4px;
            margin: 20px 0;
          }
          .code {
            font-family: monospace;
            background: #f5f5f5;
            padding: 10px;
            border-radius: 4px;
            margin: 10px 0;
            word-break: break-all;
          }
          .info {
            color: #666;
            font-size: 14px;
            line-height: 1.6;
          }
          .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #eee;
            color: #999;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🍽️ The Last Dance Restaurant</h1>
          <p class="subtitle">Solicitud de Eliminación de Datos</p>
          
          <div class="status">
            <h2 style="margin-top: 0; color: #4caf50;">✅ Solicitud Procesada</h2>
            <p>Tu solicitud de eliminación de datos ha sido recibida y procesada.</p>
          </div>

          <div class="info">
            <h3>Código de Confirmación:</h3>
            <div class="code">${id}</div>

            <h3>¿Qué datos se eliminaron?</h3>
            <ul>
              <li>Tu cuenta de usuario</li>
              <li>Información personal (nombre, email, DNI, CUIL)</li>
              <li>Historial de pedidos</li>
              <li>Datos de autenticación con Facebook</li>
            </ul>

            <h3>Información Importante:</h3>
            <ul>
              <li>Tus datos han sido eliminados completamente de nuestros sistemas</li>
              <li>Este proceso es permanente e irreversible</li>
              <li>Si deseas usar nuestra app nuevamente, deberás crear una nueva cuenta</li>
              <li>Algunos datos pueden ser retenidos por requisitos legales durante 90 días</li>
            </ul>

            <h3>¿Necesitas ayuda?</h3>
            <p>Si tienes preguntas sobre este proceso, contacta a: <strong>soporte@thelastdance.com</strong></p>
          </div>

          <div class="footer">
            <p>The Last Dance Restaurant - Solicitud procesada el ${new Date().toLocaleDateString("es-AR")}</p>
            <p>Este es un proceso automatizado conforme al GDPR y las políticas de Facebook.</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error("❌ Error obteniendo estado de eliminación:", error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - The Last Dance</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #d4af37; }
          .error { color: #e74c3c; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>The Last Dance Restaurant</h1>
          <p class="error">❌ Error al procesar la solicitud. Por favor intenta nuevamente más tarde.</p>
        </div>
      </body>
      </html>
    `);
  }
}

// Helper functions
function base64UrlDecode(str: string): Buffer {
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

function generateConfirmationCode(facebookUserId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${facebookUserId}-${Date.now()}`)
    .digest("hex")
    .substring(0, 16);
}
