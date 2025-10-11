import type { Request, Response } from "express";
import { z } from "zod";
import {
  createOrder,
  getOrderById,
  getUserOrders,
  getTableOrders,
  getPendingOrders,
  getWaiterPendingOrders,
  getWaiterActiveOrders,
  acceptOrder,
  rejectOrder,
  partialRejectOrder,
  addItemsToPartialOrder,
  addItemsToExistingOrder,
  waiterItemsActionNew,
  getWaiterPendingItems,
  getWaiterPendingBatches,
  replaceRejectedItems,
  getKitchenPendingOrders,
  updateKitchenItemStatus,
  checkAllItemsDelivered,
  getBartenderPendingOrders,
  updateBartenderItemStatus,
  getTableOrdersStatus,
  rejectIndividualItemsFromBatch,
  approveBatchCompletely,
  submitTandaModifications,
} from "./ordersServices";
import type { CreateOrderDTO, OrderItemStatus } from "./orders.types";

const createOrderSchema = z.object({
  table_id: z.string().uuid().optional(),
  items: z
    .array(
      z.object({
        id: z.string().uuid(), // menu_item_id
        name: z.string(),
        category: z.string(),
        price: z.number(),
        prepMinutes: z.number(),
        quantity: z.number().int().min(1).max(10),
        image_url: z.string().optional(),
      }),
    )
    .min(1)
    .max(20),
  totalAmount: z.number(),
  estimatedTime: z.number(),
  notes: z.string().optional(),
});

// Schema obsoleto eliminado - ya no se usan estados a nivel de orden

const waiterActionSchema = z.object({
  action: z.enum(["accept", "reject", "partial"]),
  rejectedItemIds: z.array(z.string().uuid()).optional(),
  notes: z.string().optional(),
});

const addItemToPartialOrderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid(), // menu_item_id
        name: z.string(),
        category: z.string(),
        price: z.number(),
        prepMinutes: z.number(),
        quantity: z.number().int().min(1).max(10),
        image_url: z.string().optional(),
      }),
    )
    .min(1)
    .max(10),
});

const replaceRejectedItemsSchema = z.object({
  rejectedItemIds: z.array(z.string().uuid()).min(1),
  newItems: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
        unit_price: z.number().positive(),
      }),
    )
    .min(0), // Permitir array vacío para eliminación sin reemplazo
});

// Crear nuevo pedido
export async function createOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const parsed = createOrderSchema.parse(req.body);
    const userId = req.user.appUserId;

    const orderData: CreateOrderDTO = {
      table_id: parsed.table_id,
      items: parsed.items as any,
      totalAmount: parsed.totalAmount,
      estimatedTime: parsed.estimatedTime,
      notes: parsed.notes || null,
    };

    const order = await createOrder(orderData, userId);
    res.status(201).json({
      success: true,
      message: "Pedido creado exitosamente",
      order,
    });
  } catch (error: any) {
    console.error("❌ Error en createOrderHandler:", error);

    if (error.name === "ZodError") {
      res.status(400).json({
        error: "Datos del pedido inválidos",
        details: error.errors,
      });
      return;
    }

    res.status(400).json({
      error: error.message || "Error al crear el pedido",
    });
  }
}

// Obtener pedido específico
export async function getOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({ error: "ID del pedido requerido" });
      return;
    }

    const order = await getOrderById(orderId);
    res.json(order);
  } catch (error: any) {
    console.error("❌ Error en getOrderHandler:", error);
    res.status(404).json({
      error: error.message || "Pedido no encontrado",
    });
  }
}

// Obtener pedidos del usuario actual
export async function getUserOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const userId = req.user.appUserId;
    const orders = await getUserOrders(userId);

    res.json(orders);
  } catch (error: any) {
    console.error("❌ Error en getUserOrdersHandler:", error);
    res.status(400).json({
      error: error.message || "Error al obtener pedidos",
    });
  }
}

// Obtener pedidos de una mesa específica
export async function getTableOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { tableId } = req.params;

    if (!tableId) {
      res.status(400).json({ error: "ID de mesa requerido" });
      return;
    }

    const orders = await getTableOrders(tableId);
    res.json(orders);
  } catch (error: any) {
    console.error("❌ Error en getTableOrdersHandler:", error);
    res.status(400).json({
      error: error.message || "Error al obtener pedidos de la mesa",
    });
  }
}

// Actualizar estado del pedido (para empleados)
// FUNCIÓN OBSOLETA - Eliminada con el nuevo sistema de estados por item
// Los estados ahora se manejan únicamente a nivel de item individual

