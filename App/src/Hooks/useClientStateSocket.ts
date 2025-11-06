import { useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../auth/useAuth";
import { SERVER_BASE_URL } from "../api/config";
import { Logger } from "../utils/Logger";

interface ClientStateUpdate {
  userId: string;
  status: string;
  table?: any;
  waitingListId?: string;
  position?: number;
}

export const useClientStateSocket = (onStateUpdate: () => void) => {
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token || !user?.id) return;

    Logger.info("🔌 Conectando socket para estado del cliente...");

    const socket: Socket = io(SERVER_BASE_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on("connect", () => {
      Logger.info("✅ Socket de estado del cliente conectado");

      // Unirse a la sala del usuario
      socket.emit("join:client-updates", { userId: user.id });
    });

    socket.on("disconnect", () => {
      Logger.info("❌ Socket de estado del cliente desconectado");
    });

    socket.on("connect_error", error => {
      Logger.error("❌ Error conectando socket de estado:", error.message);
    });

    // Escuchar actualizaciones de estado
    socket.on("client:state-update", (data: ClientStateUpdate) => {
      Logger.info("🔄 Actualización de estado recibida:", data);

      // Trigger refresh del estado
      onStateUpdate();
    });

    // Escuchar asignación de mesa
    socket.on("client:table-assigned", (data: any) => {
      Logger.info("🪑 Mesa asignada:", data);
      onStateUpdate();
    });

    // Escuchar confirmación de entrega
    socket.on("client:delivery-confirmed", (data: any) => {
      Logger.info("📦 Entrega confirmada:", data);
      onStateUpdate();
    });

    // Escuchar solicitud de cuenta
    socket.on("client:bill-requested", (data: any) => {
      Logger.info("💳 Cuenta solicitada:", data);
      onStateUpdate();
    });

    // Cleanup
    return () => {
      Logger.info("🔌 Desconectando socket de estado del cliente");
      socket.emit("leave:client-updates", { userId: user.id });
      socket.disconnect();
    };
  }, [token, user?.id, onStateUpdate]);
};
