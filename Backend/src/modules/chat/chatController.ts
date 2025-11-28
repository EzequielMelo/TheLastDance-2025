import { Request, Response } from "express";
import { ChatServices } from "./chatServices";
import { supabaseAdmin } from "../../config/supabase";
import {
  notifyWaitersNewClientMessage,
  notifyWaiterClientMessage,
  notifyClientWaiterMessage,
} from "../../services/pushNotificationService";

export class ChatController {
  // Obtener o crear chat para una mesa
  static async getOrCreateChat(req: Request, res: Response): Promise<Response> {
    try {
      const { tableId } = req.params;
      const userId = req.user?.appUserId;

      if (!userId || !tableId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado o mesa no especificada",
        });
      }

      // Obtener información de la mesa para encontrar cliente y mesero
      const { data: tableData, error: tableError } = await supabaseAdmin
        .from("tables")
        .select("id_client, id_waiter")
        .eq("id", tableId)
        .single();

      if (tableError || !tableData.id_client || !tableData.id_waiter) {
        return res.status(400).json({
          success: false,
          message: "Mesa no válida o sin cliente/mesero asignado",
        });
      }

      // Verificar que el usuario es el cliente o el mesero de esta mesa
      if (userId !== tableData.id_client && userId !== tableData.id_waiter) {
        return res.status(403).json({
          success: false,
          message: "No tienes acceso a este chat",
        });
      }

      await ChatServices.getOrCreateChat(
        tableId,
        tableData.id_client,
        tableData.id_waiter,
      );

      const chatWithDetails = await ChatServices.getChatByTableId(tableId);

