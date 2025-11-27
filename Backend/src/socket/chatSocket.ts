import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { supabaseAdmin } from "../config/supabase";
import { ChatServices } from "../modules/chat/chatServices";
import {
  notifyWaiterClientMessage,
  notifyClientWaiterMessage,
} from "../services/pushNotificationService";
import { setupClientStateSocket } from "./clientStateSocket";

interface SocketUser {
  appUserId: string;
  profile_code: string;
  position_code?: string;
  first_name: string;
  last_name: string;
  profile_image?: string;
}

export const setupSocketIO = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // En producción, especificar dominios permitidos
      methods: ["GET", "POST"],
      credentials: true,
    },
    // Configuración para evitar conexiones persistentes no deseadas
    pingTimeout: 60000, // 60 segundos para timeout
    pingInterval: 25000, // 25 segundos entre pings
    connectTimeout: 45000, // 45 segundos para timeout de conexión
  });

  // Middleware de autenticación para Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth["token"];

      if (!token) {
        return next(new Error("Token no proporcionado"));
      }

      let userData: SocketUser;

      // Verificar si es token anónimo
      if (token.startsWith("anon_")) {
        const parts = token.split("_");
        if (parts.length >= 3) {
          const userId = parts[1];

          const { data: profile, error } = await supabaseAdmin
            .from("users")
            .select(
              "id, profile_code, position_code, first_name, last_name, profile_image",
            )
            .eq("id", userId)
            .eq("profile_code", "cliente_anonimo")
            .single();

          if (error || !profile) {
            return next(new Error("Usuario anónimo no encontrado"));
          }

          userData = {
            appUserId: profile.id,
            profile_code: profile.profile_code,
            position_code: profile.position_code,
            first_name: profile.first_name,
            last_name: profile.last_name,
            profile_image: profile.profile_image,
          };
        } else {
          return next(new Error("Token anónimo inválido"));
        }
      } else {
        // Token normal de Supabase
        const { data, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !data?.user) {
          return next(new Error("Token inválido"));
        }

        const { data: profile, error: dbErr } = await supabaseAdmin
          .from("users")
          .select(
            "id, profile_code, position_code, first_name, last_name, profile_image",
          )
          .eq("id", data.user.id)
          .single();

        if (dbErr || !profile) {
          return next(new Error("Perfil no encontrado"));
        }

        userData = {
          appUserId: profile.id,
          profile_code: profile.profile_code,
          position_code: profile.position_code,
          first_name: profile.first_name,
          last_name: profile.last_name,
          profile_image: profile.profile_image,
        };
      }

      socket.data.user = userData;

      next();
    } catch (error) {
      next(new Error("Error de autenticación"));
    }
  });

  io.on("connection", socket => {
    const user = socket.data.user as SocketUser;

    console.log(
      `🟢 NUEVA CONEXIÓN Socket.IO - Usuario: ${user.first_name} ${user.last_name} (${user.appUserId}), Profile: ${user.profile_code}, SocketId: ${socket.id}`,
    );

    // Usuario se une a su sala personal para recibir notificaciones
    socket.on("join_user_room", (userId: string) => {
      const userRoom = `user_${userId}`;
      socket.join(userRoom);
      console.log(
        `👤 Usuario ${user.appUserId} unido a sala personal ${userRoom}`,
      );
    });

    // Cliente se une a la sala de su mesa para recibir actualizaciones en tiempo real
    socket.on("join_table_room", (tableId: string) => {
      const tableRoom = `table_${tableId}`;

      console.log(
        `📥 SOLICITUD join_table_room recibida - TableId: ${tableId}, Room: ${tableRoom}`,
      );

      socket.join(tableRoom);

      const roomClients = io.sockets.adapter.rooms.get(tableRoom);
      const clientCount = roomClients?.size || 0;

      console.log(
        `✅ Usuario ${user.first_name} ${user.last_name} (${user.appUserId}) se unió a la sala ${tableRoom}`,
      );
      console.log(`   - Clientes totales en sala ${tableRoom}: ${clientCount}`);

      socket.emit("joined_table_room", { tableId, tableRoom });
    });

    // Cliente o mesero se une al chat de una mesa
    socket.on("join_table_chat", async (tableId: string) => {
      try {
        const roomName = `mesa_${tableId}`;

        // Verificar que el usuario puede acceder a esta mesa
        const canAccess = await ChatServices.canAccessChat(
          user.appUserId,
          tableId,
        );
        if (!canAccess) {
          socket.emit("error", { message: "No tienes acceso a este chat" });
          return;
        }

        socket.join(roomName);

        // Debug: mostrar cuántos usuarios hay en la sala
        const roomClients = io.sockets.adapter.rooms.get(roomName);
        const userCount = roomClients?.size || 0;

        // Confirmar al cliente que se unió exitosamente
        socket.emit("joined_room", {
          roomName,
          userCount,
          tableId,
        });
      } catch (error) {
        console.error("Error al unirse al chat:", error);
        socket.emit("error", { message: "Error al unirse al chat" });
      }
    });

    // Enviar mensaje
    socket.on(
      "send_message",
      async (data: { chatId: string; message: string; tableId: string }) => {
        try {
          const { chatId, message, tableId } = data;

          if (!message.trim()) {
            socket.emit("error", {
              message: "El mensaje no puede estar vacío",
            });
            return;
          }

          // Determinar tipo de usuario
          const senderType =
            user.profile_code === "cliente_anonimo" ||
            user.profile_code === "cliente_registrado"
              ? ("client" as const)
              : ("waiter" as const);

          // Verificar que el chat existe
          const { data: chatExists, error: chatError } = await supabaseAdmin
            .from("chats")
            .select("id, table_id, is_active")
            .eq("id", chatId)
            .single();

          if (chatError) {
            console.error("❌ Error verificando chat:", chatError);
            socket.emit("error", { message: "Chat no encontrado" });
            return;
          }

          if (!chatExists.is_active) {
            socket.emit("error", { message: "Chat no está activo" });
            return;
          }

          // Guardar mensaje en base de datos
          const newMessage = await ChatServices.createMessage(
            chatId,
            user.appUserId,
            senderType,
            message.trim(),
          );

          // Enviar mensaje a todos en la sala
          const messageData = {
            id: newMessage.id,
            message: message.trim(),
            senderId: user.appUserId,
            senderName: `${user.first_name} ${user.last_name}`,
            senderImage: user.profile_image,
            senderType,
            timestamp: new Date().toISOString(),
            isRead: false,
          };

          // Emitir a la sala completa
          const roomName = `mesa_${tableId}`;
          io.to(roomName).emit("new_message", messageData);

          // También confirmar al remitente
          socket.emit("message_sent", {
            messageId: newMessage.id,
            success: true,
          });

          // ENVIAR NOTIFICACIONES PUSH TIPO WHATSAPP
          // Solo enviar si el receptor NO está activamente conectado al chat
          try {
            // Obtener información de la mesa y usuarios
            const { data: tableData, error: tableError } = await supabaseAdmin
              .from("tables")
              .select(
                `
                number,
                id_client,
                id_waiter,
                users!tables_id_client_fkey(name)
              `,
              )
              .eq("id", tableId)
              .single();

            if (!tableError && tableData) {
              // Verificar quién está en la sala del chat
              const roomClients = io.sockets.adapter.rooms.get(roomName);
              const socketsInRoom = roomClients ? Array.from(roomClients) : [];

              // Obtener los IDs de usuarios conectados en la sala
              const connectedUserIds = new Set<string>();
              for (const socketId of socketsInRoom) {
                const socketInstance = io.sockets.sockets.get(socketId);
                if (socketInstance?.data.user) {
                  connectedUserIds.add(socketInstance.data.user.appUserId);
                }
              }

              if (senderType === "client") {
                // Cliente envía mensaje al mozo
                const clientData = (tableData as any).users;
                const clientName = clientData?.name || "Cliente";
                const waiterId = tableData.id_waiter;

                // Solo enviar notificación si el mozo NO está en la sala
                if (!connectedUserIds.has(waiterId)) {
                  await notifyWaiterClientMessage(
                    waiterId,
                    clientName,
                    tableData.number.toString(),
                    message.trim(),
                    chatId,
                  );
                }
              } else if (senderType === "waiter") {
                // Mozo envía mensaje al cliente
                const waiterName =
                  `${user.first_name} ${user.last_name}`.trim();
                const clientId = tableData.id_client;

                // Solo enviar notificación si el cliente NO está en la sala
                if (!connectedUserIds.has(clientId)) {
                  await notifyClientWaiterMessage(
                    clientId,
                    waiterName,
                    tableData.number.toString(),
                    message.trim(),
                    chatId,
                  );
                }
              }
            }
          } catch (notifyError) {
            console.error(
              "❌ Error enviando notificaciones push:",
              notifyError,
            );
            // No bloqueamos el mensaje por error de notificación
          }
        } catch (error) {
          console.error("💥 Error completo al enviar mensaje:", error);
          console.error(
            "Stack trace:",
            error instanceof Error ? error.stack : "Sin stack",
          );
          socket.emit("error", { message: "Error al enviar mensaje" });
        }
      },
    );

    // Marcar mensajes como leídos
    socket.on(
      "mark_as_read",
      async (data: { chatId: string; tableId: string }) => {
        try {
          const { chatId, tableId } = data;

          await ChatServices.markMessagesAsRead(chatId, user.appUserId);

          // Notificar a otros en la sala
          socket.to(`mesa_${tableId}`).emit("messages_read", {
            readByUserId: user.appUserId,
            readByName: `${user.first_name} ${user.last_name}`,
          });
        } catch (error) {
          console.error("Error al marcar como leído:", error);
          socket.emit("error", {
            message: "Error al marcar mensajes como leídos",
          });
        }
      },
    );

    // Usuario se desconecta
    socket.on("disconnect", reason => {
      console.log(
        `🔴 Usuario ${user.first_name} ${user.last_name} desconectado del chat [Razón: ${reason}] [ID: ${socket.id}]`,
      );
    });
  });

  // Mostrar estadísticas de conexiones cada minuto (solo en desarrollo)
  if (process.env["NODE_ENV"] !== "production") {
    setInterval(() => {
      const connectedSockets = io.sockets.sockets.size;
      const rooms = Array.from(io.sockets.adapter.rooms.keys()).filter(room =>
        room.startsWith("mesa_"),
      );

      if (connectedSockets > 0) {
        console.log(
          `📊 Socket.IO Stats: ${connectedSockets} conexiones activas, ${rooms.length} salas de chat`,
        );
        if (rooms.length > 0) {
          console.log(`🏠 Salas activas: ${rooms.join(", ")}`);
        }
      }
    }, 60000); // Cada minuto
  }

  // Configurar listeners para actualizaciones de estado de cliente
  setupClientStateSocket(io);

  return io;
};

// Singleton para acceder a la instancia de Socket.IO desde otros módulos
let ioInstance: Server | null = null;

export const setIOInstance = (io: Server) => {
  ioInstance = io;
};

export const getIOInstance = (): Server | null => {
  return ioInstance;
};
