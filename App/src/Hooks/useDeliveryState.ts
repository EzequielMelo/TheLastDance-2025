import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { useAuth } from "../auth/useAuth";
import type { DeliveryWithOrder } from "../types/Delivery";

export type DeliveryState =
  | "no_delivery" // No tiene delivery activo
  | "pending" // Delivery creado, esperando confirmación
  | "confirmed" // Confirmado por admin, esperando asignación de driver
  | "preparing" // En preparación
  | "ready" // Listo para recoger
  | "on_the_way" // En camino
  | "delivered" // Entregado
  | "cancelled" // Cancelado
  | "loading" // Cargando estado
  | "error"; // Error al obtener estado

export interface DeliveryStateData {
  state: DeliveryState;
  delivery: DeliveryWithOrder | null;
  hasActiveDelivery: boolean;
  refresh: () => Promise<void>;
  isLoading: boolean;
}

export const useDeliveryState = (): DeliveryStateData => {
  const [state, setState] = useState<DeliveryState>("loading");
  const [delivery, setDelivery] = useState<DeliveryWithOrder | null>(null);
  const [hasActiveDelivery, setHasActiveDelivery] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();

  const checkDeliveryState = useCallback(async () => {
    // Solo usuarios cliente_registrado pueden tener deliveries
    if (!user?.id || user.profile_code !== "cliente_registrado") {
      setState("no_delivery");
      setDelivery(null);
      setHasActiveDelivery(false);
      return;
    }

    if (isRefreshing) return;

    try {
      setIsRefreshing(true);
      setState("loading");

      const response = await api.get("/deliveries/active");

      if (response.data.success && response.data.hasActiveDelivery) {
        const activeDelivery = response.data.delivery;
        setDelivery(activeDelivery);
        setHasActiveDelivery(true);

        // Mapear el estado del backend al estado del hook
        switch (activeDelivery.status) {
          case "pending":
            setState("pending");
            break;
          case "confirmed":
            setState("confirmed");
            break;
          case "preparing":
            setState("preparing");
            break;
          case "ready":
            setState("ready");
            break;
          case "on_the_way":
            setState("on_the_way");
            break;
          case "delivered":
            setState("delivered");
            break;
          case "cancelled":
            setState("cancelled");
            break;
          default:
            setState("no_delivery");
        }
      } else {
        setState("no_delivery");
        setDelivery(null);
        setHasActiveDelivery(false);
      }
    } catch (error) {
      console.error("❌ Error checking delivery state:", error);
      setState("error");
      setDelivery(null);
      setHasActiveDelivery(false);
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id, user?.profile_code, isRefreshing]);

  useEffect(() => {
    if (user?.id && user.profile_code === "cliente_registrado") {
      checkDeliveryState();
    } else {
      setState("no_delivery");
      setDelivery(null);
      setHasActiveDelivery(false);
    }
  }, [user?.id, user?.profile_code]);

  return {
    state,
    delivery,
    hasActiveDelivery,
    refresh: checkDeliveryState,
    isLoading: state === "loading" || isRefreshing,
  };
};
