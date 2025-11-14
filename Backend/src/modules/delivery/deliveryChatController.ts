import type { Request, Response } from "express";
import { DeliveryChatServices } from "./deliveryChatServices";
import { supabaseAdmin } from "../../config/supabase";

export class DeliveryChatController {
  /**
   * GET /api/delivery-chat/delivery/:deliveryId
   * Obtener o crear chat para un delivery
   */
  static async getOrCreateChatByDelivery(
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const { deliveryId } = req.params;
      const userId = req.user?.appUserId;

      if (!userId || !deliveryId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado o delivery no especificado",
        });
      }

      // Obtener información del delivery
      const { data: deliveryData, error: deliveryError } = await supabaseAdmin
        .from("deliveries")
        .select("user_id, driver_id")
        .eq("id", deliveryId)
        .single();

      if (deliveryError || !deliveryData) {
        return res.status(404).json({
          success: false,
          message: "Delivery no encontrado",
        });
      }

      if (!deliveryData.driver_id) {
        return res.status(400).json({
          success: false,
          message: "El delivery aún no tiene repartidor asignado",
        });
      }

      // Verificar que el usuario es el cliente o el repartidor
      if (
        userId !== deliveryData.user_id &&
        userId !== deliveryData.driver_id
      ) {
        return res.status(403).json({
          success: false,
          message: "No tienes acceso a este chat",
        });
      }

      // Obtener o crear chat
      await DeliveryChatServices.getOrCreateChat(
        deliveryId,
        deliveryData.user_id,
        deliveryData.driver_id,
      );

      const chatWithDetails =
        await DeliveryChatServices.getChatByDeliveryId(deliveryId);

      return res.json({
        success: true,
        chat: chatWithDetails,
      });
    } catch (error: any) {
      console.error("❌ Error en getOrCreateChatByDelivery:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * GET /api/delivery-chat/:chatId/messages
   * Obtener mensajes de un chat
   */
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

      // Verificar que el usuario tiene acceso al chat
      const chat = await DeliveryChatServices.getChatById(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat no encontrado",
        });
      }

      if (userId !== chat.client_id && userId !== chat.driver_id) {
        return res.status(403).json({
          success: false,
          message: "No tienes acceso a este chat",
        });
      }

      const messages = await DeliveryChatServices.getMessages(
        chatId,
        parseInt(limit as string),
      );

      return res.json({
        success: true,
        messages: messages,
      });
    } catch (error: any) {
      console.error("❌ Error en getMessages:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * POST /api/delivery-chat/:chatId/messages
   * Enviar mensaje
   */
  static async sendMessage(req: Request, res: Response): Promise<Response> {
    try {
      const { chatId } = req.params;
      const { message } = req.body;
      const userId = req.user?.appUserId;

      if (!userId || !chatId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado o chat no especificado",
        });
      }

      if (!message || typeof message !== "string" || message.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "El mensaje no puede estar vacío",
        });
      }

      // Verificar acceso al chat
      const chat = await DeliveryChatServices.getChatById(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat no encontrado",
        });
      }

      if (userId !== chat.client_id && userId !== chat.driver_id) {
        return res.status(403).json({
          success: false,
          message: "No tienes acceso a este chat",
        });
      }

      // Crear mensaje
      const newMessage = await DeliveryChatServices.createMessage(
        chatId,
        userId,
        message.trim(),
      );

      // Obtener mensaje con detalles del sender
      const messages = await DeliveryChatServices.getMessages(chatId, 1);
      const messageWithSender = messages[0];

      return res.status(201).json({
        success: true,
        message: messageWithSender || newMessage,
      });
    } catch (error: any) {
      console.error("❌ Error en sendMessage:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * PUT /api/delivery-chat/:chatId/read
   * Marcar mensajes como leídos
   */
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

      // Verificar acceso
      const chat = await DeliveryChatServices.getChatById(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: "Chat no encontrado",
        });
      }

      if (userId !== chat.client_id && userId !== chat.driver_id) {
        return res.status(403).json({
          success: false,
          message: "No tienes acceso a este chat",
        });
      }

      await DeliveryChatServices.markMessagesAsRead(chatId, userId);

      return res.json({
        success: true,
        message: "Mensajes marcados como leídos",
      });
    } catch (error: any) {
      console.error("❌ Error en markAsRead:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * GET /api/delivery-chat/:chatId/unread-count
   * Obtener cantidad de mensajes no leídos
   */
  static async getUnreadCount(req: Request, res: Response): Promise<Response> {
    try {
      const { chatId } = req.params;
      const userId = req.user?.appUserId;

      if (!userId || !chatId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado o chat no especificado",
        });
      }

      const count = await DeliveryChatServices.getUnreadCount(chatId, userId);

      return res.json({
        success: true,
        count: count,
      });
    } catch (error: any) {
      console.error("❌ Error en getUnreadCount:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Error interno del servidor",
      });
    }
  }

  /**
   * GET /api/delivery-chat/my-chats
   * Obtener chats activos del usuario
   */
  static async getMyChats(req: Request, res: Response): Promise<Response> {
    try {
      const userId = req.user?.appUserId;
      const profileCode = req.user?.profile_code;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado",
        });
      }

      // Determinar si es cliente o repartidor
      const userType = profileCode === "empleado" ? "driver" : "client";

      const chats = await DeliveryChatServices.getUserActiveChats(
        userId,
        userType,
      );

      return res.json({
        success: true,
        chats: chats,
      });
    } catch (error: any) {
      console.error("❌ Error en getMyChats:", error);
      return res.status(500).json({
        success: false,
        message: error.message || "Error interno del servidor",
      });
    }
  }
}
