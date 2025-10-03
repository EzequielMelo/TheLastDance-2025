import type { RequestHandler } from "express";
import { supabaseAdmin } from "../config/supabase"; // ← usa la key service_role

// Tipar lo que vas a colgar en req.user
declare module "express-serve-static-core" {
  interface Request {
    user?: {
      appUserId: string;
      email: string | null;
      profile_code:
        | "dueno"
        | "supervisor"
        | "empleado"
        | "cliente_registrado"
        | "cliente_anonimo";
      position_code: "maitre" | "mozo" | "cocinero" | "bartender" | null;
    };
  }
}

export const authenticateUser: RequestHandler = async (req, res, next) => {
  try {
    const hdr = (req.headers.authorization || "").trim();
    console.log("AUTH HDR (first 30):", hdr.slice(0, 30)); // 🔍

    if (!hdr.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token no proporcionado." });
      return;
    }

    const token = hdr.slice(7).trim();
    console.log("TOKEN LEN:", token.length);

    // Verificar si es un token anónimo
    if (token.startsWith("anon_")) {
      const parts = token.split("_");
      if (parts.length >= 3) {
        const userId = parts[1];
        
        // Verificar que el usuario anónimo existe
        const { data: profile, error: dbErr } = await supabaseAdmin
          .from("users")
          .select("id, profile_code, position_code")
          .eq("id", userId)
          .eq("profile_code", "cliente_anonimo")
          .single();
        
        if (dbErr || !profile) {
          res.status(403).json({ error: "Usuario anónimo no encontrado." });
          return;
        }

        req.user = {
          appUserId: profile.id,
          email: null,
          profile_code: profile.profile_code,
          position_code: profile.position_code,
        };

        next();
        return;
      }
      
      res.status(401).json({ error: "Token anónimo inválido." });
      return;
    }

    // Token normal de Supabase Auth
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data?.user) {
      console.log("SUPABASE getUser error:", error);
      res.status(401).json({ error: "Token inválido o expirado." });
      return;
    }

    const { data: profile, error: dbErr } = await supabaseAdmin
      .from("users")
      .select("id, profile_code, position_code")
      .eq("id", data.user.id)
      .single();

    if (dbErr || !profile) {
      res.status(403).json({ error: "Perfil no encontrado." });
      return;
    }

    req.user = {
      appUserId: profile.id,
      email: data.user.email ?? null,
      profile_code: profile.profile_code,
      position_code: profile.position_code,
    };

    next();
    return;
  } catch (e) {
    console.error("Auth error:", e);
    res.status(500).json({ error: "Error interno de autenticación." });
    return;
  }
};