// Obtener pedidos pendientes (para empleados)
export async function getPendingOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar permisos (solo empleados pueden ver pedidos pendientes)
    const userProfile = req.user.profile_code;
    const userPosition = req.user.position_code;
    const canViewPending =
      userProfile === "dueno" ||
      userProfile === "supervisor" ||
      userPosition === "mozo" ||
      userPosition === "maitre" ||
      userPosition === "cocinero" ||
      userPosition === "bartender";

    if (!canViewPending) {
      res.status(403).json({
        error: "No tienes permisos para ver pedidos pendientes",
      });
      return;
    }

    const orders = await getPendingOrders();
    res.json(orders);
  } catch (error: any) {
    console.error("❌ Error en getPendingOrdersHandler:", error);
    res.status(400).json({
      error: error.message || "Error al obtener pedidos pendientes",
    });
  }
}

// Obtener pedidos pendientes específicos para mozos
export async function getWaiterPendingOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que sea mozo
    const userPosition = req.user.position_code;
    const userProfile = req.user.profile_code;
    const isWaiter =
      userPosition === "mozo" ||
      userProfile === "dueno" ||
      userProfile === "supervisor";

    if (!isWaiter) {
      res.status(403).json({
        error: "Solo los mozos pueden acceder a esta función",
      });
      return;
    }

    // Si es dueño o supervisor, ve todas las órdenes
    // Si es mozo, solo ve las de sus mesas asignadas
    const orders =
      userProfile === "dueno" || userProfile === "supervisor"
        ? await getPendingOrders()
        : await getWaiterPendingOrders(req.user.appUserId);

    res.json(orders);
  } catch (error: any) {
    console.error("❌ Error en getWaiterPendingOrdersHandler:", error);
    res.status(400).json({
      error: error.message || "Error al obtener pedidos pendientes",
    });
  }
}

// Obtener pedidos activos específicos para mozos (aceptados, preparando, listos)
export async function getWaiterActiveOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que sea mozo
    const userPosition = req.user.position_code;
    const userProfile = req.user.profile_code;
    const isWaiter =
      userPosition === "mozo" ||
      userProfile === "dueno" ||
      userProfile === "supervisor";

    if (!isWaiter) {
      res.status(403).json({
        error: "Solo los mozos pueden acceder a esta función",
      });
      return;
    }

    // Si es dueño o supervisor, ve todas las órdenes activas
    // Si es mozo, solo ve las de sus mesas asignadas
    const orders =
      userProfile === "dueno" || userProfile === "supervisor"
        ? await getPendingOrders() // Para dueño/supervisor aún pueden ver todas
        : await getWaiterActiveOrders(req.user.appUserId);

    res.json(orders);
  } catch (error: any) {
    console.error("❌ Error en getWaiterActiveOrdersHandler:", error);
    res.status(400).json({
      error: error.message || "Error al obtener pedidos activos",
    });
  }
}

// Acción del mozo sobre una orden (aceptar/rechazar/parcial)
export async function waiterOrderActionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que sea mozo
    const userPosition = req.user.position_code;
    const userProfile = req.user.profile_code;
    const isWaiter =
      userPosition === "mozo" ||
      userProfile === "dueno" ||
      userProfile === "supervisor";

    if (!isWaiter) {
      res.status(403).json({
        error: "Solo los mozos pueden realizar esta acción",
      });
      return;
    }

    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ error: "ID de orden requerido" });
      return;
    }

    const parsed = waiterActionSchema.parse(req.body);
    const { action, rejectedItemIds, notes } = parsed;

    let result: any;

    switch (action) {
      case "accept":
        result = await acceptOrder(orderId, notes);
        res.json({
          success: true,
          message: "Orden aceptada exitosamente",
          order: result,
        });
        break;

      case "reject":
        result = await rejectOrder(orderId, notes);
        res.json({
          success: true,
          message: "Orden rechazada exitosamente",
          order: result,
        });
        break;

      case "partial":
        if (!rejectedItemIds || rejectedItemIds.length === 0) {
          res.status(400).json({
            error: "Se requieren IDs de items para rechazo parcial",
          });
          return;
        }

        result = await partialRejectOrder(orderId, rejectedItemIds, notes);
        res.json({
          success: true,
          message: "Rechazo parcial procesado exitosamente",
          order: result.order,
          rejectedItems: result.rejectedItems,
        });
        break;

      default:
        res.status(400).json({ error: "Acción no válida" });
        return;
    }
  } catch (error: any) {
    console.error("❌ Error en waiterOrderActionHandler:", error);

    if (error.name === "ZodError") {
      res.status(400).json({
        error: "Datos de acción inválidos",
        details: error.errors,
      });
      return;
    }

    res.status(400).json({
      error: error.message || "Error al procesar acción del mozo",
    });
  }
}

