// ============= NUEVOS TIPOS REFACTORIZADOS =============

// Status para items individuales (el estado se maneja a nivel de item)
export type OrderItemStatus =
  | "pending" // Item esperando aprobación del mozo
  | "accepted" // Item aceptado, va a cocina
  | "rejected" // Item rechazado por el mozo
  | "preparing" // Item en preparación (cocina)
  | "ready" // Item listo para servir
  | "delivered"; // Item entregado al cliente

// ============= INTERFACES =============

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

// ORDEN REFACTORIZADA: Solo is_paid, sin status
export interface Order {
  id: string;
  user_id: string;
  table_id?: string;
  total_amount: number;
  estimated_time: number;
  is_paid: boolean; // NUEVO: Reemplaza status
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
  status: OrderItemStatus; // Status individual del item
  created_at: string;
  // Campos opcionales para items de delivery
  delivery_order_id?: string | null;
  is_delivery?: boolean;
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
  } | null;
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_image?: string;
  };
  is_delivery?: boolean; // Indica si es un pedido de delivery
}

// ============= TIPOS PARA ACCIONES DEL MOZO =============

// Acciones que puede realizar el mozo sobre items individuales
export type WaiterItemAction = "accept" | "reject";

export interface WaiterItemActionDTO {
  action: WaiterItemAction;
  itemIds: string[]; // IDs de items a procesar
  notes?: string; // Mensaje opcional del mozo
}

export interface ItemActionResponse {
  success: boolean;
  message: string;
  order: OrderWithItems;
  affectedItems: OrderItem[]; // Items que fueron procesados
}
