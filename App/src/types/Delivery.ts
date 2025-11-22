/**
 * Estados posibles de un delivery
 */
export type DeliveryStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "ready"
  | "on_the_way"
  | "delivered"
  | "cancelled";

/**
 * Métodos de pago para delivery
 */
export type DeliveryPaymentMethod = "qr" | "cash";

/**
 * Estado del pago del delivery
 */
export type DeliveryPaymentStatus = "pending" | "paid";

/**
 * Interfaz principal de Delivery
 */
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
  origin_latitude: number | null;
  origin_longitude: number | null;
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
  survey_completed: boolean; // 📋 Indica si el cliente completó la encuesta
  created_at: string;
  confirmed_at: string | null;
  preparing_at: string | null;
  ready_at: string | null;
  on_the_way_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
}

/**
 * Delivery con información de la orden, usuario y driver
 */
export interface DeliveryWithOrder extends Delivery {
  delivery_order?: {
    // 🔄 Cambiado de order
    id: string;
    total_amount: number;
    items: any[];
  };
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  };
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string | null;
  };
}

/**
 * DTO para crear un nuevo delivery
 */
export interface CreateDeliveryDTO {
  delivery_order_id: string; // 🔄 Cambiado de order_id
  delivery_address: string;
  delivery_latitude: number;
  delivery_longitude: number;
  delivery_notes?: string;
  origin_latitude?: number;
  origin_longitude?: number;
  estimated_distance_km?: number;
  estimated_time_minutes?: number;
}

/**
 * DTO para actualizar el estado de un delivery
 */
export interface UpdateDeliveryStatusDTO {
  status: DeliveryStatus;
}

/**
 * DTO para asignar driver a un delivery
 */
export interface AssignDriverDTO {
  driver_id: string;
}

/**
 * Respuesta del API al obtener el delivery activo
 */
export interface ActiveDeliveryResponse {
  success: boolean;
  delivery: DeliveryWithOrder | null;
  hasActiveDelivery: boolean;
}

/**
 * Respuesta del API al crear un delivery
 */
export interface CreateDeliveryResponse {
  success: boolean;
  delivery: Delivery;
  message: string;
}

/**
 * Coordenadas geográficas
 */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Ubicación seleccionada por el usuario
 */
export interface DeliveryLocation {
  address: string;
  coordinates: Coordinates;
  notes?: string;
}
