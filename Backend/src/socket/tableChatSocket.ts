import { Server } from "socket.io";
import { ChatServices } from "../modules/chat/chatServices";

interface SocketUser {
  appUserId: string;
  profile_code: string;
  position_code?: string;
  first_name: string;
  last_name: string;
  profile_image?: string;
}

/**
 * Configura los listeners de Socket.IO para el chat de mesas
 * Similar a deliveryChatSocket pero adaptado para mesas (cliente-mesero)
 */
export const setupTableChatSocket = (io: Server) => {
  io.on("connection", socket => {
    const user = socket.data.user as SocketUser;

    // Usuario se une al chat de una mesa
    socket.on("join_table_chat", async (tableId: string) => {
      try {
        console.log(
          `🔵 [TABLE CHAT] Usuario ${user.first_name} ${user.last_name} (${user.appUserId}) intenta unirse a mesa ${tableId}`,
        );
        const roomName = `table_chat_${tableId}`;

        // Verificar que el usuario puede acceder a este chat
        const canAccess = await ChatServices.canAccessChat(
          user.appUserId,
          tableId,
        );
        if (!canAccess) {
          console.log(
            `❌ [TABLE CHAT] Usuario ${user.appUserId} no tiene acceso a mesa ${tableId}`,
          );
          socket.emit("error", { message: "No tienes acceso a este chat" });
          return;
        }

        socket.join(roomName);

        // Debug: mostrar cuántos usuarios hay en la sala
        const roomClients = io.sockets.adapter.rooms.get(roomName);
        const userCount = roomClients?.size || 0;

        console.log(
          `✅ [TABLE CHAT] Usuario ${user.first_name} unido a ${roomName} (${userCount} usuarios)`,
        );

        // Confirmar al cliente que se unió exitosamente
        socket.emit("joined_table_room", {
          roomName,
          userCount,
          tableId,
        });
      } catch (error) {
        console.error(
          "💥 [TABLE CHAT] Error al unirse al chat de mesa:",
          error,
        );
        socket.emit("error", {
          message: "Error al unirse al chat de mesa",
        });
      }
    });

    // Enviar mensaje en table chat
    socket.on(
      "send_table_message",
      async (data: { chatId: string; message: string; tableId: string }) => {
        try {
          console.log(
            `🔵 [TABLE CHAT] Evento send_table_message recibido de ${user.first_name} (${user.appUserId})`,
          );
          console.log(`   Profile: ${user.profile_code}, Data:`, data);

          const { chatId, message, tableId } = data;

          console.log(
            `📤 [TABLE CHAT] Mensaje de ${user.first_name}: "${message.substring(0, 30)}..." en mesa ${tableId}`,
          );

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

          // Verificar que el chat existe y está activo
          const { data: chatExists, error: chatError } =
            await require("../config/supabase")
              .supabaseAdmin.from("chats")
              .select("id, table_id, is_active, client_id, waiter_id")
              .eq("id", chatId)
              .single();

          if (chatError || !chatExists) {
            console.error(
              "❌ [TABLE CHAT] Chat no encontrado:",
              chatId,
              chatError,
            );
            socket.emit("error", { message: "Chat no encontrado" });
            return;
          }

          if (!chatExists.is_active) {
            socket.emit("error", {
              message: "Este chat ya no está activo",
            });
            return;
          }

          // Verificar que el usuario es parte del chat
          const isClient = chatExists.client_id === user.appUserId;
          const isWaiter = chatExists.waiter_id === user.appUserId;

          if (!isClient && !isWaiter) {
            console.log(
              `❌ [TABLE CHAT] Usuario ${user.appUserId} no es parte del chat ${chatId}`,
            );
            socket.emit("error", { message: "No tienes acceso a este chat" });
            return;
          }

          // Guardar mensaje en base de datos
          const newMessage = await ChatServices.createMessage(
            chatId,
            user.appUserId,
            senderType,
            message.trim(),
          );

          // Obtener mensaje completo con datos del sender
          const messages = await ChatServices.getMessages(chatId, 1);
          const messageWithSender = messages[0]; // El mensaje recién creado

          if (!messageWithSender) {
            throw new Error("No se pudo obtener el mensaje creado");
          }

          // Enviar mensaje a todos en la sala
          const messageData = {
            id: messageWithSender.id,
            message: messageWithSender.message_text,
            senderId: messageWithSender.sender_id,
            senderName: messageWithSender.sender_name,
            senderFirstName: messageWithSender.sender_first_name,
            senderLastName: messageWithSender.sender_last_name,
            senderImage: messageWithSender.sender_image,
            senderType: messageWithSender.sender_type,
            timestamp: messageWithSender.created_at,
            isRead: false,
          };

          // Emitir a la sala completa
          const roomName = `table_chat_${tableId}`;
          io.to(roomName).emit("new_table_message", messageData);

          console.log(
            `✅ [TABLE CHAT] Mensaje emitido a sala ${roomName} (${messageData.id})`,
          );

          // También confirmar al remitente
          socket.emit("table_message_sent", {
            messageId: newMessage.id,
            success: true,
          });

          // ENVIAR NOTIFICACIONES PUSH para table chat
          // Solo enviar si el receptor NO está activamente conectado al chat
          try {
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

            // Obtener información de la mesa
            const { supabaseAdmin } = await import("../config/supabase");
            const { data: tableData, error: tableError } = await supabaseAdmin
              .from("tables")
              .select("number, id_client, id_waiter")
              .eq("id", tableId)
              .single();

            if (!tableError && tableData) {
              if (senderType === "client") {
                // Cliente envía mensaje al mozo
                // Obtener datos del cliente por separado
                const { data: clientData } = await supabaseAdmin
                  .from("users")
                  .select("first_name, last_name")
                  .eq("id", tableData.id_client)
                  .single();

                const clientName = clientData
                  ? `${clientData.first_name} ${clientData.last_name}`.trim()
                  : "Cliente";
                const waiterId = tableData.id_waiter;

                // Solo enviar notificación si el mozo NO está en la sala
                if (waiterId && !connectedUserIds.has(waiterId)) {
                  console.log(
                    `   ✅ ENVIANDO notificación push al mozo ${waiterId}`,
                  );
                  const { notifyWaiterClientMessage } = await import(
                    "../services/pushNotificationService"
                  );
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
                if (clientId && !connectedUserIds.has(clientId)) {
                  console.log(
                    `   ✅ ENVIANDO notificación push al cliente ${clientId}`,
                  );
                  const { notifyClientWaiterMessage } = await import(
                    "../services/pushNotificationService"
                  );
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
              "❌ [TABLE CHAT] Error enviando notificaciones push:",
              notifyError,
            );
            // No bloqueamos el mensaje por error de notificación
          }
        } catch (error) {
          console.error(
            "💥 [TABLE CHAT] Error al enviar mensaje de mesa:",
            error,
          );
          console.error(
            "Stack trace:",
            error instanceof Error ? error.stack : "Sin stack",
          );
          socket.emit("error", { message: "Error al enviar mensaje" });
        }
      },
    );

    // Marcar mensajes como leídos en table chat
    socket.on(
      "mark_table_as_read",
      async (data: { chatId: string; tableId: string }) => {
        try {
          const { chatId, tableId } = data;

          console.log(
            `📖 [TABLE CHAT] Usuario ${user.appUserId} marcando mensajes como leídos en chat ${chatId}`,
          );

          await ChatServices.markMessagesAsRead(chatId, user.appUserId);

          // Notificar a otros en la sala
          socket.to(`table_chat_${tableId}`).emit("table_messages_read", {
            readByUserId: user.appUserId,
            readByName: `${user.first_name} ${user.last_name}`,
          });
        } catch (error) {
          console.error(
            "💥 [TABLE CHAT] Error al marcar como leído en table chat:",
            error,
          );
          socket.emit("error", {
            message: "Error al marcar mensajes como leídos",
          });
        }
      },
    );

    // Evento para salir del chat de mesa
    socket.on("leave_table_chat", (tableId: string) => {
      const roomName = `table_chat_${tableId}`;
      socket.leave(roomName);
      console.log(
        `👋 [TABLE CHAT] Usuario ${user.appUserId} salió de ${roomName}`,
      );
    });
  });
};

/**
 * Emitir evento cuando un chat de mesa se desactiva (mesa liberada)
 * Llamar desde tablesController al liberar mesa
 */
export const notifyTableChatClosed = (io: Server, tableId: string) => {
  const roomName = `table_chat_${tableId}`;
  io.to(roomName).emit("table_chat_closed", {
    tableId,
    message: "La mesa ha sido liberada. Este chat ya no está disponible.",
  });
  console.log(`🔒 [TABLE CHAT] Chat de mesa ${tableId} cerrado`);
};
