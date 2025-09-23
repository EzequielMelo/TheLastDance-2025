export interface User {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  profile_code: "dueno" | "supervisor" | "empleado" | "cliente_registrado" | "cliente_anonimo";
  position_code: "maitre" | "mozo" | "cocinero" | "bartender" | null;
  photo_url?: string | null;
}
