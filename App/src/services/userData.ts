import { AxiosError } from "axios";
import api from "../api/axios";
import { User } from "../types/User";
import { API_BASE_URL } from "../api/config";
import * as SecureStore from "expo-secure-store";

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
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  dni: string;
  cuil: string;
  profile_code: string;
  position_code?: string;
}

// Servicio de login - Solo lógica de API
export const loginUser = async (
  credentials: LoginCredentials,
): Promise<LoginResponse> => {
  try {
    const response = await api.post<LoginResponse>("/auth/login", credentials);

    return response.data;
  } catch (error: any) {
    // Re-lanzar error para que lo maneje quien llame al servicio
    throw error as AxiosError<{ error: string }>;
  }
};

// Servicio de registro - Solo lógica de API
export const registerUser = async (userData: RegisterData | FormData) => {
  if (userData instanceof FormData) {
    console.log("Usando fetch para FormData");

    const token = await SecureStore.getItemAsync("authToken");
    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: "POST",
      headers,
      body: userData,
    });

    if (!response.ok) {
      // CAPTURAR EL ERROR ESPECÍFICO
      const errorText = await response.text();
      console.log("Error completo del backend:", errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  } else {
    // Usar axios para JSON
    console.log("Usando axios para JSON");
    const response = await api.post("/auth/register", userData);
    return response.data;
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
