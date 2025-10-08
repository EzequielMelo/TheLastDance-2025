import { useState } from "react";
import { AxiosError } from "axios";
import { useAuth } from "./useAuth"; // Usa el básico
import {
  loginUser,
  registerUser,
  LoginCredentials,
  RegisterData,
} from "../services/userData";

export const useAuthActions = () => {
  const {
    login: contextLogin,
    logout: contextLogout,
    ...authState
  } = useAuth();

  // Estados específicos de formularios/UI
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      setServerError(null);
      setLoading(true);

      const response = await loginUser(credentials);

      const token = response?.session?.access_token;
      if (!token) throw new Error("No se recibió un token válido");

      await contextLogin(token, response.user);

      return { success: true };
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error || err.message || "Error inesperado";
      setServerError(errorMessage);

      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (userData: RegisterData | FormData) => {
    try {
      setActionError(null);
      setActionLoading(true);

      const response = await registerUser(userData);

      // IMPORTANTE: Limpiar error si fue exitoso
      setActionError(null);

      return { success: true, data: response };
    } catch (err) {
      const error = err as Error;
      const errorMessage = error.message || "Error al registrarse";
      setActionError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setActionLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoading(true);
      await contextLogout();
      return { success: true };
    } catch (err) {
      console.warn("Error durante logout:", err);
      return { success: false };
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => setServerError(null);

  return {
    // Estado del contexto (user, token, isLoading, isAuthenticated)
    ...authState,

    // Estados específicos de UI
    actionLoading: loading, // Para diferenciar del isLoading del contexto
    actionError: serverError,

    // Acciones
    handleLogin,
    handleRegister,
    handleLogout,
    clearError,
  };
};
