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

    const { first_name, last_name } = req.body;

    if (!first_name || !last_name) {
      res.status(400).json({
        error: "Nombre y apellido son obligatorios",
      });
      return;
    }

    const result = await authService.registerAnonymousUser(
      { first_name, last_name },
      req.file,
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

        // Verificar expiración solo para tokens no permanentes
        const isPermanent = parts.length >= 4 && parts[3] === "permanent";

        if (!isPermanent && parts[2]) {
          const timestamp = parseInt(parts[2]);
          if (!isNaN(timestamp)) {
            const now = Date.now();
            const hoursPassed = (now - timestamp) / (1000 * 60 * 60);

            if (hoursPassed > 24) {
              res.status(401).json({ error: "Token anónimo expirado." });
              return;
            }
          }
        }

        // Traer perfil desde tu tabla users
        const { data: profile, error: dbErr } = await supabaseAdmin
          .from("users")
          .select(
            "id, first_name, last_name, profile_code, position_code, profile_image",
          )
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
      .select(
        "id, first_name, last_name, profile_code, position_code, profile_image",
      )
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

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token no proporcionado." });
      return;
    }

    const token = authHeader.slice(7);
    let userId: string;

    // Verificar si es un token anónimo o normal
    if (token.startsWith("anon_")) {
      const parts = token.split("_");
      if (parts.length >= 3 && parts[1]) {
        // Verificar expiración solo para tokens no permanentes
        const isPermanent = parts.length >= 4 && parts[3] === "permanent";

        if (!isPermanent && parts[2]) {
          const timestamp = parseInt(parts[2]);
          if (!isNaN(timestamp)) {
            const now = Date.now();
            const hoursPassed = (now - timestamp) / (1000 * 60 * 60);

            if (hoursPassed > 24) {
              res.status(401).json({ error: "Token anónimo expirado." });
              return;
            }
          }
        }

        userId = parts[1];
      } else {
        res.status(401).json({ error: "Token anónimo inválido." });
        return;
      }
    } else {
      // Token normal de Supabase Auth
      const authUser = await authService.verifyToken(token);
      if (!authUser.id) {
        res.status(401).json({ error: "ID de usuario no encontrado." });
        return;
      }
      userId = authUser.id;
    }

    const { pushToken } = req.body;

    if (!pushToken) {
      res.status(400).json({ error: "Push token es requerido" });
      return;
    }

    // Actualizar el push token usando el servicio
    await updateUserPushToken(userId, pushToken);

    res.status(200).json({ message: "Push token actualizado exitosamente" });
  } catch (error) {
    console.error("❌ Error en updatePushToken:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
};

export const refreshToken: RequestHandler = async (req, res) => {
  try {

    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: "Refresh token es requerido" });
      return;
    }

    const result = await authService.refreshToken(refresh_token);

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error en refreshToken:", error);
    res.status(401).json({ error: (error as Error).message });
  }
};

export const deleteAnonymousUser: RequestHandler = async (req, res) => {
  try {

    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token no proporcionado." });
      return;
    }

    const token = authHeader.slice(7);

    // Verificar que es un token anónimo
    if (!token.startsWith("anon_")) {
      res
        .status(400)
        .json({ error: "Solo usuarios anónimos pueden usar este endpoint." });
      return;
    }

    const parts = token.split("_");
    if (parts.length < 3 || !parts[1]) {
      res.status(401).json({ error: "Token anónimo inválido." });
      return;
    }

    const userId = parts[1];

    const result = await authService.deleteAnonymousUser(userId);

    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Error en deleteAnonymousUser:", error);
    res.status(500).json({ error: (error as Error).message });
  }
};
