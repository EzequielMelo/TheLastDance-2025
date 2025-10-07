import { RequestHandler } from "express";
import * as authService from "./authServices";
import { supabaseAdmin } from "../config/supabase";
import { updateUserPushToken } from "../services/pushNotificationService";

export const registerUser: RequestHandler = async (req, res) => {
  try {
    if (req.file) {
      console.log("File info:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }
    const result = await authService.registerUser(req.body, req.file);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
};

export const registerAnonymousUser: RequestHandler = async (req, res) => {
  try {
    if (req.file) {
      console.log("File info:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    }
    console.log("=================================");

    const { first_name, last_name } = req.body;
    
    if (!first_name || !last_name) {
      res.status(400).json({ 
        error: "Nombre y apellido son obligatorios" 
      });
      return;
    }

    const result = await authService.registerAnonymousUser(
      { first_name, last_name }, 
      req.file
    );
    
    res.status(201).json(result);
  } catch (error) {
    console.error("Error en registro anónimo:", error);
    res.status(400).json({ error: (error as Error).message });
  }
};

export const loginUser: RequestHandler = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.status(200).json({ message: "Login exitoso", ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";

    res.status(400).json({ error: message });
  }
};

export const checkTokenValidity: RequestHandler = async (req, res) => {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token no proporcionado." });
      return;
    }

    const token = authHeader.slice(7);
    
    // Verificar si es un token anónimo
    if (token.startsWith("anon_")) {
      const parts = token.split("_");
      if (parts.length >= 3) {
        const userId = parts[1];
        
        // Traer perfil desde tu tabla users
        const { data: profile, error: dbErr } = await supabaseAdmin
          .from("users")
          .select("id, first_name, last_name, profile_code, position_code, profile_image")
          .eq("id", userId)
          .eq("profile_code", "cliente_anonimo")
          .single();

        if (dbErr || !profile) {
          res.status(404).json({ error: "Usuario anónimo no encontrado." });
          return;
        }

        res.status(200).json({
          valid: true,
          user: {
            id: profile.id,
            email: null,
            first_name: profile.first_name,
            last_name: profile.last_name,
            profile_code: profile.profile_code,
            position_code: profile.position_code,
            photo_url: profile.profile_image ?? null,
          },
        });
        return;
      }
      
      res.status(401).json({ error: "Token anónimo inválido." });
      return;
    }

    // Token normal de Supabase Auth
    const authUser = await authService.verifyToken(token);

    // 🔍 Traer perfil desde tu tabla users
    const { data: profile, error: dbErr } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, profile_code, position_code, profile_image")
      .eq("id", authUser.id)
      .single();

    if (dbErr || !profile) {
      res.status(404).json({ error: "Perfil no encontrado." });
      return;
    }

    res.status(200).json({
      valid: true,
      user: {
        id: profile.id,
        email: authUser.email ?? null,
        first_name: profile.first_name,
        last_name: profile.last_name,
        profile_code: profile.profile_code,
        position_code: profile.position_code,
        photo_url: profile.profile_image ?? null,
      },
    });
  } catch (err: any) {
    res.status(401).json({
      valid: false,
      error: err?.message || "Token inválido.",
    });
  }
};

export const updatePushToken: RequestHandler = async (req, res) => {
  try {
    console.log('📱 Received updatePushToken request');
    
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      console.log('❌ No bearer token provided');
      res.status(401).json({ error: "Token no proporcionado." });
      return;
    }

    const token = authHeader.slice(7);
    let userId: string;

    // Verificar si es un token anónimo o normal
    if (token.startsWith("anon_")) {
      console.log('🔍 Processing anonymous token');
      const parts = token.split("_");
      if (parts.length >= 3 && parts[1]) {
        userId = parts[1];
        console.log('✅ Anonymous user ID extracted:', userId);
      } else {
        console.log('❌ Invalid anonymous token format');
        res.status(401).json({ error: "Token anónimo inválido." });
        return;
      }
    } else {
      // Token normal de Supabase Auth
      console.log('🔍 Processing Supabase auth token');
      const authUser = await authService.verifyToken(token);
      if (!authUser.id) {
        console.log('❌ No user ID found in token');
        res.status(401).json({ error: "ID de usuario no encontrado." });
        return;
      }
      userId = authUser.id;
      console.log('✅ Supabase user ID extracted:', userId);
    }

    const { pushToken } = req.body;
    console.log('📱 Push token received:', pushToken);
    
    if (!pushToken) {
      console.log('❌ No push token provided in request body');
      res.status(400).json({ error: "Push token es requerido" });
      return;
    }

    // Actualizar el push token usando el servicio
    console.log('🔄 Updating push token for user:', userId);
    await updateUserPushToken(userId, pushToken);
    console.log('✅ Push token updated successfully');

    res.status(200).json({ message: "Push token actualizado exitosamente" });
  } catch (error) {
    console.error("❌ Error en updatePushToken:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};
