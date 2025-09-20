import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./config";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(
  async config => {
    try {
      const token = await SecureStore.getItemAsync("authToken");
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn("Error obteniendo token:", error);
    }

    if (!(config.data instanceof FormData)) {
      config.headers["Content-Type"] = "application/json";
    }

    console.log(
      `${config.method?.toUpperCase()} ${config.url} - ${config.data instanceof FormData ? "FormData" : "JSON"}`,
    );

    return config;
  },
  error => Promise.reject(error),
);

api.interceptors.response.use(
  response => response,
  error => {
    if (__DEV__) {
      console.log(
        `Error: ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status}`,
      );
    }
    return Promise.reject(error);
  },
);

export const setAuthToken = async (token: string) => {
  try {
    await SecureStore.setItemAsync("authToken", token);
  } catch (error) {
    console.error("Error guardando token:", error);
  }
};

export const clearAuthToken = async () => {
  try {
    await SecureStore.deleteItemAsync("authToken");
  } catch (error) {
    console.error("Error limpiando token:", error);
  }
};

export default api;
