/**
 * API functions para chat de delivery
 * Basado en api/chat.ts existente
 */

import api from "./axios";
import type {
  DeliveryChatWithDetails,
  DeliveryChatMessageWithSender,
  DeliveryChatResponse,
  DeliveryMessagesResponse,
  SendDeliveryMessageResponse,
} from "../types/DeliveryChat";

/**
 * Obtener o crear chat para un delivery
 * @param deliveryId - ID del delivery
 */
export const getOrCreateDeliveryChat = async (
  deliveryId: string,
): Promise<DeliveryChatWithDetails> => {
  const response = await api.get<DeliveryChatResponse>(
    `/delivery-chat/delivery/${deliveryId}`,
  );
  if (!response.data.success || !response.data.chat) {
    throw new Error(response.data.error || "Error al obtener chat");
  }
  return response.data.chat;
};

/**
 * Obtener mensajes de un chat de delivery
 * @param deliveryChatId - ID del chat
 * @param limit - Número máximo de mensajes a obtener
 */
export const getDeliveryChatMessages = async (
  deliveryChatId: string,
  limit: number = 50,
): Promise<DeliveryChatMessageWithSender[]> => {
  const response = await api.get<DeliveryMessagesResponse>(
    `/delivery-chat/${deliveryChatId}/messages`,
    { params: { limit } },
  );
  if (!response.data.success || !response.data.messages) {
    throw new Error(response.data.error || "Error al obtener mensajes");
  }
  return response.data.messages;
};

/**
 * Enviar mensaje en un chat de delivery
 * @param deliveryChatId - ID del chat
 * @param message - Contenido del mensaje
 */
export const sendDeliveryMessage = async (
  deliveryChatId: string,
  message: string,
): Promise<DeliveryChatMessageWithSender> => {
  const response = await api.post<SendDeliveryMessageResponse>(
    `/delivery-chat/${deliveryChatId}/messages`,
    { message },
  );
  if (!response.data.success || !response.data.message) {
    throw new Error(response.data.error || "Error al enviar mensaje");
  }
  return response.data.message;
};

/**
 * Marcar mensajes como leídos
 * @param deliveryChatId - ID del chat
 */
export const markDeliveryMessagesAsRead = async (
  deliveryChatId: string,
): Promise<void> => {
  const response = await api.put(`/delivery-chat/${deliveryChatId}/read`);
  if (!response.data.success) {
    throw new Error(response.data.error || "Error al marcar como leído");
  }
};

/**
 * Obtener cantidad de mensajes no leídos
 * @param deliveryChatId - ID del chat
 */
export const getDeliveryUnreadCount = async (
  deliveryChatId: string,
): Promise<number> => {
  const response = await api.get<{ success: boolean; count: number }>(
    `/delivery-chat/${deliveryChatId}/unread-count`,
  );
  if (!response.data.success) {
    throw new Error("Error al obtener mensajes no leídos");
  }
  return response.data.count;
};

/**
 * Obtener todos los chats activos del usuario
 * (Para cliente: sus deliveries con chat activo)
 * (Para repartidor: deliveries asignados con chat activo)
 */
export const getMyDeliveryChats = async (): Promise<
  DeliveryChatWithDetails[]
> => {
  const response = await api.get<{
    success: boolean;
    chats?: DeliveryChatWithDetails[];
    error?: string;
  }>("/delivery-chat/my-chats");
  if (!response.data.success || !response.data.chats) {
    throw new Error(response.data.error || "Error al obtener chats");
  }
  return response.data.chats;
};
