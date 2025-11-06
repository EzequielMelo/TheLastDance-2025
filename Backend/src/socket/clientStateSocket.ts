import { Server } from "socket.io";
import { io } from "../index";

/**
 * Emite una actualización de estado al cliente
 */
export function emitClientStateUpdate(
  userId: string,
  eventType:
    | "client:state-update"
    | "client:table-assigned"
    | "client:delivery-confirmed"
    | "client:bill-requested"
    | "client:payment-confirmed",
  data: any,
) {
  try {
    if (!io) {
      console.warn("⚠️ Socket.IO no está inicializado");
      return;
    }

    // Emitir a la sala del usuario específico
    io.to(`user:${userId}`).emit(eventType, data);

    console.log(`📡 [Socket] Evento ${eventType} emitido al usuario ${userId}`);
  } catch (error) {
    console.error("❌ Error emitiendo evento de estado del cliente:", error);
  }
}

/**
 * Configurar listeners para actualizaciones de cliente
 */
export function setupClientStateSocket(io: Server) {
  io.on("connection", socket => {
    // Cliente se une a su sala de actualizaciones
    socket.on("join:client-updates", ({ userId }: { userId: string }) => {
      socket.join(`user:${userId}`);
      console.log(`✅ Usuario ${userId} unido a sala de actualizaciones`);
    });

    // Cliente abandona su sala de actualizaciones
    socket.on("leave:client-updates", ({ userId }: { userId: string }) => {
      socket.leave(`user:${userId}`);
      console.log(`👋 Usuario ${userId} abandonó sala de actualizaciones`);
    });
  });
}
