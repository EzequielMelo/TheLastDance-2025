import { Server } from "socket.io";
import { DeliveryChatServices } from "../modules/delivery/deliveryChatServices";

interface SocketUser {
  appUserId: string;
  profile_code: string;
  position_code?: string;
  first_name: string;
  last_name: string;
  profile_image?: string;
}

/**
 * Configura los listeners de Socket.IO para el chat de delivery
 * Similar a chatSocket pero adaptado para delivery (cliente-repartidor)
 */
export const setupDeliveryChatSocket = (io: Server) => {
  io.on("connection", socket => {
    const user = socket.data.user as SocketUser;

    // Usuario se une al chat de un delivery
    socket.on("join_delivery_chat", async (deliveryChatId: string) => {
      try {
        const roomName = `delivery_chat_${deliveryChatId}`;

        // Verificar que el usuario puede acceder a este chat
        const chat = await DeliveryChatServices.getChatById(deliveryChatId);
        if (!chat) {
          socket.emit("error", { message: "Chat no encontrado" });
          return;
        }

        // Verificar que el usuario es el cliente o el repartidor del delivery
        const isClient = chat.client_id === user.appUserId;
        const isDriver = chat.driver_id === user.appUserId;

        if (!isClient && !isDriver) {
          socket.emit("error", { message: "No tienes acceso a este chat" });
          return;
        }

        socket.join(roomName);

        // Notificar a otros en la sala que se unió
        socket.to(roomName).emit("user_joined_delivery", {
          userId: user.appUserId,
          userName: `${user.first_name} ${user.last_name}`,
          userType: isClient ? "client" : "driver",
        });

        console.log(
          `✅ Usuario ${user.first_name} se unió al chat de delivery ${deliveryChatId} [Sala: ${roomName}] [Socket: ${socket.id}]`,
        );

        // Debug: mostrar cuántos usuarios hay en la sala
        const roomClients = io.sockets.adapter.rooms.get(roomName);
        const userCount = roomClients?.size || 0;
        console.log(`👥 Usuarios en sala ${roomName}: ${userCount}`);

        // Confirmar al cliente que se unió exitosamente
        socket.emit("joined_delivery_room", {
          roomName,
          userCount,
          deliveryChatId,
        });
      } catch (error) {
        console.error("Error al unirse al chat de delivery:", error);
        socket.emit("error", {
          message: "Error al unirse al chat de delivery",
        });
      }
    });

    // Enviar mensaje en delivery chat
    socket.on(
      "send_delivery_message",
      async (data: { deliveryChatId: string; message: string }) => {
        try {
          const { deliveryChatId, message } = data;

          if (!message.trim()) {
            console.log("❌ Mensaje vacío rechazado");
            socket.emit("error", {
              message: "El mensaje no puede estar vacío",
            });
            return;
          }

          // Verificar que el chat existe y está activo
          const chat = await DeliveryChatServices.getChatById(deliveryChatId);
          if (!chat) {
            socket.emit("error", { message: "Chat no encontrado" });
            return;
          }

          if (!chat.is_active) {
            console.log("❌ Chat de delivery inactivo");
            socket.emit("error", {
              message: "Este chat ya no está activo (el pedido fue entregado)",
            });
            return;
          }

          // Verificar que el usuario es parte del chat
          const isClient = chat.client_id === user.appUserId;
          const isDriver = chat.driver_id === user.appUserId;

          if (!isClient && !isDriver) {
            socket.emit("error", { message: "No tienes acceso a este chat" });
            return;
          }

          // Guardar mensaje en base de datos
          const newMessage = await DeliveryChatServices.createMessage(
            deliveryChatId,
            user.appUserId,
            message.trim(),
          );

          // Obtener mensaje completo con datos del sender
          const messages = await DeliveryChatServices.getMessages(
            deliveryChatId,
            1,
          );
          const messageWithSender = messages[0]; // El mensaje recién creado

          if (!messageWithSender) {
            throw new Error("No se pudo obtener el mensaje creado");
          }

          // Enviar mensaje a todos en la sala
          const messageData = {
            id: messageWithSender.id,
            message: messageWithSender.message,
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
          const roomName = `delivery_chat_${deliveryChatId}`;
          console.log("📡 Emitiendo mensaje de delivery a sala:", roomName);
          io.to(roomName).emit("new_delivery_message", messageData);

          // También confirmar al remitente
          socket.emit("delivery_message_sent", {
            messageId: newMessage.id,
            success: true,
          });

          // TODO: Implementar notificaciones push para delivery chat
          // Similar a las notificaciones de chat mesero-cliente
        } catch (error) {
          console.error("💥 Error al enviar mensaje de delivery:", error);
          console.error(
            "Stack trace:",
            error instanceof Error ? error.stack : "Sin stack",
          );
          socket.emit("error", { message: "Error al enviar mensaje" });
        }
      },
    );

    // Marcar mensajes como leídos en delivery chat
    socket.on(
      "mark_delivery_as_read",
      async (data: { deliveryChatId: string }) => {
        try {
          const { deliveryChatId } = data;

          await DeliveryChatServices.markMessagesAsRead(
            deliveryChatId,
            user.appUserId,
          );

          // Notificar a otros en la sala
          socket
            .to(`delivery_chat_${deliveryChatId}`)
            .emit("delivery_messages_read", {
              readByUserId: user.appUserId,
              readByName: `${user.first_name} ${user.last_name}`,
            });

          console.log(
            `✅ Usuario ${user.first_name} marcó mensajes como leídos en chat ${deliveryChatId}`,
          );
        } catch (error) {
          console.error("Error al marcar como leído en delivery chat:", error);
          socket.emit("error", {
            message: "Error al marcar mensajes como leídos",
          });
        }
      },
    );

    // Evento para notificar que el chat de delivery se desactivó (pedido entregado)
    socket.on("leave_delivery_chat", (deliveryChatId: string) => {
      const roomName = `delivery_chat_${deliveryChatId}`;
      socket.leave(roomName);
      console.log(
        `👋 Usuario ${user.first_name} salió del chat de delivery ${deliveryChatId} [Socket: ${socket.id}]`,
      );
    });
  });

  console.log("✅ Socket.IO para delivery chat configurado");
};

/**
 * Emitir evento cuando un chat de delivery se desactiva (pedido entregado)
 * Llamar desde deliveryController al completar entrega
 */
export const notifyDeliveryChatClosed = (
  io: Server,
  deliveryChatId: string,
) => {
  const roomName = `delivery_chat_${deliveryChatId}`;
  io.to(roomName).emit("delivery_chat_closed", {
    deliveryChatId,
    message: "El pedido ha sido entregado. Este chat ya no está disponible.",
  });
  console.log(`📪 Chat de delivery ${deliveryChatId} cerrado y notificado`);
};
