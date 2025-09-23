import { RequestHandler } from "express";
import * as authService from "./authServices";
import { supabaseAdmin } from "../config/supabase";

export const registerUser: RequestHandler = async (req, res) => {
  try {
    console.log("=== REQUEST DEBUG ===");
    console.log("Content-Type:", req.headers["content-type"]);
    console.log("Body keys:", Object.keys(req.body));
    console.log("File received:", !!req.file);

    if (req.file) {
      console.log("File info:", {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
      });
    } else {
      console.log("NO FILE - Body contains:", req.body);
      // Si el archivo viene en body en lugar de req.file, es que no es FormData real
    }
    console.log("====================");

    const result = await authService.registerUser(req.body, req.file);
    res.status(201).json(result);
  } catch (error) {
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
