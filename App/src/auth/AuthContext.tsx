import React, { createContext, useState, useEffect, ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { User } from "../types/User";
import api from "../api/axios";

type AuthContextType = {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  // eslint-disable-next-line no-unused-vars
  login: (token: string, user: User) => Promise<void>; // Cambio a async
  logout: () => Promise<void>; // Cambio a async
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      setIsLoading(true);

      // Token desde SecureStore (seguro)
      const storedToken = await SecureStore.getItemAsync("authToken");

      // Usuario desde AsyncStorage (no sensible)
      const storedUser = await AsyncStorage.getItem("userData");

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser) as User);
      }
    } catch (error) {
      console.error("Error loading auth data:", error);
      // En caso de error, limpiar datos corruptos
      await clearAuthData();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (newToken: string, userData: User) => {
    try {
      // Token en SecureStore (seguro)
      await SecureStore.setItemAsync("authToken", newToken);

      // Usuario en AsyncStorage (rápido acceso)
      await AsyncStorage.setItem("userData", JSON.stringify(userData));

      setToken(newToken);
      setUser(userData);
    } catch (error) {
      console.error("Error saving auth data:", error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      setIsLoading(true);

      // Si es un usuario anónimo, eliminar de la base de datos
      if (user?.profile_code === "cliente_anonimo" && token) {
        console.log('🗑️ Eliminando usuario anónimo del servidor...');
        try {
          await api.delete('/auth/anonymous', {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          console.log('✅ Usuario anónimo eliminado del servidor');
        } catch (error) {
          console.error('❌ Error eliminando usuario anónimo:', error);
          // Continuar con el logout local aunque falle la eliminación remota
        }
      }

      // Limpiar ambos storages
      await Promise.all([
        SecureStore.deleteItemAsync("authToken"),
        AsyncStorage.removeItem("userData"),
      ]);

      setToken(null);
      setUser(null);
    } catch (error) {
      console.error("Error during logout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Función helper para limpiar datos corruptos
  const clearAuthData = async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync("authToken").catch(() => {}),
        AsyncStorage.removeItem("userData").catch(() => {}),
      ]);
    } catch (error) {
      console.warn("Error clearing auth data:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => React.useContext(AuthContext);
