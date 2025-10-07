import type { RequestHandler } from "express";

export const roleGuard = (
  allowed: Array<
    "dueno" | "supervisor" | "maitre" | "mozo" | "cocinero" | "bartender"
  >,
): RequestHandler => {
  const handler: RequestHandler = (req, res, next) => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // Verificar si el usuario tiene uno de los roles permitidos
    // Los roles pueden estar en profile_code (dueno, supervisor) o position_code (maitre, mozo, etc.)
    const hasPermission =
      allowed.includes(user.profile_code as any) ||
      (user.position_code && allowed.includes(user.position_code as any));

    if (!hasPermission) {
      console.log(
        `🔒 Access denied - User: ${user.profile_code}/${user.position_code}, Required: ${allowed.join(", ")}`,
      );
      res.status(403).json({ error: "No autorizado" });
      return;
    }

    next();
  };

  return handler;
};
