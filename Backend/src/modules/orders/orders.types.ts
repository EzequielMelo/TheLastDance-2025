export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "delivered"
  | "cancelled"
  | "accepted"
  | "rejected"
  | "partial";

export interface CreateOrderDTO {
  table_id?: string | undefined;
  items: OrderItemFromFrontend[];
  totalAmount: number;
  estimatedTime: number;
  notes?: string | null;
}

export interface OrderItemFromFrontend {
  id: string; // menu_item_id
  name: string;
  category: string;
  price: number;
  prepMinutes: number;
  quantity: number;
  image_url?: string;
}

export interface OrderItemDTO {
  menu_item_id: string;
  quantity: number;
}

export interface Order {
  id: string;
  user_id: string;
  table_id?: string;
  total_amount: number;
  estimated_time: number;
  status: OrderStatus;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  created_at: string;
  // Datos del producto (join)
  menu_item?: {
    id: string;
    name: string;
    description: string;
    prep_minutes: number;
    price: number;
    category: string;
  };
}

export interface OrderWithItems extends Order {
  order_items: OrderItem[];
  table?: {
    id: string;
    number: string;
  };
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_image?: string;
  };
}

// Tipos para acciones del mozo
export type WaiterOrderAction = "accept" | "reject" | "partial";

export interface WaiterOrderActionDTO {
  action: WaiterOrderAction;
  rejectedItemIds?: string[]; // IDs de items rechazados (solo para partial)
  notes?: string; // Mensaje opcional del mozo
}

export interface OrderActionResponse {
  success: boolean;
  message: string;
  order: OrderWithItems;
  rejectedItems?: OrderItem[]; // Items que fueron rechazados
}
