import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import api from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { SERVER_BASE_URL } from "../api/config";
import type { DeliveryWithOrder } from "../types/Delivery";

export type DeliveryState =
  | "no_delivery" // No tiene delivery activo
  | "pending" // Delivery creado, esperando confirmación
  | "confirmed" // Confirmado por admin, esperando asignación de driver
  | "preparing" // En preparación
  | "ready" // Listo para recoger
  | "on_the_way" // En camino
  | "arrived" // Repartidor llegó al lugar
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
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const isRefreshingRef = useRef(false);

  const checkDeliveryState = useCallback(async () => {
    // Solo usuarios cliente_registrado pueden tener deliveries
    if (!user?.id || user.profile_code !== "cliente_registrado") {
      setState("no_delivery");
      setDelivery(null);
      setHasActiveDelivery(false);
      return;
    }

    if (isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;
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
          case "arrived":
            setState("arrived");
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
      isRefreshingRef.current = false;
    }
  }, [user?.id, user?.profile_code]);

  // Solo ejecutar UNA VEZ al montar el componente
  useEffect(() => {
    let isMounted = true;

    const initializeDeliveryState = async () => {
      if (!isMounted) return;

      if (user?.id && user.profile_code === "cliente_registrado") {
        await checkDeliveryState();
      } else {
        setState("no_delivery");
        setDelivery(null);
        setHasActiveDelivery(false);
      }
    };

    initializeDeliveryState();

    return () => {
      isMounted = false;
    };
  }, []); // Sin dependencias - solo se ejecuta al montar

  // Socket.IO para actualizaciones en tiempo real
  useEffect(() => {
    // Solo conectar si es cliente registrado
    if (!user?.id || !token || user.profile_code !== "cliente_registrado") {
      return;
    }

    // Crear conexión Socket.IO
    const socket = io(SERVER_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("join_user_room", user.id);
      console.log("🔌 Socket.IO conectado para delivery state");
    });

    // Escuchar actualizaciones de delivery
    socket.on("delivery_updated", () => {
      console.log("📦 Recibido evento delivery_updated - refrescando estado");
      checkDeliveryState();
    });

    socket.on("delivery_status_changed", () => {
      console.log(
        "📦 Recibido evento delivery_status_changed - refrescando estado",
      );
      checkDeliveryState();
    });

    socket.on("disconnect", () => {
      console.log("🔌 Socket.IO desconectado de delivery state");
    });

    // Cleanup
    return () => {
      socket.off("delivery_updated");
      socket.off("delivery_status_changed");
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id, token, user?.profile_code]); // Solo reconectar si cambia el usuario

  return {
    state,
    delivery,
    hasActiveDelivery,
    refresh: checkDeliveryState,
    isLoading: state === "loading" || isRefreshingRef.current,
  };
};
