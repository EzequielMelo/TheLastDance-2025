/**
 * Tipos para el sistema de chat entre clientes y repartidores durante deliveries
 */

export interface DeliveryChat {
  id: string;
  delivery_id: string;
  client_id: string;
  driver_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliveryChatMessage {
  id: string;
  delivery_chat_id: string;
  sender_id: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface CreateDeliveryChatRequest {
  deliveryId: string;
  clientId: string;
  driverId: string;
}

export interface SendDeliveryMessageRequest {
  deliveryChatId: string;
  message: string;
}

export interface DeliveryChatWithDetails extends DeliveryChat {
  client_name: string;
  client_first_name: string;
  client_last_name: string;
  client_image?: string;
  driver_name: string;
  driver_first_name: string;
  driver_last_name: string;
  driver_image?: string;
  delivery_address: string;
  unread_count?: number;
}

export interface DeliveryChatMessageWithSender extends DeliveryChatMessage {
  sender_name: string;
  sender_first_name: string;
  sender_last_name: string;
  sender_image?: string;
  sender_type: "client" | "driver";
}
