import api from "../api/axios";
import { User } from "../types/User";

// Tipos para las respuestas del servidor
interface LoginResponse {
  session: {
    access_token: string;
  };
  user: User;
}

interface RegisterResponse {
  session: {
    access_token: string;
  };
  user: User;
}

// Credenciales de login
export interface LoginCredentials {
  email: string;
  password: string;
}

// Datos de registro
export interface RegisterData {
  email: string;
  password: string;
  name: string;
  // Agregar más campos según tu backend
}

// Servicio de login - Solo lógica de API
export const loginUser = async (
  credentials: LoginCredentials,
): Promise<LoginResponse> => {
  try {
    const response = await api.post<LoginResponse>("/auth/login", credentials);
    return response.data;
  } catch (error) {
    // Re-lanzar error para que lo maneje quien llame al servicio
    throw error;
  }
};

// Servicio de registro - Solo lógica de API
export const registerUser = async (
  userData: RegisterData,
): Promise<RegisterResponse> => {
  try {
    const response = await api.post<RegisterResponse>(
      "/auth/register",
      userData,
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Servicio para obtener perfil del usuario
export const getUserProfile = async (): Promise<User> => {
  try {
    const response = await api.get<User>("/user/profile");
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Servicio para actualizar perfil
export const updateUserProfile = async (
  userData: Partial<User>,
): Promise<User> => {
  try {
    const response = await api.put<User>("/user/profile", userData);
    return response.data;
  } catch (error) {
    throw error;
  }
};

// Servicio de logout (si tu backend lo requiere)
export const logoutUser = async (): Promise<void> => {
  try {
    await api.post("/auth/logout");
  } catch (error) {
    // Logout local aún si falla el servidor
    console.warn("Error en logout del servidor:", error);
  }
};
