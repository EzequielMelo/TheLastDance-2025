import api from "./axios";
import type { Order, CreateOrderRequest } from "../types/Order";

// Tipos para acciones del mozo
export interface WaiterOrderAction {
  action: "accept" | "reject" | "partial";
  rejectedItemIds?: string[];
  notes?: string;
}

export interface WaiterOrderActionResponse {
  success: boolean;
  message: string;
  order: Order;
  rejectedItems?: any[];
}

export const getUserOrders = async (): Promise<Order[]> => {
  try {
    const response = await api.get("/orders/my-orders");
    return response.data || [];
  } catch (error: any) {
    console.error("Error obteniendo pedidos del usuario:", error);
    throw new Error(error.response?.data?.error || "Error obteniendo pedidos");
  }
};

export const createOrder = async (
  orderData: CreateOrderRequest,
): Promise<Order> => {
  try {
    const response = await api.post("/orders", orderData);
    return response.data.order;
  } catch (error: any) {
    console.error("Error creando pedido:", error);
    throw new Error(error.response?.data?.error || "Error creando pedido");
  }
};

// API para funciones del mozo
export const getWaiterPendingOrders = async (): Promise<Order[]> => {
  try {
    const response = await api.get("/orders/waiter/pending");
    return response.data || [];
  } catch (error: any) {
    console.error("Error obteniendo pedidos pendientes para mozo:", error);
    throw new Error(
      error.response?.data?.error || "Error obteniendo pedidos pendientes",
    );
  }
};

export const getWaiterActiveOrders = async (): Promise<Order[]> => {
  try {
    const response = await api.get("/orders/waiter/active");
    return response.data || [];
  } catch (error: any) {
    console.error("Error obteniendo pedidos activos para mozo:", error);
    throw new Error(
      error.response?.data?.error || "Error obteniendo pedidos activos",
    );
  }
};

export const waiterOrderAction = async (
  orderId: string,
  actionData: WaiterOrderAction,
): Promise<WaiterOrderActionResponse> => {
  try {
    const response = await api.put(
      `/orders/${orderId}/waiter-action`,
      actionData,
    );
    return response.data;
  } catch (error: any) {
    console.error("Error en acción del mozo:", error);
    throw new Error(
      error.response?.data?.error || "Error procesando acción del mozo",
    );
  }
};

// Agregar items a un pedido parcial
export const addItemsToPartialOrder = async (
  orderId: string,
  items: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    prepMinutes: number;
    quantity: number;
    image_url?: string;
  }>,
): Promise<Order> => {
  try {
    const response = await api.put(`/orders/${orderId}/add-items`, { items });
    return response.data.order;
  } catch (error: any) {
    console.error("Error agregando items a pedido parcial:", error);
    throw new Error(
      error.response?.data?.error || "Error agregando items al pedido parcial",
    );
  }
};