// Agregar items a un pedido parcial y convertirlo a pending
export async function addItemsToPartialOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ error: "ID de orden requerido" });
      return;
    }

    const parsed = addItemToPartialOrderSchema.parse(req.body);
    const userId = req.user.appUserId;

    const result = await addItemsToPartialOrder(orderId, parsed.items, userId);
    res.json({
      success: true,
      message:
        "Items agregados exitosamente. El pedido vuelve a estar pendiente.",
      order: result,
    });
  } catch (error: any) {
    console.error("❌ Error en addItemsToPartialOrderHandler:", error);

    if (error.name === "ZodError") {
      res.status(400).json({
        error: "Datos de items inválidos",
        details: error.errors,
      });
      return;
    }

    res.status(400).json({
      error: error.message || "Error al agregar items al pedido parcial",
    });
  }
}

// Agregar items a una orden existente (acepted/partial/pending)
export async function addItemsToExistingOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ error: "ID de orden requerido" });
      return;
    }

    const parsed = addItemToPartialOrderSchema.parse(req.body);
    const userId = req.user.appUserId;

    const result = await addItemsToExistingOrder(orderId, parsed.items, userId);
    res.json({
      success: true,
      message:
        "Items agregados exitosamente. Los nuevos items están pendientes de aprobación.",
      order: result,
    });
  } catch (error: any) {
    console.error("❌ Error en addItemsToExistingOrderHandler:", error);

    if (error.name === "ZodError") {
      res.status(400).json({
        error: "Datos de items inválidos",
        details: error.errors,
      });
      return;
    }

    res.status(400).json({
      error: error.message || "Error al agregar items a la orden existente",
    });
  }
}

// Acción del mozo sobre items específicos (aceptar/rechazar items individuales)
export async function waiterItemsActionHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que sea mozo
    const userPosition = req.user.position_code;
    const userProfile = req.user.profile_code;
    const isWaiter =
      userPosition === "mozo" ||
      userProfile === "dueno" ||
      userProfile === "supervisor";

    if (!isWaiter) {
      res.status(403).json({
        error: "Solo los mozos pueden realizar esta acción",
      });
      return;
    }

    const { orderId } = req.params;
    if (!orderId) {
      res.status(400).json({ error: "ID de orden requerido" });
      return;
    }

    const { itemIds, action, notes } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      res.status(400).json({ error: "Se requiere al menos un ID de item" });
      return;
    }

    if (!["accept", "reject"].includes(action)) {
      res.status(400).json({ error: "Acción debe ser 'accept' o 'reject'" });
      return;
    }

    const result = await waiterItemsActionNew(
      orderId,
      action as "accept" | "reject",
      itemIds,
      notes,
    );

    res.json({
      success: true,
      message: `Items ${action === "accept" ? "aceptados" : "rechazados"} exitosamente`,
      order: result,
    });
  } catch (error: any) {
    console.error("❌ Error en waiterItemsActionHandler:", error);
    res.status(500).json({
      error: error.message || "Error al procesar acción sobre items",
    });
  }
}

// Obtener tandas pendientes agrupadas por batch_id (nueva versión)
export async function getWaiterPendingBatchesHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user?.appUserId) {
      res.status(401).json({
        success: false,
        message: "Usuario no autenticado",
      });
      return;
    }

    // Verificar que sea mozo
    const userPosition = req.user.position_code;
    const userProfile = req.user.profile_code;
    const isWaiter =
      userPosition === "mozo" ||
      userProfile === "dueno" ||
      userProfile === "supervisor";

    if (!isWaiter) {
      res.status(403).json({
        success: false,
        error: "Solo los mozos pueden acceder a esta función",
      });
      return;
    }

    const pendingBatches = await getWaiterPendingBatches(req.user.appUserId);

    res.status(200).json({
      success: true,
      data: pendingBatches,
      message: `${pendingBatches.length} tandas pendientes encontradas`,
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo tandas pendientes:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message || "Error desconocido",
    });
  }
}

// Obtener items pendientes que necesitan revisión del mozo
export async function getWaiterPendingItemsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user?.appUserId) {
      res.status(401).json({
        success: false,
        message: "Usuario no autenticado",
      });
      return;
    }

    // Verificar que sea mozo
    const userPosition = req.user.position_code;
    const userProfile = req.user.profile_code;
    const isWaiter =
      userPosition === "mozo" ||
      userProfile === "dueno" ||
      userProfile === "supervisor";

    if (!isWaiter) {
      res.status(403).json({
        success: false,
        error: "Solo los mozos pueden acceder a esta función",
      });
      return;
    }

    const ordersWithPendingItems = await getWaiterPendingItems(
      req.user.appUserId,
    );

    res.status(200).json({
      success: true,
      data: ordersWithPendingItems,
      message: `${ordersWithPendingItems.length} órdenes con items pendientes encontradas`,
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo items pendientes:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message || "Error desconocido",
    });
  }
}

