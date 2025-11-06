import type { Request, Response } from "express";
import { supabaseAdmin } from "../../config/supabase";
import type { Provider } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Schema para validar el provider
 */
const socialAuthSchema = z.object({
  provider: z.enum(["facebook"]),
  redirectUrl: z.string().url(),
});

/**
 * Schema para el callback
 */
const callbackSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
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
 * Procesa el callback de OAuth y crea/actualiza el usuario
 */
export async function processSocialCallback(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const parsed = callbackSchema.parse(req.body);
    const { access_token, refresh_token } = parsed;

    console.log("📱 Procesando callback de OAuth");

    // Establecer sesión con los tokens recibidos
    const { error: sessionError } = await supabaseAdmin.auth.setSession({
      access_token,
      refresh_token,
    });

    if (sessionError) {
      console.error("❌ Error estableciendo sesión:", sessionError);
      res.status(400).json({
        success: false,
        error: sessionError.message,
      });
      return;
    }

    // Obtener datos del usuario desde Supabase
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

    console.log("👤 Usuario de Supabase obtenido:", supabaseUser.email);

    // Verificar si el usuario ya existe en nuestra base de datos
    const { data: existingUser, error: queryError } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("id", supabaseUser.id)
      .single();

    let user;
    let needsAdditionalInfo = false;

    if (queryError && queryError.code !== "PGRST116") {
      // Error diferente a "no encontrado"
      console.error("❌ Error consultando usuario:", queryError);
      res.status(500).json({
        success: false,
        error: "Error verificando usuario",
      });
      return;
    }

    if (existingUser) {
      // Usuario ya existe, verificar si tiene todos los datos
      console.log("✅ Usuario existente encontrado");
      user = existingUser;

      // Verificar si faltan datos obligatorios
      needsAdditionalInfo =
        !existingUser.dni || !existingUser.cuil || !existingUser.phone;

      console.log("📋 Necesita información adicional:", needsAdditionalInfo);
    } else {
      // Usuario nuevo, crear registro en nuestra base de datos
      console.log("🆕 Creando nuevo usuario en la base de datos");

      const metadata = supabaseUser.user_metadata;
      const firstName =
        metadata?.["full_name"]?.split(" ")[0] ||
        metadata?.["name"]?.split(" ")[0] ||
        "Usuario";
      const lastName =
        metadata?.["full_name"]?.split(" ").slice(1).join(" ") ||
        metadata?.["name"]?.split(" ").slice(1).join(" ") ||
        "Social";

      const { data: newUser, error: insertError } = await supabaseAdmin
        .from("users")
        .insert({
          id: supabaseUser.id,
          email: supabaseUser.email,
          first_name: firstName,
          last_name: lastName,
          profile_code: "cliente_registrado",
          profile_picture:
            metadata?.["avatar_url"] || metadata?.["picture"] || null,
          // Campos que necesitarán completarse
          dni: null,
          cuil: null,
          phone: metadata?.["phone"] || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Error creando usuario:", insertError);
        res.status(500).json({
          success: false,
          error: "Error creando usuario en la base de datos",
        });
        return;
      }

      user = newUser;
      needsAdditionalInfo = true; // Siempre necesita completar DNI y CUIL
      console.log("✅ Usuario creado exitosamente");
    }

    // Responder con los datos del usuario y tokens
    res.json({
      success: true,
      session: {
        access_token,
        refresh_token,
      },
      user,
      needsAdditionalInfo,
      message: needsAdditionalInfo
        ? "Por favor completa tu perfil"
        : "Inicio de sesión exitoso",
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
 * PUT /api/auth/social/complete-profile
 * Completa la información faltante del perfil después de OAuth
 */
export async function completeProfile(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { dni, cuil, phone } = req.body;

    if (!dni || !cuil) {
      res.status(400).json({
        success: false,
        error: "DNI y CUIL son requeridos",
      });
      return;
    }

    const userId = req.user.appUserId;

    console.log(`📝 Completando perfil del usuario ${userId}`);

    // Actualizar usuario con la información adicional
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from("users")
      .update({
        dni,
        cuil,
        phone: phone || null,
      })
      .eq("id", userId)
      .select()
      .single();

    if (updateError) {
      console.error("❌ Error actualizando perfil:", updateError);
      res.status(500).json({
        success: false,
        error: "Error actualizando perfil",
      });
      return;
    }

    console.log("✅ Perfil completado exitosamente");

    res.json({
      success: true,
      user: updatedUser,
      message: "Perfil completado exitosamente",
    });
  } catch (error: any) {
    console.error("❌ Error en completeProfile:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Error completando perfil",
    });
  }
}
