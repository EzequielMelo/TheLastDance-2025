import axios, { AxiosError, AxiosResponse } from "axios";
import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

// Configuración de URLs
const backendUrl =
  Constants.expoConfig?.extra?.backendUrl ||
  process.env.EXPO_PUBLIC_API_URL ||
  "http://10.0.2.2:3000/api"; // URL para emulador
// "http://192.168.1.36:3000/api"; // URL por defecto para desarrollo local

// URL de producción comentada para referencia
// "https://proyecto-mobileapp.onrender.com/api";

if (!backendUrl) {
  console.warn("⚠️ No se pudo determinar la URL del backend");
}

// Crear instancia de Axios
const api = axios.create({
  baseURL: backendUrl,
  timeout: 10000, // 10 segundos timeout
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de Request - Agregar token automáticamente
api.interceptors.request.use(
  async config => {
    try {
      // Obtener token del almacenamiento seguro
      const token = await SecureStore.getItemAsync("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn("Error obteniendo token:", error);
    }

    // Log para desarrollo
    if (__DEV__) {
      console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  error => {
    return Promise.reject(error);
  },
);

// Interceptor de Response - Manejo de errores global
api.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log para desarrollo
    if (__DEV__) {
      console.log(
        `✅ ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status}`,
      );
    }
    return response;
  },

  async (error: AxiosError) => {
    const originalRequest = error.config as typeof error.config & {
      _retry?: boolean;
    };

    // Log para desarrollo
    if (__DEV__) {
      console.log(
        `❌ ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`,
      );
    }

    // Manejo de error 401 - Token expirado
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        // Limpiar token expirado
        await SecureStore.deleteItemAsync("authToken");
        // Aquí podrías intentar refresh token o redirigir al login
        console.log("Token expirado, limpiando almacenamiento");
      } catch (deleteError) {
        console.warn("Error limpiando token:", deleteError);
      }
    }

    // Manejo de errores de red
    if (!error.response) {
      console.error("Error de red:", error.message);
    }

    return Promise.reject(error);
  },
);

// Función helper para configurar token manualmente
export const setAuthToken = async (token: string) => {
  try {
    await SecureStore.setItemAsync("authToken", token);
  } catch (error) {
    console.error("Error guardando token:", error);
  }
};

// Función helper para limpiar token
export const clearAuthToken = async () => {
  try {
    await SecureStore.deleteItemAsync("authToken");
  } catch (error) {
    console.error("Error limpiando token:", error);
  }
};

// Función helper para obtener información del backend
export const getBackendInfo = () => ({
  url: backendUrl,
  isProduction:
    !backendUrl.includes("localhost") && !backendUrl.includes("192.168"),
  isDevelopment: __DEV__,
});

export default api;
