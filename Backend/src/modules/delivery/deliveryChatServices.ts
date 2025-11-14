import { supabaseAdmin } from "../../config/supabase";
import type {
  DeliveryChat,
  DeliveryChatMessage,
  DeliveryChatWithDetails,
  DeliveryChatMessageWithSender,
} from "./deliveryChat.types";

export class DeliveryChatServices {
  /**
   * Crear o obtener chat existente para un delivery
   */
  static async getOrCreateChat(
    deliveryId: string,
    clientId: string,
    driverId: string,
  ): Promise<DeliveryChat> {
    try {
      console.log("🔍 Buscando chat para delivery:", deliveryId);

      // Verificar si ya existe un chat activo para este delivery
      const { data: existingChat, error: searchError } = await supabaseAdmin
        .from("delivery_chats")
        .select("*")
        .eq("delivery_id", deliveryId)
        .eq("is_active", true)
        .single();

      if (searchError && searchError.code !== "PGRST116") {
        throw searchError;
      }

      if (existingChat) {
        console.log("✅ Chat existente encontrado:", existingChat.id);
        return existingChat;
      }

      // Si no existe, crear uno nuevo
      console.log("📝 Creando nuevo chat de delivery");
      const { data: newChat, error: createError } = await supabaseAdmin
        .from("delivery_chats")
        .insert({
          delivery_id: deliveryId,
          client_id: clientId,
          driver_id: driverId,
          is_active: true,
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }

      console.log("✅ Chat creado:", newChat.id);
      return newChat;
    } catch (error) {
      console.error("❌ Error en getOrCreateChat:", error);
      throw new Error("Error al crear o obtener chat de delivery");
    }
  }

  /**
   * Obtener chat por ID de delivery con detalles
   */
  static async getChatByDeliveryId(
    deliveryId: string,
  ): Promise<DeliveryChatWithDetails | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("delivery_chats")
        .select(
          `
          *,
          client:users!delivery_chats_client_id_fkey(first_name, last_name, profile_image),
          driver:users!delivery_chats_driver_id_fkey(first_name, last_name, profile_image),
          delivery:deliveries!delivery_chats_delivery_id_fkey(delivery_address)
        `,
        )
        .eq("delivery_id", deliveryId)
        .eq("is_active", true)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        client_name: `${data.client.first_name} ${data.client.last_name}`,
        client_first_name: data.client.first_name,
        client_last_name: data.client.last_name,
        client_image: data.client.profile_image,
        driver_name: `${data.driver.first_name} ${data.driver.last_name}`,
        driver_first_name: data.driver.first_name,
        driver_last_name: data.driver.last_name,
        driver_image: data.driver.profile_image,
        delivery_address: data.delivery.delivery_address,
      };
    } catch (error) {
      console.error("❌ Error en getChatByDeliveryId:", error);
      throw new Error("Error al obtener chat de delivery");
    }
  }

  /**
   * Obtener chat por ID con detalles
   */
  static async getChatById(
    chatId: string,
  ): Promise<DeliveryChatWithDetails | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from("delivery_chats")
        .select(
          `
          *,
          client:users!delivery_chats_client_id_fkey(first_name, last_name, profile_image),
          driver:users!delivery_chats_driver_id_fkey(first_name, last_name, profile_image),
          delivery:deliveries!delivery_chats_delivery_id_fkey(delivery_address)
        `,
        )
        .eq("id", chatId)
        .single();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        client_name: `${data.client.first_name} ${data.client.last_name}`,
        client_first_name: data.client.first_name,
        client_last_name: data.client.last_name,
        client_image: data.client.profile_image,
        driver_name: `${data.driver.first_name} ${data.driver.last_name}`,
        driver_first_name: data.driver.first_name,
        driver_last_name: data.driver.last_name,
        driver_image: data.driver.profile_image,
        delivery_address: data.delivery.delivery_address,
      };
    } catch (error) {
      console.error("❌ Error en getChatById:", error);
      throw new Error("Error al obtener chat");
    }
  }

  /**
   * Obtener mensajes de un chat de delivery
   */
  static async getMessages(
    deliveryChatId: string,
    limit: number = 50,
  ): Promise<DeliveryChatMessageWithSender[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from("delivery_chat_messages")
        .select(
          `
          *,
          sender:users!delivery_chat_messages_sender_id_fkey(first_name, last_name, profile_image)
        `,
        )
        .eq("delivery_chat_id", deliveryChatId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      // Obtener info del chat para determinar quién es driver y quién es client
      const chat = await this.getChatById(deliveryChatId);
      if (!chat) {
        throw new Error("Chat no encontrado");
      }

      return (data || [])
        .map(msg => ({
          ...msg,
          sender_name: `${msg.sender.first_name} ${msg.sender.last_name}`,
          sender_first_name: msg.sender.first_name,
          sender_last_name: msg.sender.last_name,
          sender_image: msg.sender.profile_image,
          sender_type: (msg.sender_id === chat.driver_id
            ? "driver"
            : "client") as "client" | "driver",
        }))
        .reverse(); // Orden cronológico
    } catch (error) {
      console.error("❌ Error en getMessages:", error);
      throw new Error("Error al obtener mensajes de delivery");
    }
  }

  /**
   * Crear mensaje en chat de delivery
   */
  static async createMessage(
    deliveryChatId: string,
    senderId: string,
    message: string,
  ): Promise<DeliveryChatMessage> {
    try {
      console.log("💾 Creando mensaje de delivery:", {
        deliveryChatId,
        senderId,
        messagePreview: message.substring(0, 50),
      });

      const { data, error } = await supabaseAdmin
        .from("delivery_chat_messages")
        .insert({
          delivery_chat_id: deliveryChatId,
          sender_id: senderId,
          message,
          is_read: false,
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      console.log("✅ Mensaje creado:", data.id);
      return data;
    } catch (error) {
      console.error("❌ Error en createMessage:", error);
      throw new Error("Error al crear mensaje de delivery");
    }
  }

  /**
   * Marcar mensajes como leídos
   */
  static async markMessagesAsRead(
    deliveryChatId: string,
    userId: string,
  ): Promise<void> {
    try {
      // Marcar como leídos todos los mensajes que NO fueron enviados por el usuario
      const { error } = await supabaseAdmin
        .from("delivery_chat_messages")
        .update({ is_read: true })
        .eq("delivery_chat_id", deliveryChatId)
        .neq("sender_id", userId)
        .eq("is_read", false);

      if (error) {
        throw error;
      }

      console.log("✅ Mensajes marcados como leídos en chat:", deliveryChatId);
    } catch (error) {
      console.error("❌ Error en markMessagesAsRead:", error);
      throw new Error("Error al marcar mensajes como leídos");
    }
  }

  /**
   * Obtener cantidad de mensajes no leídos
   */
  static async getUnreadCount(
    deliveryChatId: string,
    userId: string,
  ): Promise<number> {
    try {
      const { count, error } = await supabaseAdmin
        .from("delivery_chat_messages")
        .select("*", { count: "exact", head: true })
        .eq("delivery_chat_id", deliveryChatId)
        .neq("sender_id", userId)
        .eq("is_read", false);

      if (error) {
        throw error;
      }

      return count || 0;
    } catch (error) {
      console.error("❌ Error en getUnreadCount:", error);
      return 0;
    }
  }

  /**
   * Desactivar chat cuando se completa la entrega
   */
  static async deactivateChat(deliveryId: string): Promise<void> {
    try {
      console.log("🔒 Desactivando chat de delivery:", deliveryId);

      const { error } = await supabaseAdmin
        .from("delivery_chats")
        .update({ is_active: false })
        .eq("delivery_id", deliveryId)
        .eq("is_active", true);

      if (error) {
        throw error;
      }

      console.log("✅ Chat desactivado");
    } catch (error) {
      console.error("❌ Error en deactivateChat:", error);
      throw new Error("Error al desactivar chat de delivery");
    }
  }

  /**
   * Obtener chats activos de un usuario (cliente o repartidor)
   */
  static async getUserActiveChats(
    userId: string,
    userType: "client" | "driver",
  ): Promise<DeliveryChatWithDetails[]> {
    try {
      const filterColumn = userType === "client" ? "client_id" : "driver_id";

      const { data, error } = await supabaseAdmin
        .from("delivery_chats")
        .select(
          `
          *,
          client:users!delivery_chats_client_id_fkey(first_name, last_name, profile_image),
          driver:users!delivery_chats_driver_id_fkey(first_name, last_name, profile_image),
          delivery:deliveries!delivery_chats_delivery_id_fkey(delivery_address, status)
        `,
        )
        .eq(filterColumn, userId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      if (error) {
        throw error;
      }

      return (data || []).map(chat => ({
        ...chat,
        client_name: `${chat.client.first_name} ${chat.client.last_name}`,
        client_first_name: chat.client.first_name,
        client_last_name: chat.client.last_name,
        client_image: chat.client.profile_image,
        driver_name: `${chat.driver.first_name} ${chat.driver.last_name}`,
        driver_first_name: chat.driver.first_name,
        driver_last_name: chat.driver.last_name,
        driver_image: chat.driver.profile_image,
        delivery_address: chat.delivery.delivery_address,
      }));
    } catch (error) {
      console.error("❌ Error en getUserActiveChats:", error);
      throw new Error("Error al obtener chats activos");
    }
  }
}
