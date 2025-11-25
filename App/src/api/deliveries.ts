/**
 * API de Deliveries - Frontend
 * Funciones para interactuar con el backend de deliveries
 */
import api from "./axios";
import type {
  Delivery,
  CreateDeliveryDTO,
  UpdateDeliveryStatusDTO,
  AssignDriverDTO,
} from "../types/Delivery";

export interface CreateDeliveryOrderRequest {
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

export interface DeliveryOrder {
  id: string;
  user_id: string;
  total_amount: number;
  estimated_time: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_paid: boolean;
}

/**
 * Crear una orden de delivery
 */
export const createDeliveryOrder = async (
  data: CreateDeliveryOrderRequest,
): Promise<DeliveryOrder> => {
  const response = await api.post("/delivery-orders", data);
  return response.data.order;
};

/**
 * Crear un nuevo delivery
 */
export const createDelivery = async (
  data: CreateDeliveryDTO,
): Promise<Delivery> => {
  const response = await api.post("/deliveries", data);
  return response.data;
};

/**
 * Obtener delivery activo del usuario
 */
export const getActiveDelivery = async (): Promise<Delivery | null> => {
  const response = await api.get("/deliveries/active");
  return response.data.delivery || null;
};

/**
 * Obtener historial de deliveries del usuario
 */
export const getDeliveryHistory = async (): Promise<Delivery[]> => {
  const response = await api.get("/deliveries/history");
  return response.data.deliveries || [];
};

/**
 * Obtener delivery por ID
 */
export const getDeliveryById = async (
  deliveryId: string,
): Promise<Delivery> => {
  const response = await api.get(`/deliveries/${deliveryId}`);
  return response.data.delivery;
};

/**
 * Actualizar estado de delivery (solo dueño/supervisor)
 */
export const updateDeliveryStatus = async (
  deliveryId: string,
  data: UpdateDeliveryStatusDTO,
): Promise<Delivery> => {
  const response = await api.put(`/deliveries/${deliveryId}/status`, data);
  return response.data.delivery;
};

/**
 * Asignar driver a un delivery (solo dueño/supervisor)
 */
export const assignDriver = async (
  deliveryId: string,
  data: AssignDriverDTO,
): Promise<Delivery> => {
  const response = await api.put(`/deliveries/${deliveryId}/assign`, data);
  return response.data.delivery;
};

/**
 * Cancelar delivery (usuario antes de que esté on_the_way)
 */
export const cancelDelivery = async (deliveryId: string): Promise<void> => {
  await api.put(`/deliveries/${deliveryId}/cancel`);
};

/**
 * Marcar delivery como arrived (repartidor llegó al lugar)
 */
export const markDeliveryAsArrived = async (
  deliveryId: string,
): Promise<Delivery> => {
  const response = await api.put(`/deliveries/${deliveryId}/mark-arrived`);
  return response.data.delivery;
};

/**
 * Obtener deliveries pendientes (solo dueño/supervisor)
 */
export const getPendingDeliveries = async (): Promise<Delivery[]> => {
  const response = await api.get("/deliveries/pending");
  return response.data.deliveries || [];
};

/**
 * Obtener todos los deliveries (solo dueño/supervisor)
 */
export const getAllDeliveries = async (): Promise<Delivery[]> => {
  const response = await api.get("/deliveries");
  return response.data.deliveries || [];
};

/**
 * Establecer método de pago para un delivery
 * @param deliveryId ID del delivery
 * @param data Datos del método de pago (payment_method, tip_percentage, satisfaction_level)
 */
export const setDeliveryPaymentMethod = async (
  deliveryId: string,
  data: {
    payment_method: "qr" | "cash";
    tip_percentage?: number;
    satisfaction_level?: string;
  },
): Promise<Delivery> => {
  const response = await api.put(
    `/deliveries/${deliveryId}/payment-method`,
    data,
  );
  return response.data.delivery;
};

/**
 * Confirmar pago de un delivery
 * @param deliveryId ID del delivery
 * @param data Datos de confirmación de pago
 */
export const confirmDeliveryPayment = async (
  deliveryId: string,
  data: {
    payment_method: "qr" | "cash";
    tip_amount: number;
    tip_percentage: number;
    satisfaction_level?: string;
  },
): Promise<Delivery> => {
  const response = await api.put(
    `/deliveries/${deliveryId}/confirm-payment`,
    data,
  );
  return response.data.delivery;
};

/**
 * Repartidor confirma que recibió el pago (actualiza estados a paid y delivered)
 * @param deliveryId ID del delivery
 */
export const confirmDeliveryPaymentReceived = async (
  deliveryId: string,
): Promise<Delivery> => {
  const response = await api.put(
    `/deliveries/${deliveryId}/confirm-payment-received`,
  );
  return response.data.delivery;
};

/**
 * Actualizar ubicación en tiempo real del repartidor
 * @param deliveryId ID del delivery
 * @param location Coordenadas de ubicación
 */
export const updateDriverLocation = async (
  deliveryId: string,
  location: { latitude: number; longitude: number },
): Promise<Delivery> => {
  const response = await api.put(
    `/deliveries/${deliveryId}/location`,
    location,
  );
  return response.data.delivery;
};
