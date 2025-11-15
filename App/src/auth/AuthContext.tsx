import React, { createContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { User } from "../types/User";
import api from "../api/axios";
import { authEventEmitter, AUTH_EVENTS } from "../utils/eventEmitter";

type AuthContextType = {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  // eslint-disable-next-line no-unused-vars
  login: (token: string, user: User, refreshToken?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAuthToken: () => Promise<string | null>;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  refreshToken: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refreshAuthToken: async () => null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();

    // Escuchar eventos de autenticación
    const handleSessionExpired = () => {
      logout();
    };

    const handleTokenRefreshed = (newToken: string) => {
      setToken(newToken);
    };

    authEventEmitter.on(AUTH_EVENTS.SESSION_EXPIRED, handleSessionExpired);
    authEventEmitter.on(AUTH_EVENTS.TOKEN_REFRESHED, handleTokenRefreshed);

    // Cleanup
    return () => {
      authEventEmitter.off(AUTH_EVENTS.SESSION_EXPIRED, handleSessionExpired);
      authEventEmitter.off(AUTH_EVENTS.TOKEN_REFRESHED, handleTokenRefreshed);
    };
  }, []);

  const loadAuth = async () => {
    try {
      setIsLoading(true);

      // Token desde SecureStore (seguro)
      const storedToken = await SecureStore.getItemAsync("authToken");
      const storedRefreshToken = await SecureStore.getItemAsync("refreshToken");

      // Usuario desde AsyncStorage (no sensible)
      const storedUser = await AsyncStorage.getItem("userData");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setRefreshToken(storedRefreshToken);
        setUser(JSON.parse(storedUser) as User);
      }
    } catch (error) {
      // En caso de error, limpiar datos corruptos
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (
    newToken: string,
    userData: User,
    newRefreshToken?: string,
  ) => {
    try {
      // Token en SecureStore (seguro)
      await SecureStore.setItemAsync("authToken", newToken);

      if (newRefreshToken) {
        await SecureStore.setItemAsync("refreshToken", newRefreshToken);
      }

      // Usuario en AsyncStorage (rápido acceso)
      await AsyncStorage.setItem("userData", JSON.stringify(userData));

      setToken(newToken);
      setRefreshToken(newRefreshToken || null);
      setUser(userData);
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);

      // Si es un usuario anónimo, eliminar de la base de datos
      if (user?.profile_code === "cliente_anonimo" && token) {
        try {
          await api.delete("/auth/anonymous", {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        } catch (error) {
          // Continuar con el logout local aunque falle la eliminación remota
        }
      }

      // Limpiar ambos storages
      await Promise.all([
        SecureStore.deleteItemAsync("authToken"),
        SecureStore.deleteItemAsync("refreshToken"),
        AsyncStorage.removeItem("userData"),
      ]);

      setToken(null);
      setRefreshToken(null);
      setUser(null);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  // Función para renovar el token usando el refresh token
  const refreshAuthToken = async (): Promise<string | null> => {
    try {
      // Si es usuario anónimo, no necesita renovar token
      if (user?.profile_code === "cliente_anonimo") {
        return token;
      }

      if (!refreshToken) {
        return null;
      }

      // Llamar al endpoint de refresh
      const response = await api.post("/auth/refresh", {
        refresh_token: refreshToken,
      });

      const { access_token, refresh_token: newRefreshToken } = response.data;

      // Actualizar tokens en storage y estado
      await SecureStore.setItemAsync("authToken", access_token);
      if (newRefreshToken) {
        await SecureStore.setItemAsync("refreshToken", newRefreshToken);
        setRefreshToken(newRefreshToken);
      }

      setToken(access_token);

      return access_token;
    } catch (error) {
      return null;
    }
  };

  // Función helper para limpiar datos corruptos
  const clearAuthData = async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync("authToken").catch(() => {}),
        SecureStore.deleteItemAsync("refreshToken").catch(() => {}),
        AsyncStorage.removeItem("userData").catch(() => {}),
      ]);
    } catch (error) {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        refreshToken,
        isLoading,
        login,
        logout,
        refreshAuthToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
