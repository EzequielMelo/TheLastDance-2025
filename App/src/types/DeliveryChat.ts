/**
 * Tipos para el sistema de chat entre cliente y repartidor
 * Basado en tipos existentes de Chat.ts pero adaptados para delivery
 */

// Chat de delivery (sala de conversación)
export interface DeliveryChat {
  id: string;
  delivery_id: string;
  client_id: string;
  driver_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Chat con detalles de usuarios y delivery
export interface DeliveryChatWithDetails extends DeliveryChat {
  client_name: string | null;
  client_first_name: string;
  client_last_name: string;
  client_image: string | null;
  driver_name: string | null;
  driver_first_name: string;
  driver_last_name: string;
  driver_image: string | null;
  delivery_address: string;
  unread_count: number;
}

// Mensaje individual del chat
export interface DeliveryChatMessage {
  id: string;
  delivery_chat_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// Mensaje con información del remitente
export interface DeliveryChatMessageWithSender extends DeliveryChatMessage {
  sender_name: string | null;
  sender_first_name: string;
  sender_last_name: string;
  sender_image: string | null;
  sender_type: "client" | "driver";
}

// Request para enviar mensaje
export interface SendDeliveryMessageRequest {
  deliveryChatId: string;
  message: string;
}

// Response del servidor
export interface DeliveryChatResponse {
  success: boolean;
  chat?: DeliveryChatWithDetails;
  error?: string;
}

export interface DeliveryMessagesResponse {
  success: boolean;
  messages?: DeliveryChatMessageWithSender[];
  error?: string;
}

export interface SendDeliveryMessageResponse {
  success: boolean;
  message?: DeliveryChatMessageWithSender;
  error?: string;
}
