// Procesar pago de una orden
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

export const payOrder = async (
  tableId: string,
  idClient: string,
  paymentData?: {
    totalAmount: number;
    tipAmount: number;
    gameDiscountAmount?: number;
    gameDiscountPercentage?: number;
    satisfactionLevel?: string;
  },
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    const requestBody: any = {
      idClient,
    };

    // Agregar datos de pago si están disponibles
    if (paymentData) {
      requestBody.paymentDetails = paymentData;
    }

    // ⚠️ IMPORTANTE: Este endpoint solo marca el pago como "pendiente de confirmación"
    // La factura se genera cuando el mozo confirma en /orders/table/:tableId/confirm-payment
    const response = await api.put(`/orders/${tableId}/pay`, requestBody);
    console.log("Response from payOrder (client request):", response.data);
    
    return {
      success: response.data.success || true,
      message: response.data.message || 'Solicitud de pago enviada al mozo',
    };
  } catch (error: any) {
    console.error("Error enviando solicitud de pago:", error);
    throw new Error(
      error.response?.data?.error || "Error enviando solicitud de pago",
    );
  }
};

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
      error.response?.data?.error || "Error actualizando status de producto",
    );
  }
};

// Obtener estado de pedidos de una mesa (cliente escanea QR)
export const getTableOrdersStatus = async (
  tableId: string,
): Promise<{
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

// Verificar si todos los items de una mesa están entregados
export const checkTableDeliveryStatus = async (
  tableId: string,
): Promise<{
  allDelivered: boolean;
  totalItems: number;
  deliveredItems: number;
  pendingItems: Array<{
    id: string;
    name: string;
    status: string;
  }>;
}> => {
  try {
    const response = await api.get(`/orders/table/${tableId}/delivery-status`);
    return response.data.data;
  } catch (error: any) {
    console.error("❌ API: Error verificando estado de entrega:", error);
    throw new Error(
      error.response?.data?.message || "Error verificando estado de entrega",
    );
  }
};

// Confirmar que se ha recibido el pedido completo (persistente)
export const confirmTableDelivery = async (
  tableId: string,
): Promise<{
  success: boolean;
  message: string;
  table?: any;
}> => {
  try {
    console.log("✅ API: Confirming delivery for table:", tableId);
    const response = await api.post(`/tables/${tableId}/confirm-delivery`);
    console.log("📦 API: Confirm delivery response:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("❌ API: Error confirmando entrega:", error);
    throw new Error(error.response?.data?.error || "Error confirmando entrega");
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
      error.response?.data?.error ||
        "Error actualizando status de producto de bar",
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
    const response = await api.put(`/orders/${orderId}/waiter-items-action`, {
      itemIds,
      action: "accept",
    });
    return response.data.order;
  } catch (error: any) {
    console.error("Error aprobando items individuales:", error);
    throw new Error(
      error.response?.data?.error || "Error aprobando items individuales",
    );
  }
};

// Enviar modificaciones de tanda (mantiene items rejected como auxiliares)
export const submitTandaModifications = async (
  orderId: string,
  modificationsData: {
    keepItems: string[]; // IDs de items needs_modification que se mantienen
    newItems: Array<{
      menu_item_id: string;
      quantity: number;
      unit_price: number;
    }>;
  },
): Promise<{ success: boolean; message: string; order?: Order }> => {
  try {
    const response = await api.put(
      `/orders/${orderId}/submit-tanda-modifications`,
      modificationsData,
    );
    return response.data;
  } catch (error: any) {
    console.error("Error enviando modificaciones de tanda:", error);
    throw new Error(
      error.response?.data?.error || "Error enviando modificaciones de tanda",
    );
  }
};

// Confirmar pago y liberar mesa (para mozos)
export const confirmPayment = async (
  tableId: string,
): Promise<{
  success: boolean;
  message: string;
}> => {
  try {
    const response = await api.put(`/orders/table/${tableId}/confirm-payment`);
    return response.data;
  } catch (error: any) {
    console.error("❌ API: Error confirmando pago:", error);
    throw new Error(error.response?.data?.error || "Error confirmando pago");
  }
};

// Obtener mesas con pago pendiente de confirmación (para mozos)
export const getWaiterPendingPayments = async (): Promise<any[]> => {
  try {
    const response = await api.get("/orders/waiter/pending-payments");
    return response.data.data || [];
  } catch (error: any) {
    console.error("❌ API: Error obteniendo pagos pendientes:", error);
    throw new Error(
      error.response?.data?.error || "Error obteniendo pagos pendientes",
    );
  }
};

// Descargar factura generada
export const downloadInvoice = async (fileName: string): Promise<string> => {
  try {
    const response = await api.get(`/invoices/download/${fileName}`, {
      responseType: 'blob', // Para manejar archivos binarios
    });
    
    // En React Native, tendríamos que usar FileSystem o similar
    // Por ahora retornamos una URL que se puede abrir en el navegador
    return `/api/invoices/download/${fileName}`;
  } catch (error: any) {
    console.error("❌ API: Error descargando factura:", error);
    throw new Error(
      error.response?.data?.error || "Error descargando factura",
    );
  }
};

// Generar factura manualmente (para testing)
export const generateInvoiceManually = async (tableId: string): Promise<{
  success: boolean;
  message: string;
  filePath?: string;
  fileName?: string;
}> => {
  try {
    const response = await api.post(`/invoices/generate/${tableId}`);
    return response.data;
  } catch (error: any) {
    console.error("❌ API: Error generando factura manualmente:", error);
    throw new Error(
      error.response?.data?.error || "Error generando factura",
    );
  }
};

// Obtener datos de pedido para usuarios anónimos (para generar PDF local)
export const getAnonymousOrderData = async (): Promise<{
  hasOrder: boolean;
  orderData?: {
    clientName: string;
    tableNumber: string;
    items: Array<{
      name: string;
      description: string;
      category: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }>;
    subtotal: number;
    tipAmount: number;
    gameDiscountAmount: number;
    gameDiscountPercentage: number;
    totalAmount: number;
    satisfactionLevel: string;
    orderDate: string;
    orderTime: string;
    invoiceNumber: string;
  };
}> => {
  try {
    const response = await api.get('/orders/anonymous-order-data');
    return response.data;
  } catch (error: any) {
    console.error("❌ API: Error obteniendo datos del pedido anónimo:", error);
    return { hasOrder: false };
  }
};
