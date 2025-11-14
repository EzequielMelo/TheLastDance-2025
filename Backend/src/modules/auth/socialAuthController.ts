import type { Request, Response } from "express";
import { supabaseAdmin } from "../../config/supabase";
import type { Provider } from "@supabase/supabase-js";
import { z } from "zod";
import crypto from "crypto";
import { uploadAvatar } from "../../lib/storage/avatarUpload";

// Almacenamiento temporal en memoria para sesiones OAuth pendientes
interface PendingOAuthSession {
  access_token: string;
  refresh_token: string;
  user_metadata: any;
  email: string;
  supabase_user_id: string;
  created_at: number;
  expires_at: number;
}

const pendingOAuthSessions = new Map<string, PendingOAuthSession>();

/**
 * Mejora la calidad de las URLs de fotos de Google
 * Cambia s96-c por s400-c para obtener imágenes de 400x400 en lugar de 96x96
 */
function improveGooglePhotoUrl(url: string): string {
  if (!url) return url;

  // Detectar URLs de Google Photos
  if (
    url.includes("googleusercontent.com") ||
    url.includes("ggpht.com") ||
    url.includes("google.com/a/")
  ) {
    const desiredSize = 400; // 400x400 píxeles (alta calidad)

    // Reemplazar parámetros de tamaño existentes
    let improvedUrl = url
      .replace(/=s\d+-c/g, `=s${desiredSize}-c`) // =s96-c -> =s400-c
      .replace(/\/s\d+-c\//g, `/s${desiredSize}-c/`) // /s96-c/ -> /s400-c/
      .replace(/=w\d+-h\d+/g, `=s${desiredSize}-c`); // =w96-h96 -> =s400-c

    // Si no tiene parámetro de tamaño, agregarlo
    if (!improvedUrl.includes("=s") && !improvedUrl.includes("=w")) {
      improvedUrl += `=s${desiredSize}-c`;
    }

    return improvedUrl;
  }

  return url;
}

/**
 * Descarga una imagen desde una URL y la convierte en formato Multer File
 */
async function downloadImageAsFile(
  imageUrl: string,
  userId: string,
): Promise<Express.Multer.File | null> {
  try {
    // Mejorar calidad de la URL de Google
    const improvedUrl = improveGooglePhotoUrl(imageUrl);

    const response = await fetch(improvedUrl);

    if (!response.ok) {
      console.error(
        `❌ Error descargando imagen: ${response.status} ${response.statusText}`,
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer || buffer.length === 0) {
      console.error("❌ Buffer vacío al descargar imagen");
      return null;
    }

    // Detectar tipo de imagen desde Content-Type o URL
    const contentType = response.headers.get("content-type") || "image/jpeg";
    const extension = contentType.split("/")[1] || "jpg";

    // Crear un objeto compatible con Multer.File
    const file: Express.Multer.File = {
      fieldname: "profile_image",
      originalname: `google_avatar_${userId}.${extension}`,
      encoding: "7bit",
      mimetype: contentType,
      buffer: buffer,
      size: buffer.length,
    } as Express.Multer.File;

    return file;
  } catch (error) {
    console.error("❌ Error descargando imagen de Google:", error);
    return null;
  }
}

// Limpiar sesiones expiradas cada 5 minutos
setInterval(
  () => {
    const now = Date.now();
    for (const [sessionId, session] of pendingOAuthSessions.entries()) {
      if (now > session.expires_at) {
        pendingOAuthSessions.delete(sessionId);
      }
    }
  },
  5 * 60 * 1000,
);

/**
 * Schema para validar el provider
 */
const socialAuthSchema = z.object({
  provider: z.enum(["google"]),
  redirectUrl: z.string().url(),
});

/**
 * Schema para el callback (ahora solo guarda en memoria)
 */
const callbackSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});

/**
 * Schema para completar registro (crear usuario con toda la info)
 */
const completeRegistrationSchema = z.object({
  session_id: z.string(),
  dni: z.string(),
  cuil: z.string(),
});

/**
 * POST /api/auth/social/init
 * Inicia el flujo de OAuth con un proveedor social
 */
export async function initSocialAuth(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = socialAuthSchema.parse(req.body);
    const { provider, redirectUrl } = parsed;

    // Generar URL de autenticación con Supabase
    const { data, error } = await supabaseAdmin.auth.signInWithOAuth({
      provider: provider as Provider,
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      console.error("❌ Error generando URL de OAuth:", error);
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }

    if (!data?.url) {
      res.status(400).json({
        success: false,
        error: "No se pudo generar URL de autenticación",
      });
      return;
    }

    res.json({
      success: true,
      url: data.url,
      provider: data.provider,
    });
  } catch (error: any) {
    console.error("❌ Error en initSocialAuth:", error);

    if (error.name === "ZodError") {
      res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || "Error iniciando autenticación social",
    });
  }
}

/**
 * POST /api/auth/social/callback
 * Recibe tokens de OAuth y los guarda en memoria temporal (NO crea usuario aún)
 */
