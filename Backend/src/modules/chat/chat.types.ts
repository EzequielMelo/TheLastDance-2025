export interface Chat {
  id: string;
  table_id: string;
  client_id: string;
  waiter_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  sender_type: "client" | "waiter";
  message_text: string;
  message_type: "text" | "image" | "notification";
  is_read: boolean;
  created_at: string;
}

export interface CreateChatRequest {
  tableId: string;
  clientId: string;
  waiterId: string;
}

export interface SendMessageRequest {
  chatId: string;
  message: string;
  tableId: string;
}

export interface ChatWithDetails extends Chat {
  client_name: string;
  waiter_name: string;
  table_number: number;
  unread_count?: number;
}

export interface MessageWithSender extends Message {
  sender_name: string;
  sender_first_name: string;
  sender_last_name: string;
}
