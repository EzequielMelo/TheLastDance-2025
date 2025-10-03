declare global {
  namespace Express {
    interface Request {
      user?: {
        appUserId: string;
        profile_code: "dueno" | "supervisor" | "empleado" | "cliente_registrado" | "cliente_anonimo";
        position_code?: "maitre" | "mozo" | "cocinero" | "bartender" | null;
        email?: string | null;
      };
    }
  }
}

// Hace que este .d.ts sea tratado como un módulo
export {};