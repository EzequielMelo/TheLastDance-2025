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
  rejectIndividualItemsFromBatch,
  approveBatchCompletely,
} from "./ordersServices";
import type { CreateOrderDTO } from "./orders.types";

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
    .min(1),
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

    console.log("🛒 Creando pedido para usuario:", userId);
    console.log("📦 Datos del pedido:", JSON.stringify(parsed, null, 2));

    const orderData: CreateOrderDTO = {
      table_id: parsed.table_id,
      items: parsed.items as any,
      totalAmount: parsed.totalAmount,
      estimatedTime: parsed.estimatedTime,
      notes: parsed.notes || null,
    };

    const order = await createOrder(orderData, userId);

    console.log("✅ Pedido creado exitosamente:", order.id);
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

    console.log(`✅ Acción de mozo ${action} completada para orden ${orderId}`);
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

    console.log(
      `🛒 Agregando items a pedido parcial ${orderId} para usuario:`,
      userId,
    );
    console.log("📦 Items a agregar:", JSON.stringify(parsed.items, null, 2));

    const result = await addItemsToPartialOrder(orderId, parsed.items, userId);

    console.log(`✅ Items agregados exitosamente a pedido ${orderId}`);
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

    console.log(
      `🛒 Agregando items a orden existente ${orderId} para usuario:`,
      userId,
    );
    console.log("📦 Items a agregar:", JSON.stringify(parsed.items, null, 2));

    const result = await addItemsToExistingOrder(orderId, parsed.items, userId);

    console.log(`✅ Items agregados exitosamente a orden ${orderId}`);
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

    console.log(
      `🔄 Mozo ${action} items [${itemIds.join(", ")}] en orden ${orderId}`,
    );

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
    console.log(
      "📦 Obteniendo tandas pendientes para mozo:",
      req.user?.appUserId,
    );

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
    console.log(
      "📋 Obteniendo items pendientes para mozo:",
      req.user?.appUserId,
    );

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

    console.log(
      `🔄 Reemplazando items rechazados en orden ${orderId} para usuario ${userId}`,
    );

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

    console.log(
      `❌ Rechazando items individuales en orden ${orderId} por mozo ${waiterId}`,
    );

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

    console.log(
      `✅ Aprobando tanda completa ${batchId} en orden ${orderId} por mozo ${waiterId}`,
    );

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