export async function processSocialCallback(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = callbackSchema.parse(req.body);
    const { access_token, refresh_token } = parsed;

    // Obtener datos del usuario desde Supabase Auth (solo para validar)
    const {
      data: { user: supabaseUser },
      error: userError,
    } = await supabaseAdmin.auth.getUser(access_token);

    if (userError || !supabaseUser) {
      console.error("❌ Error obteniendo usuario:", userError);
      res.status(400).json({
        success: false,
        error: userError?.message || "No se pudo obtener el usuario",
      });
      return;
    }

    // Verificar si el usuario YA existe en nuestra base de datos
    const { data: existingUser, error: queryError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", supabaseUser.id)
      .single();

    if (queryError && queryError.code !== "PGRST116") {
      console.error("❌ Error consultando usuario:", queryError);
      res.status(500).json({
        success: false,
        error: "Error verificando usuario",
      });
      return;
    }

    if (existingUser) {
      // Bloqueo por estado (solo cliente_registrado)
      if (
        existingUser.profile_code === "cliente_registrado" &&
        existingUser.state !== "aprobado"
      ) {
        if (existingUser.state === "pendiente") {
          res.status(403).json({
            success: false,
            error: "Tu registro está pendiente de aprobación.",
          });
          return;
        } else {
          res.status(403).json({
            success: false,
            error: "Tu registro fue rechazado.",
          });
          return;
        }
      }

      const needsAdditionalInfo = !existingUser.dni || !existingUser.cuil;

      res.json({
        success: true,
        session: {
          access_token,
          refresh_token,
        },
        user: existingUser,
        needsAdditionalInfo,
        message: needsAdditionalInfo
          ? "Por favor completa tu perfil"
          : "Inicio de sesión exitoso",
      });
      return;
    }

    // Usuario nuevo: Guardar tokens en memoria temporal
    const sessionId = crypto.randomBytes(32).toString("hex");
    const now = Date.now();

    pendingOAuthSessions.set(sessionId, {
      access_token,
      refresh_token,
      user_metadata: supabaseUser.user_metadata,
      email: supabaseUser.email || "",
      supabase_user_id: supabaseUser.id,
      created_at: now,
      expires_at: now + 5 * 60 * 1000, // 5 minutos para completar registro
    });

    // Extraer nombre del metadata
    const metadata = supabaseUser.user_metadata;
    const firstName =
      metadata?.["full_name"]?.split(" ")[0] ||
      metadata?.["name"]?.split(" ")[0] ||
      "Usuario";
    const lastName =
      metadata?.["full_name"]?.split(" ").slice(1).join(" ") ||
      metadata?.["name"]?.split(" ").slice(1).join(" ") ||
      "";

    res.json({
      success: true,
      requires_completion: true,
      session_id: sessionId,
      user_preview: {
        email: supabaseUser.email,
        first_name: firstName,
        last_name: lastName,
        profile_image:
          metadata?.["avatar_url"] || metadata?.["picture"] || null,
      },
      message: "Por favor completa tu registro con DNI y CUIL",
    });
  } catch (error: any) {
    console.error("❌ Error en processSocialCallback:", error);

    if (error.name === "ZodError") {
      res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || "Error procesando autenticación social",
    });
  }
}

/**
 * POST /api/auth/social/complete-registration
 * Crea el usuario en Auth y DB con TODOS los datos (tokens desde memoria + DNI/CUIL)
 */
export async function completeRegistration(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = completeRegistrationSchema.parse(req.body);
    const { session_id, dni, cuil } = parsed;

    // Buscar sesión en memoria
    const session = pendingOAuthSessions.get(session_id);

    if (!session) {
      console.error("❌ Sesión no encontrada o expirada");
      res.status(400).json({
        success: false,
        error: "Sesión expirada. Por favor inicia el proceso nuevamente.",
      });
      return;
    }

    const { access_token, refresh_token, user_metadata, supabase_user_id } =
      session;

    // Extraer nombre del metadata
    const firstName =
      user_metadata?.["full_name"]?.split(" ")[0] ||
      user_metadata?.["name"]?.split(" ")[0] ||
      "Usuario";
    const lastName =
      user_metadata?.["full_name"]?.split(" ").slice(1).join(" ") ||
      user_metadata?.["name"]?.split(" ").slice(1).join(" ") ||
      "";

    // Descargar y subir la foto de perfil de Google al bucket
    let profileImageUrl: string | null = null;
    const googleImageUrl =
      user_metadata?.["avatar_url"] || user_metadata?.["picture"];

    if (googleImageUrl) {
      const imageFile = await downloadImageAsFile(
        googleImageUrl,
        supabase_user_id,
      );

      if (imageFile) {
        try {
          profileImageUrl = await uploadAvatar(supabase_user_id, imageFile);
        } catch (uploadError) {
          console.error("❌ Error subiendo foto de perfil:", uploadError);
          // Continuar sin foto si falla
        }
      } else {
        console.log(
          "⚠️ No se pudo descargar la imagen, continuando sin foto de perfil",
        );
      }
    } else {
      console.log("ℹ️ Usuario no tiene foto de perfil en Google");
    }

    try {
      // Crear usuario en la tabla users
      const { data: newUser, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          id: supabase_user_id,
          first_name: firstName,
          last_name: lastName,
          profile_code: "cliente_registrado",
          profile_image: profileImageUrl, // URL del bucket, no de Google
          state: "pendiente", // Pendiente de aprobación admin
          dni,
          cuil,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error creando usuario en DB:", insertError);
        res.status(500).json({
          success: false,
          error: "Error creando usuario en la base de datos",
        });
        return;
      }

      // Eliminar sesión de memoria
      pendingOAuthSessions.delete(session_id);

      // Responder con tokens y usuario completo
      res.json({
        success: true,
        session: {
          access_token,
          refresh_token,
        },
        user: newUser,
        message: "Registro completado exitosamente. Pendiente de aprobación.",
      });
    } catch (error: any) {
      console.error("❌ Error en proceso de registro:", error);

      // No eliminar la sesión para que el usuario pueda reintentar
      res.status(500).json({
        success: false,
        error: "Error completando el registro. Por favor intenta nuevamente.",
      });
    }
  } catch (error: any) {
    console.error("❌ Error en completeRegistration:", error);

    if (error.name === "ZodError") {
      res.status(400).json({
        success: false,
        error: "Datos inválidos",
        details: error.errors,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || "Error completando registro",
    });
  }
}
