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

// Agregar items a cualquier orden existente (accepted, partial, pending)
export const addItemsToExistingOrder = async (
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
    const response = await api.put(`/orders/${orderId}/add-items-to-existing`, {
      items,
    });
    return response.data.order;
  } catch (error: any) {
    console.error("Error agregando items a orden existente:", error);
    throw new Error(
      error.response?.data?.error ||
        "Error agregando items a la orden existente",
    );
  }
};

// Obtener solo items pendientes de aprobación (para mozos)
export const getWaiterPendingItems = async (): Promise<Order[]> => {
  try {
    const response = await api.get("/orders/waiter/pending-items");
    return response.data.data || [];
  } catch (error: any) {
    console.error("Error obteniendo items pendientes para mozo:", error);
    throw new Error(
      error.response?.data?.error || "Error obteniendo items pendientes",
    );
  }
};

// Acción del mozo sobre items específicos (aceptar/rechazar items individuales)
export const waiterItemsAction = async (
  orderId: string,
  itemIds: string[],
  action: "accept" | "reject",
  notes?: string,
): Promise<any> => {
  try {
    const response = await api.put(`/orders/${orderId}/waiter-items-action`, {
      itemIds,
      action,
      notes,
    });
    return response.data;
  } catch (error: any) {
    console.error("Error en acción del mozo sobre items:", error);
    throw new Error(
      error.response?.data?.error || "Error procesando acción sobre items",
    );
  }
};

// Reemplazar items rechazados con nuevos items
export const replaceRejectedItems = async (
  orderId: string,
  rejectedItemIds: string[],
  newItems: Array<{
    menu_item_id: string;
    quantity: number;
    unit_price: number;
  }>,
): Promise<Order> => {
  try {
    const response = await api.put(
      `/orders/${orderId}/replace-rejected-items`,
      {
        rejectedItemIds,
        newItems,
      },
    );
    return response.data.order;
  } catch (error: any) {
    console.error("Error reemplazando items rechazados:", error);
    throw new Error(
      error.response?.data?.error || "Error reemplazando items rechazados",
    );
  }
};
