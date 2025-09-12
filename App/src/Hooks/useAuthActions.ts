import { useState } from "react";
import { AxiosError } from "axios";
import { useAuth } from "../auth/useAuth"; // Usa el básico
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
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (credentials: LoginCredentials) => {
    try {
      setError(null);
      setLoading(true);

      const response = await loginUser(credentials);
      await contextLogin(response.session.access_token, response.user);

      return { success: true };
    } catch (err) {
      const error = err as AxiosError<{ error: string }>;
      const errorMessage =
        error.response?.data?.error || "Error al iniciar sesión";

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (userData: RegisterData) => {
    try {
      setError(null);
      setLoading(true);

      const response = await registerUser(userData);
      await contextLogin(response.session.access_token, response.user);

      return { success: true };
    } catch (err) {
      const error = err as AxiosError<{ error: string }>;
      const errorMessage =
        error.response?.data?.error || "Error al registrarse";

      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
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

  const clearError = () => setError(null);

  return {
    // Estado del contexto (user, token, isLoading, isAuthenticated)
    ...authState,

    // Estados específicos de UI
    actionLoading: loading, // Para diferenciar del isLoading del contexto
    actionError: error,

    // Acciones
    handleLogin,
    handleRegister,
    handleLogout,
    clearError,
  };
};
