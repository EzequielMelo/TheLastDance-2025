import type { RequestHandler } from "express";

export const roleGuard = (allowed: Array<"dueno" | "supervisor">): RequestHandler => {
  const handler: RequestHandler = (req, res, next) => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    if (!allowed.includes(user.profile_code as any)) {
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    next();
  };

  return handler;
};