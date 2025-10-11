// Status para items individuales
export type OrderItemStatus =
  | "pending" // Item esperando aprobación del mozo
  | "accepted" // Item aceptado, va a cocina
  | "rejected" // Item rechazado por el mozo (SIN STOCK)
  | "needs_modification" // Item disponible pero en tanda devuelta (CON STOCK)
  | "preparing" // Item en preparación (cocina)
  | "ready" // Item listo para servir
  | "delivered"; // Item entregado al cliente

export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  status: OrderItemStatus; // NUEVO: Status individual del item
  batch_id?: string; // NUEVO: Identificador de tanda
  created_at: string;
  menu_item?: {
    id: string;
    name: string;
    description: string;
    prep_minutes: number;
    price: number;
    category: string;
  };
}

// ORDEN REFACTORIZADA: Solo is_paid, sin status
export interface Order {
  id: string;
  user_id: string;
  table_id?: string;
  total_amount: number;
  estimated_time: number;
  is_paid: boolean; // NUEVO: Reemplaza status - solo indica si está pagada
  notes?: string;
  created_at: string;
  updated_at: string;
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

export interface CreateOrderRequest {
  table_id?: string;
  items: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    prepMinutes: number;
    quantity: number;
  }>;
  totalAmount: number;
  estimatedTime: number;
  notes?: string;
}
