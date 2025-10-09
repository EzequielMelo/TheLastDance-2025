import { supabaseAdmin } from "../../config/supabase";
import {
  Chat,
  Message,
  ChatWithDetails,
  MessageWithSender,
} from "./chat.types";

export class ChatServices {
  // Crear o obtener chat existente para una mesa
  static async getOrCreateChat(
    tableId: string,
    clientId: string,
    waiterId: string,
  ): Promise<Chat> {
    try {
      // Primero verificar si ya existe un chat activo para esta mesa
      const { data: existingChat, error: searchError } = await supabaseAdmin
        .from("chats")
        .select("*")
        .eq("table_id", tableId)
        .eq("is_active", true)
        .single();

      if (searchError && searchError.code !== "PGRST116") {
        throw searchError;
      }

      if (existingChat) {
        return existingChat;
      }

      // Si no existe, crear uno nuevo
      const { data: newChat, error: createError } = await supabaseAdmin
        .from("chats")
        .insert({
          table_id: tableId,
          client_id: clientId,
          waiter_id: waiterId,
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      return newChat;
    } catch (error) {
      console.error("Error en getOrCreateChat:", error);
      throw new Error("Error al crear o obtener chat");
    }
  }

  // Obtener chat por ID de mesa
  static async getChatByTableId(
    tableId: string,
  ): Promise<ChatWithDetails | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("chats")
        .select(
          `
          *,
          client:users!chats_client_id_fkey(first_name, last_name, profile_image),
          waiter:users!chats_waiter_id_fkey(first_name, last_name, profile_image),
          table:tables!chats_table_id_fkey(number)
        `,
        )
        .eq("table_id", tableId)
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        client_name: `${data.client.first_name} ${data.client.last_name}`,
        waiter_name: `${data.waiter.first_name} ${data.waiter.last_name}`,
        client_image: data.client.profile_image,
        waiter_image: data.waiter.profile_image,
        table_number: data.table.number,
      };
    } catch (error) {
      console.error("Error en getChatByTableId:", error);
      throw new Error("Error al obtener chat");
    }
  }

  // Obtener mensajes de un chat
  static async getMessages(
    chatId: string,
    limit: number = 50,
  ): Promise<MessageWithSender[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("messages")
        .select(
          `
          *,
          sender:users!messages_sender_id_fkey(first_name, last_name, profile_image)
        `,
        )
        .eq("chat_id", chatId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return (data || [])
        .map(msg => ({
          ...msg,
          sender_name: `${msg.sender.first_name} ${msg.sender.last_name}`,
          sender_first_name: msg.sender.first_name,
          sender_last_name: msg.sender.last_name,
          sender_image: msg.sender.profile_image,
        }))
        .reverse(); // Devolver en orden cronológico
    } catch (error) {
      console.error("Error en getMessages:", error);
      throw new Error("Error al obtener mensajes");
    }
  }

  // Crear mensaje
  static async createMessage(
    chatId: string,
    senderId: string,
    senderType: "client" | "waiter",
    messageText: string,
    messageType: "text" | "image" | "notification" = "text",
  ): Promise<Message> {
    try {
      const { data, error } = await supabaseAdmin
        .from("messages")
        .insert({
          chat_id: chatId,
          sender_id: senderId,
          sender_type: senderType,
          message_text: messageText,
          message_type: messageType,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Actualizar timestamp del chat
      await supabaseAdmin
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", chatId);

      return data;
    } catch (error) {
      console.error("Error en createMessage:", error);
      throw new Error("Error al crear mensaje");
    }
  }

  // Marcar mensajes como leídos
  static async markMessagesAsRead(
    chatId: string,
    userId: string,
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from("messages")
        .update({ is_read: true })
        .eq("chat_id", chatId)
        .neq("sender_id", userId)
        .eq("is_read", false);
    } catch (error) {
      console.error("Error en markMessagesAsRead:", error);
      throw new Error("Error al marcar mensajes como leídos");
    }
  }

  // Desactivar chat (cuando cliente libera mesa)
  static async deactivateChat(tableId: string): Promise<void> {
    try {
      await supabaseAdmin
        .from("chats")
        .update({ is_active: false })
        .eq("table_id", tableId);
    } catch (error) {
      console.error("Error en deactivateChat:", error);
      throw new Error("Error al desactivar chat");
    }
  }

  // Obtener chats activos del mesero
  static async getWaiterActiveChats(
    waiterId: string,
  ): Promise<ChatWithDetails[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("chats")
        .select(
          `
          *,
          client:users!chats_client_id_fkey(first_name, last_name),
          waiter:users!chats_waiter_id_fkey(first_name, last_name),
          table:tables!chats_table_id_fkey(number),
          messages(id, is_read, sender_id)
        `,
        )
        .eq("waiter_id", waiterId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(chat => ({
        ...chat,
        client_name: `${chat.client.first_name} ${chat.client.last_name}`,
        waiter_name: `${chat.waiter.first_name} ${chat.waiter.last_name}`,
        table_number: chat.table.number,
        unread_count: chat.messages.filter(
          (msg: any) => !msg.is_read && msg.sender_id !== waiterId,
        ).length,
      }));
    } catch (error) {
      console.error("Error en getWaiterActiveChats:", error);
      throw new Error("Error al obtener chats del mesero");
    }
  }

  // Verificar si usuario puede acceder al chat
  static async canAccessChat(
    userId: string,
    tableId: string,
  ): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from("chats")
        .select("client_id, waiter_id")
        .eq("table_id", tableId)
        .eq("is_active", true)
        .single();

      if (error) {
        return false;
      }

      return data.client_id === userId || data.waiter_id === userId;
    } catch (error) {
      return false;
    }
  }
}
