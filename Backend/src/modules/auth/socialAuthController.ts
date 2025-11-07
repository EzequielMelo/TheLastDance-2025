import type { Request, Response } from "express";
import { supabaseAdmin } from "../../config/supabase";
import type { Provider } from "@supabase/supabase-js";
import { z } from "zod";
import crypto from "crypto";

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

// Limpiar sesiones expiradas cada 5 minutos
setInterval(
  () => {
    const now = Date.now();
    for (const [sessionId, session] of pendingOAuthSessions.entries()) {
      if (now > session.expires_at) {
        console.log(`🧹 Limpiando sesión expirada: ${sessionId}`);
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

    console.log(`🔑 Iniciando OAuth con ${provider}`);

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

    console.log("✅ URL de OAuth generada");

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

    console.log("📱 Procesando callback de OAuth (guardando en memoria)");

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

    console.log("👤 Usuario de OAuth obtenido:", supabaseUser.email);

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
      // Usuario ya existe, permitir login directo
      console.log("✅ Usuario existente encontrado, permitiendo login");

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

    console.log(`💾 Sesión temporal guardada: ${sessionId} (expira en 5 min)`);
    console.log(`📊 Sesiones activas en memoria: ${pendingOAuthSessions.size}`);

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

    console.log(`📝 Completando registro con session_id: ${session_id}`);

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

    console.log(`✅ Sesión encontrada para usuario: ${session.email}`);

    // Extraer nombre del metadata
    const firstName =
      user_metadata?.["full_name"]?.split(" ")[0] ||
      user_metadata?.["name"]?.split(" ")[0] ||
      "Usuario";
    const lastName =
      user_metadata?.["full_name"]?.split(" ").slice(1).join(" ") ||
      user_metadata?.["name"]?.split(" ").slice(1).join(" ") ||
      "";

    try {
      // Crear usuario en la tabla users
      console.log("🆕 Creando usuario en la base de datos con todos los datos");

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          id: supabase_user_id,
          first_name: firstName,
          last_name: lastName,
          profile_code: "cliente_registrado",
          profile_image:
            user_metadata?.["avatar_url"] || user_metadata?.["picture"] || null,
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

      console.log("✅ Usuario creado exitosamente con todos los datos");

      // Eliminar sesión de memoria
      pendingOAuthSessions.delete(session_id);
      console.log(`🧹 Sesión ${session_id} eliminada de memoria`);
      console.log(
        `📊 Sesiones activas restantes: ${pendingOAuthSessions.size}`,
      );

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
