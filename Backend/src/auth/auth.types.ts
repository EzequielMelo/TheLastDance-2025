// Usuario base
export interface BaseUserBody {
  first_name: string;
  last_name: string;
  profile_code: string; // FK a user_profiles
  profile_image?: string;
}

// Cliente anónimo
export interface AnonymousUserBody extends BaseUserBody {
  profile_code: "cliente_anonimo";
}

// Cliente registrado
export interface ClientUserBody extends BaseUserBody {
  profile_code: "cliente_registrado";
  email: string;
  password: string;
  dni: string;
  cuil: string;
}

// Empleado
export interface EmployeeUserBody extends BaseUserBody {
  profile_code: "empleado";
  position_code: "maitre" | "mozo" | "cocinero" | "bartender";
  dni: string;
  cuil: string;
}

// Supervisor o dueño
export interface AdminUserBody extends BaseUserBody {
  profile_code: "supervisor" | "dueno";
  dni: string;
  cuil: string;
}

export type CreateUserBody =
  | AnonymousUserBody
  | ClientUserBody
  | EmployeeUserBody
  | AdminUserBody;

export interface AuthUser {
  id: string;
  email?: string | null;
  first_name: string;
  last_name: string;
  profile_code:
    | "dueno"
    | "supervisor"
    | "empleado"
    | "cliente_registrado"
    | "cliente_anonimo";
  position_code?: ("maitre" | "mozo" | "cocinero" | "bartender") | null;
  photo_url?: string | null;
}

// Resultado del login
export interface LoginResult {
  session: {
    access_token: string;
    refresh_token: string;
    token_type?: string;
    expires_in?: number;
  };
  user: AuthUser;
}
