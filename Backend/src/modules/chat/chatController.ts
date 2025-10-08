import { Request, Response } from "express";
import { ChatServices } from "./chatServices";
import { supabaseAdmin } from "../../config/supabase";

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
}
