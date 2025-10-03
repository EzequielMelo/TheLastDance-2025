import type { BaseUserBody } from "../auth/auth.types";

// Campos comunes para crear staff (empleado/supervisor)
type StaffBase = BaseUserBody & {
  email: string;
  password: string;
  cuil: string;
  dni?: string | null;
};

// Empleado: requiere position_code
export type CreateEmployeeBody = StaffBase & {
  profile_code: "empleado";
  position_code: "maitre" | "mozo" | "cocinero" | "bartender";
};

export type CreateSupervisorBody = StaffBase & {
  profile_code: "supervisor";
};

export type CreateStaffBody = CreateEmployeeBody | CreateSupervisorBody;

// Quién ejecuta la acción
export type Actor = { profile_code: "dueno" } | { profile_code: "supervisor" };