// Reemplazar items rechazados con nuevos items
export async function replaceRejectedItemsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const { orderId } = req.params;
    const parsed = replaceRejectedItemsSchema.parse(req.body);
    const userId = req.user.appUserId;

    if (!orderId) {
      res.status(400).json({ error: "ID del pedido requerido" });
      return;
    }
    const updatedOrder = await replaceRejectedItems(
      orderId,
      userId,
      parsed.rejectedItemIds,
      parsed.newItems,
    );

    res.json({
      success: true,
      message: "Items rechazados reemplazados exitosamente",
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("❌ Error reemplazando items rechazados:", error);
    res.status(400).json({
      error: error.message || "Error al reemplazar items rechazados",
    });
  }
}

// ============= CONTROLADORES PARA COCINA =============

// Obtener pedidos pendientes para cocina
export async function getKitchenPendingOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que el usuario es cocinero
    if (req.user.position_code !== "cocinero") {
      res.status(403).json({
        error: "Solo los cocineros pueden acceder a esta función",
      });
      return;
    }
    const pendingOrders = await getKitchenPendingOrders();

    res.json({
      success: true,
      data: pendingOrders,
      message: `${pendingOrders.length} órdenes pendientes para cocina`,
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo pedidos para cocina:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message || "Error desconocido",
    });
  }
}

// Actualizar status de item de cocina
export async function updateKitchenItemStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que el usuario es cocinero
    if (req.user.position_code !== "cocinero") {
      res.status(403).json({
        error: "Solo los cocineros pueden actualizar items de cocina",
      });
      return;
    }

    const { itemId } = req.params;
    const { status } = req.body;

    if (!itemId || !status) {
      res.status(400).json({
        error: "ID del item y status son requeridos",
      });
      return;
    }

    // Validar status
    const validStatuses: OrderItemStatus[] = ["preparing", "ready"];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        error: "Status inválido. Use 'preparing' o 'ready'",
      });
      return;
    }
    const result = await updateKitchenItemStatus(itemId, status);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message,
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("❌ Error actualizando status de item:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message || "Error desconocido",
    });
  }
}

// ============= CONTROLADORES PARA BAR =============

// Obtener pedidos pendientes para bar (bebidas aceptadas)
export async function getBartenderPendingOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Verificar autenticación
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // Solo bartenders pueden acceder
    if (req.user.position_code !== "bartender") {
      res.status(403).json({
        error: "Solo bartenders pueden acceder a esta función",
      });
      return;
    }
    const pendingOrders = await getBartenderPendingOrders();

    res.json({
      success: true,
      data: pendingOrders,
      message: `${pendingOrders.length} órdenes con bebidas encontradas`,
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo pedidos para bar:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message || "Error desconocido",
    });
  }
}

// Actualizar status de items de bar
export async function updateBartenderItemStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Verificar autenticación
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // Solo bartenders pueden acceder
    if (req.user.position_code !== "bartender") {
      res.status(403).json({
        error: "Solo bartenders pueden actualizar items de bar",
      });
      return;
    }

    const { itemId } = req.params;
    const { status } = req.body;

    if (!itemId) {
      res.status(400).json({
        error: "ID del item es requerido",
      });
      return;
    }

    if (!status || !["preparing", "ready"].includes(status)) {
      res.status(400).json({
        error: "Status inválido. Use 'preparing' o 'ready'",
      });
      return;
    }
    const result = await updateBartenderItemStatus(itemId, status);

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message,
      });
      return;
    }

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("❌ Error actualizando status de item de bar:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message || "Error desconocido",
    });
  }
}

// Obtener estado de pedidos de una mesa (cliente escanea QR)
export async function getTableOrdersStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const { tableId } = req.params;

    if (!tableId) {
      res.status(400).json({
        error: "ID de mesa requerido",
      });
      return;
    }
    const orders = await getTableOrdersStatus(tableId, req.user.appUserId);

    // Calcular estadísticas de los pedidos
    const stats = {
      totalOrders: orders.length,
      totalItems: orders.reduce(
        (sum, order) => sum + order.order_items.length,
        0,
      ),
      itemsByStatus: {
        pending: 0,
        accepted: 0,
        rejected: 0,
        preparing: 0,
        ready: 0,
        delivered: 0,
      },
    };

    orders.forEach(order => {
      order.order_items.forEach(item => {
        stats.itemsByStatus[item.status]++;
      });
    });

    res.json({
      success: true,
      data: orders,
      stats,
      message:
        orders.length > 0
          ? `${orders.length} pedidos encontrados`
          : "No tienes pedidos en esta mesa",
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo estado de pedidos de mesa:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error al obtener estado de pedidos",
    });
  }
}

