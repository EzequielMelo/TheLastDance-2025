export interface OrderItem {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
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

export interface Order {
  id: string;
  user_id: string;
  table_id?: string;
  total_amount: number;
  estimated_time: number;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  notes?: string;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
  table?: {
    id: string;
    number: string;
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
    image_url?: string;
  }>;
  totalAmount: number;
  estimatedTime: number;
  notes?: string;
}