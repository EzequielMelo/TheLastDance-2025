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

// Obtener tandas pendientes agrupadas por batch_id (para mozos)
export const getWaiterPendingBatches = async (): Promise<any[]> => {
  try {
    const response = await api.get("/orders/waiter/pending-batches");
    return response.data.data || [];
  } catch (error: any) {
    console.error("Error obteniendo tandas pendientes para mozo:", error);
    throw new Error(
      error.response?.data?.error || "Error obteniendo tandas pendientes",
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

// ============= API PARA COCINA =============

// Obtener pedidos pendientes para cocina
export const getKitchenPendingOrders = async (): Promise<Order[]> => {
  try {
    const response = await api.get("/orders/kitchen/pending");
    return response.data.data || [];
  } catch (error: any) {
    console.error("Error obteniendo pedidos para cocina:", error);
    throw new Error(
      error.response?.data?.error || "Error obteniendo pedidos para cocina",
    );
  }
};

// Actualizar status de item de cocina
export const updateKitchenItemStatus = async (
  itemId: string,
  status: "preparing" | "ready",
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.put(`/orders/kitchen/item/${itemId}/status`, {
      status,
    });
    return response.data;
  } catch (error: any) {
    console.error("Error actualizando status de item:", error);
    throw new Error(
      error.response?.data?.error || "Error actualizando status de item",
    );
  }
};

// Obtener estado de pedidos de una mesa (cliente escanea QR)
export const getTableOrdersStatus = async (tableId: string): Promise<{
  orders: Order[];
  stats: {
    totalOrders: number;
    totalItems: number;
    itemsByStatus: {
      pending: number;
      accepted: number;
      rejected: number;
      preparing: number;
      ready: number;
      delivered: number;
    };
  };
}> => {
  try {
    const response = await api.get(`/orders/table/${tableId}/status`);
    return {
      orders: response.data.data || [],
      stats: response.data.stats || {
        totalOrders: 0,
        totalItems: 0,
        itemsByStatus: {
          pending: 0,
          accepted: 0,
          rejected: 0,
          preparing: 0,
          ready: 0,
          delivered: 0,
        },
      },
    };
  } catch (error: any) {
    console.error("Error obteniendo estado de pedidos de mesa:", error);
    throw new Error(
      error.response?.data?.error || "Error obteniendo estado de pedidos",
    );
  }
};

// ============= API PARA BAR =============

// Obtener pedidos pendientes para bar
export const getBartenderPendingOrders = async (): Promise<Order[]> => {
  try {
    const response = await api.get("/orders/bar/pending");
    return response.data.data || [];
  } catch (error: any) {
    console.error("Error obteniendo pedidos para bar:", error);
    throw new Error(
      error.response?.data?.error || "Error obteniendo pedidos para bar",
    );
  }
};

// Actualizar status de item de bar
export const updateBartenderItemStatus = async (
  itemId: string,
  status: "preparing" | "ready",
): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await api.put(`/orders/bar/item/${itemId}/status`, {
      status,
    });
    return response.data;
  } catch (error: any) {
    console.error("Error actualizando status de item de bar:", error);
    throw new Error(
      error.response?.data?.error || "Error actualizando status de item de bar",
    );
  }
};

// Rechazar items individuales (sin eliminar, para que el cliente pueda reemplazar)
export const rejectIndividualItems = async (
  orderId: string,
  itemIds: string[],
  reason?: string,
): Promise<Order> => {
  try {
    const response = await api.put(
      `/orders/${orderId}/reject-individual-items`,
      {
        itemIds,
        reason,
      },
    );
    return response.data.order;
  } catch (error: any) {
    console.error("Error rechazando items individuales:", error);
    throw new Error(
      error.response?.data?.error || "Error rechazando items individuales",
    );
  }
};

// Aprobar items individuales
export const approveIndividualItems = async (
  orderId: string,
  itemIds: string[],
): Promise<Order> => {
  try {
    const response = await api.put(
      `/orders/${orderId}/approve-individual-items`,
      {
        itemIds,
      },
    );
    return response.data.order;
  } catch (error: any) {
    console.error("Error aprobando items individuales:", error);
    throw new Error(
      error.response?.data?.error || "Error aprobando items individuales",
    );
  }
};
