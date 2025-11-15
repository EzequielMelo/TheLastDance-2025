export type DeliveryStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export type DeliveryPaymentMethod = "qr" | "cash";
export type DeliveryPaymentStatus = "pending" | "paid";

export interface Delivery {
  id: string;
  user_id: string;
  delivery_order_id: string; // 🔄 Cambiado de order_id
  driver_id: string | null;
  status: DeliveryStatus;
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_notes: string | null;
  origin_address: string;
  origin_latitude: number;
  origin_longitude: number;
  estimated_distance_km: number | null;
  estimated_time_minutes: number | null;
  driver_current_latitude: number | null; // 📍 Ubicación en tiempo real del repartidor
  driver_current_longitude: number | null; // 📍 Ubicación en tiempo real del repartidor
  driver_location_updated_at: string | null; // 📍 Última actualización de ubicación
  payment_method: DeliveryPaymentMethod | null;
  payment_status: DeliveryPaymentStatus;
  tip_amount: number;
  tip_percentage: number;
  satisfaction_level: string | null;
  paid_at: string | null;
  created_at: string;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  on_the_way_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

export interface CreateDeliveryDTO {
  delivery_order_id: string; // 🔄 Cambiado de order_id
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_notes?: string;
  estimated_distance_km?: number;
  estimated_time_minutes?: number;
}

export interface UpdateDeliveryStatusDTO {
  status: DeliveryStatus;
}

export interface AssignDriverDTO {
  driver_id: string;
}

export interface SetPaymentMethodDTO {
  payment_method: DeliveryPaymentMethod;
  tip_percentage?: number;
  satisfaction_level?: string;
}

export interface ConfirmPaymentDTO {
  payment_method: DeliveryPaymentMethod;
  tip_amount: number;
  tip_percentage: number;
  satisfaction_level?: string;
}

export interface UpdateDriverLocationDTO {
  latitude: number;
  longitude: number;
}

export interface DeliveryWithOrder extends Delivery {
  delivery_order?: {
    // 🔄 Cambiado de order
    id: string;
    total_amount: number;
    is_paid: boolean;
    items: any[];
  };
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_image: string | null;
  };
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
    profile_image: string | null;
  };
}