      return res.json({
        success: true,
        data: chatWithDetails,
      });
    } catch (error) {
      console.error("Error en getOrCreateChat:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // Obtener mensajes de un chat
  static async getMessages(req: Request, res: Response): Promise<Response> {
    try {
      const { chatId } = req.params;
      const { limit = "50" } = req.query;
      const userId = req.user?.appUserId;

      if (!userId || !chatId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado o chat no especificado",
        });
      }

      const messages = await ChatServices.getMessages(
        chatId,
        parseInt(limit as string),
      );

      return res.json({
        success: true,
        data: messages,
      });
    } catch (error) {
      console.error("Error en getMessages:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // Marcar mensajes como leídos
  static async markAsRead(req: Request, res: Response): Promise<Response> {
    try {
      const { chatId } = req.params;
      const userId = req.user?.appUserId;

      if (!userId || !chatId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado o chat no especificado",
        });
      }

      await ChatServices.markMessagesAsRead(chatId, userId);

      return res.json({
        success: true,
        message: "Mensajes marcados como leídos",
      });
    } catch (error) {
      console.error("Error en markAsRead:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // Obtener chats activos del mesero
  static async getWaiterChats(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.appUserId;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }

      // Verificar que es mesero
      if (req.user?.position_code !== "mozo") {
        return res.status(403).json({
          success: false,
          message: "Solo los meseros pueden acceder a esta función",
        });
      }

      const chats = await ChatServices.getWaiterActiveChats(userId);

      return res.json({
        success: true,
        data: chats,
      });
    } catch (error) {
      console.error("Error en getWaiterChats:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }

  // Enviar mensaje
  static async sendMessage(req: Request, res: Response): Promise<Response> {
    try {
      const { tableId } = req.params;
      const { message } = req.body;
      const userId = req.user?.appUserId;

      if (!userId || !tableId || !message) {
        return res.status(400).json({
          success: false,
          message: "Datos incompletos",
        });
      }

      // Obtener información de la mesa
      const { data: tableData, error: tableError } = await supabaseAdmin
        .from("tables")
        .select("id_client, id_waiter, number")
        .eq("id", tableId)
        .single();

      if (tableError || !tableData.id_client || !tableData.id_waiter) {
        return res.status(400).json({
          success: false,
          message: "Mesa no válida o sin cliente/mesero asignado",
        });
      }

      // Verificar que el usuario es el cliente o el mesero de esta mesa
      if (userId !== tableData.id_client && userId !== tableData.id_waiter) {
        return res.status(403).json({
          success: false,
          message: "No tienes acceso a este chat",
        });
      }

      // Determinar tipo de remitente
      const senderType = userId === tableData.id_client ? "client" : "waiter";

      // Obtener o crear el chat
      const chat = await ChatServices.getOrCreateChat(
        tableId,
        tableData.id_client,
        tableData.id_waiter,
      );

      // Crear el mensaje PRIMERO
      const newMessage = await ChatServices.createMessage(
        chat.id,
        userId,
        senderType,
        message,
      );

      console.log(`✅ Mensaje creado: ${newMessage.id} - Tipo: ${senderType}`);

      // NOTIFICACIONES TIPO WHATSAPP - Enviar después de crear el mensaje
      if (senderType === "client") {
        // Cliente envía mensaje al mozo específico
        try {
          // Obtener nombre del cliente para la notificación
          const { data: clientData, error: clientError } = await supabaseAdmin
            .from("users")
            .select("first_name, last_name")
            .eq("id", tableData.id_client)
            .single();

          if (clientError) {
            console.error("❌ Error obteniendo datos del cliente:", clientError);
          }

          const clientName = clientData
            ? `${clientData.first_name} ${clientData.last_name}`.trim()
            : "Cliente";

          console.log(`📤 Enviando notificación al mozo ${tableData.id_waiter} - Cliente: ${clientName}`);

          // Verificar si es el primer mensaje del cliente (para enviar a todos los mozos)
          const { data: previousMessages, error: messagesError } = await supabaseAdmin
            .from("messages")
            .select("id")
            .eq("chat_id", chat.id)
            .eq("sender_type", "client")
            .limit(2); // Límite 2 para incluir el que acabamos de crear

          if (messagesError) {
            console.error("❌ Error verificando mensajes previos:", messagesError);
          }

          const isFirstMessage = previousMessages && previousMessages.length === 1;

          console.log(`🔍 Es primer mensaje del cliente? ${isFirstMessage} (Total mensajes cliente: ${previousMessages?.length || 0})`);

          if (isFirstMessage) {
            // Si es el primer mensaje, notificar a TODOS los mozos
            console.log(`📢 Primer mensaje del cliente - Notificando a TODOS los mozos`);
            await notifyWaitersNewClientMessage(
              clientName,
              tableData.number.toString(),
              message,
            );
          } else {
            // Si no es el primer mensaje, solo notificar al mozo específico
            console.log(`📱 Mensaje subsecuente - Notificando solo al mozo asignado`);
            await notifyWaiterClientMessage(
              tableData.id_waiter,
              clientName,
              tableData.number.toString(),
              message,
              chat.id,
            );
          }

          console.log(`✅ Notificación enviada exitosamente`);
        } catch (notifyError) {
          console.error(
            "❌ Error enviando notificaciones de cliente:",
            notifyError,
          );
          // No bloqueamos el envío del mensaje por error de notificación
        }
      } else if (senderType === "waiter") {
        // Mozo envía mensaje al cliente
        try {
          // Obtener nombre del mozo para la notificación
          const { data: waiterData, error: waiterError } = await supabaseAdmin
            .from("users")
            .select("first_name, last_name")
            .eq("id", userId)
            .single();

          if (waiterError) {
            console.error("❌ Error obteniendo datos del mozo:", waiterError);
          }

          const waiterName = waiterData
            ? `${waiterData.first_name} ${waiterData.last_name}`.trim()
            : "Mesero";

          console.log(`📤 Enviando notificación al cliente ${tableData.id_client} - Mozo: ${waiterName}`);

          // Enviar notificación al cliente específico (tipo WhatsApp)
          await notifyClientWaiterMessage(
            tableData.id_client,
            waiterName,
            tableData.number.toString(),
            message,
            chat.id,
          );

          console.log(`✅ Notificación enviada exitosamente al cliente`);
        } catch (notifyError) {
          console.error("❌ Error enviando notificación de mozo:", notifyError);
          // No bloqueamos el envío del mensaje por error de notificación
        }
      }

      return res.json({
        success: true,
        data: newMessage,
        message: "Mensaje enviado exitosamente",
      });
    } catch (error) {
      console.error("Error en sendMessage:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
      });
    }
  }
}
