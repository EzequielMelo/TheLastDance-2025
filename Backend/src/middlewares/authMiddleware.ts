import { Request, Response, NextFunction } from "express";
import { supabase } from "../config/supabase";

/* Middleware para autenticar usuarios mediante token JWT */
export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Token no proporcionado." });
      return;
    }

    const token = authHeader.split(" ")[1];

    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      res.status(401).json({ error: "Token inválido o expirado." });
      return;
    }

    // Asignar el usuario a `res.locals` para usar en el controlador
    res.locals["user"] = {
      id: data.user.id,
      email: data.user.email,
      full: data.user, // podés guardar el objeto completo si querés
    };

    next();
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ error: "Error interno de autenticación." });
  }
};
