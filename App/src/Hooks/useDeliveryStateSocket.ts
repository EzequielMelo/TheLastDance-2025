import { useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../auth/useAuth";
import { SERVER_BASE_URL } from "../api/config";

/**
 * Hook para escuchar actualizaciones de delivery en tiempo real
 */
export function useDeliveryStateSocket(onUpdate: () => void) {
  const { user, token } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user?.id || !token) return;

    // Crear conexión Socket.IO
    const socket = io(SERVER_BASE_URL, {
      auth: { token },
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      // Unirse a la sala del usuario
      socket.emit("join_user_room", user.id);
    });

    // Escuchar actualizaciones de delivery
    socket.on("delivery_updated", data => {
      onUpdate();
    });

    socket.on("delivery_status_changed", data => {
      onUpdate();
    });

    socket.on("disconnect", reason => {});

    // Cleanup
    return () => {
      socket.off("delivery_updated");
      socket.off("delivery_status_changed");
      socket.disconnect();
    };
  }, [user?.id, token, onUpdate]);
}
