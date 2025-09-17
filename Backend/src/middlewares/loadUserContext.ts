import { Request, Response, NextFunction } from "express";
import { supabaseAdmin } from "../config/supabase";

export const loadUserContext = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authLocal = res.locals["user"] as { id?: string } | undefined;
    if (!authLocal?.id) {
      res.status(401).json({ error: "Usuario no autenticado." });
      return;
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("id, position_code")
      .eq("id", authLocal.id)
      .single();

    if (error || !data) {
      res.status(403).json({ error: "Perfil no encontrado." });
      return;
    }

    req.user = {
      appUserId: data.id,
      position_code: data.position_code ?? "",
    };

    return next();
  } catch (e) {
    return next(e as Error);
  }
};