// Schema para rechazar/aprobar items individuales
const individualItemsActionSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1),
  reason: z.string().optional(),
});

// Rechazar items individuales de una tanda
export async function rejectIndividualItemsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que sea mozo
    const userPosition = req.user.position_code;
    const userProfile = req.user.profile_code;
    const isWaiter =
      userPosition === "mozo" ||
      userProfile === "dueno" ||
      userProfile === "supervisor";

    if (!isWaiter) {
      res.status(403).json({
        error: "Solo los mozos pueden realizar esta acción",
      });
      return;
    }

    const { orderId } = req.params;
    const parsed = individualItemsActionSchema.parse(req.body);
    const waiterId = req.user.appUserId;

    if (!orderId) {
      res.status(400).json({ error: "ID del pedido requerido" });
      return;
    }
    const updatedOrder = await rejectIndividualItemsFromBatch(
      orderId,
      waiterId,
      parsed.itemIds,
      parsed.reason,
    );

    res.json({
      success: true,
      message:
        "Items rechazados individualmente. El cliente puede reemplazarlos.",
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("❌ Error rechazando items individuales:", error);
    res.status(400).json({
      error: error.message || "Error al rechazar items individuales",
    });
  }
}

// Aprobar items individuales de una tanda
export async function approveBatchCompletelyHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que sea mozo
    const userPosition = req.user.position_code;
    const userProfile = req.user.profile_code;
    const isWaiter =
      userPosition === "mozo" ||
      userProfile === "dueno" ||
      userProfile === "supervisor";

    if (!isWaiter) {
      res.status(403).json({
        error: "Solo los mozos pueden realizar esta acción",
      });
      return;
    }

    const { orderId } = req.params;
    const { batchId } = req.body;
    const waiterId = req.user.appUserId;

    if (!orderId || !batchId) {
      res.status(400).json({ error: "ID del pedido y batch ID requeridos" });
      return;
    }
    const updatedOrder = await approveBatchCompletely(
      orderId,
      waiterId,
      batchId,
    );

    res.json({
      success: true,
      message: "Tanda aprobada completamente",
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("❌ Error aprobando tanda completa:", error);
    res.status(400).json({
      error: error.message || "Error al aprobar tanda completa",
    });
  }
}

// Verificar si todos los items de una mesa están entregados
export async function checkTableDeliveryStatusHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const tableId = req.params['tableId'];
    const userId = req.user.appUserId;

    if (!tableId) {
      res.status(400).json({ error: "ID de mesa requerido" });
      return;
    }

    const deliveryStatus = await checkAllItemsDelivered(tableId, userId);

    res.json({
      success: true,
      data: deliveryStatus,
      message: deliveryStatus.allDelivered 
        ? "Todos los items han sido entregados" 
        : `${deliveryStatus.pendingItems.length} items pendientes de entrega`,
    });
  } catch (error: any) {
    console.error("❌ Error verificando estado de entrega:", error);
    res.status(400).json({
      success: false,
      message: error.message || "Error al verificar estado de entrega",
    });
  }
}

// Esquema para enviar modificaciones de tanda
const submitTandaModificationsSchema = z.object({
  keepItems: z.array(z.string().uuid()).default([]),
  newItems: z
    .array(
      z.object({
        menu_item_id: z.string().uuid(),
        quantity: z.number().int().min(1).max(10),
        unit_price: z.number().positive(),
      }),
    )
    .default([]),
});

// Enviar modificaciones de tanda (mantiene items rejected como auxiliares)
export async function submitTandaModificationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({ error: "ID del pedido requerido" });
      return;
    }

    const parsed = submitTandaModificationsSchema.parse(req.body);
    const updatedOrder = await submitTandaModifications(
      orderId,
      req.user.appUserId,
      parsed.keepItems,
      parsed.newItems,
    );

    res.json({
      success: true,
      message: "Modificaciones de tanda enviadas correctamente",
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("❌ Error enviando modificaciones de tanda:", error);
    res.status(400).json({
      error: error.message || "Error al enviar modificaciones de tanda",
    });
  }
}
