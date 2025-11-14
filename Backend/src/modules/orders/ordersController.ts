import type { Request, Response } from "express";
import { z } from "zod";
import path from "path";
import { supabaseAdmin } from "../../config/supabase";
import { InvoiceService } from "../invoices/invoiceService";
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
  payOrder,
  confirmPaymentAndReleaseTable,
  getWaiterReadyItems,
  getWaiterPendingPayments,
  markItemAsDelivered,
  submitTandaModifications,
} from "./ordersServices";
import type { CreateOrderDTO, OrderItemStatus } from "./orders.types";
import {
  notifyWaiterNewOrder,
  notifyClientOrderRejectedForModification,
  notifyClientOrderConfirmed,
  notifyKitchenNewItems,
  notifyBartenderNewItems,
  notifyWaiterKitchenItemsReady,
  notifyWaiterBartenderItemsReady,
  notifyManagementPaymentReceived,
} from "../../services/pushNotificationService";
import { emitClientStateUpdate } from "../../socket/clientStateSocket";

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

    const orderData: CreateOrderDTO = {
      table_id: parsed.table_id,
      items: parsed.items as any,
      totalAmount: parsed.totalAmount,
      estimatedTime: parsed.estimatedTime,
      notes: parsed.notes || null,
    };

    const order = await createOrder(orderData, userId);

    // Enviar notificación push al mozo si hay mesa asignada
    if (parsed.table_id) {
      try {
        // Obtener información de la mesa y el mozo
        const { data: tableData, error: tableError } = await supabaseAdmin
          .from("tables")
          .select(
            `
            number,
            id_waiter,
            users!tables_id_client_fkey(first_name, last_name)
          `,
          )
          .eq("id", parsed.table_id)
          .single();

        if (!tableError && tableData?.id_waiter) {
          const clientData = (tableData as any).users;
          const clientName = clientData
            ? `${clientData.first_name} ${clientData.last_name}`.trim()
            : "Cliente";

          await notifyWaiterNewOrder(
            tableData.id_waiter,
            clientName,
            tableData.number.toString(),
            parsed.items.length,
            parsed.totalAmount,
          );
        }
      } catch (notifyError) {
        console.error("Error enviando notificación al mozo:", notifyError);
        // No bloqueamos la creación del pedido por error de notificación
      }
    }

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

        // Enviar notificaciones push a cocina y bartender
        try {
          // Obtener información de la orden y mesa
          const { data: orderData, error: orderError } = await supabaseAdmin
            .from("orders")
            .select(
              `
              id_client,
              table_id,
              order_items!inner(
                menu_item_id,
                quantity,
                unit_price,
                status,
                menu_items!inner(
                  name,
                  category
                )
              ),
              tables!inner(
                number,
                users!tables_id_client_fkey(first_name, last_name)
              )
            `,
            )
            .eq("id", orderId)
            .single();

          if (!orderError && orderData) {
            const tableData = (orderData as any).tables;
            const clientData = tableData?.users;
            const clientName = clientData
              ? `${clientData.first_name} ${clientData.last_name}`.trim()
              : "Cliente";

            // Separar items por categoría (platos vs bebidas)
            const orderItems = (orderData as any).order_items;
            const dishItems: Array<{ name: string; quantity: number }> = [];
            const drinkItems: Array<{ name: string; quantity: number }> = [];

            orderItems.forEach((item: any) => {
              const menuItem = item.menu_items;
              const itemData = {
                name: menuItem.name,
                quantity: item.quantity,
              };

              // Categorías que van a cocina
              if (
                ["platos", "entradas", "postres", "ensaladas"].includes(
                  menuItem.category.toLowerCase(),
                )
              ) {
                dishItems.push(itemData);
              }
              // Categorías que van a bar
              else if (
                ["bebidas", "tragos", "cervezas", "vinos", "aguas"].includes(
                  menuItem.category.toLowerCase(),
                )
              ) {
                drinkItems.push(itemData);
              }
            });

            // Notificar a cocina si hay platos
            if (dishItems.length > 0) {
              await notifyKitchenNewItems(
                tableData.number.toString(),
                dishItems,
                clientName,
              );
            }

            // Notificar a bartender si hay bebidas
            if (drinkItems.length > 0) {
              await notifyBartenderNewItems(
                tableData.number.toString(),
                drinkItems,
                clientName,
              );
            }

            // Notificar al cliente que su pedido fue confirmado
            const totalItemsCount = dishItems.length + drinkItems.length;
            if (totalItemsCount > 0) {
              // Obtener información del mozo que aceptó el pedido
              const { data: waiterData, error: waiterError } =
                await supabaseAdmin
                  .from("users")
                  .select("first_name, last_name")
                  .eq("id", req.user.appUserId)
                  .single();

              const waiterName =
                waiterData && !waiterError
                  ? `${waiterData.first_name} ${waiterData.last_name}`.trim()
                  : "Mozo";

              await notifyClientOrderConfirmed(
                orderData.id_client,
                waiterName,
                tableData.number.toString(),
                totalItemsCount,
                result.estimated_time,
              );
            }
          }
        } catch (notifyError) {
          console.error(
            "Error enviando notificaciones a cocina/bar:",
            notifyError,
          );
          // No bloqueamos la respuesta por error de notificación
        }

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

        // Enviar notificación push al cliente sobre el rechazo
        try {
          // Obtener información de la orden y mesa
          const { data: orderData, error: orderError } = await supabaseAdmin
            .from("orders")
            .select(
              `
              id_client,
              table_id,
              tables!inner(
                number,
                id_waiter,
                users!tables_id_waiter_fkey(first_name, last_name)
              )
            `,
            )
            .eq("id", orderId)
            .single();

          if (!orderError && orderData?.table_id) {
            const tableData = (orderData as any).tables;
            const waiterData = tableData?.users;
            const waiterName = waiterData
              ? `${waiterData.first_name} ${waiterData.last_name}`.trim()
              : "Mozo";

            await notifyClientOrderRejectedForModification(
              orderData.id_client,
              waiterName,
              tableData.number.toString(),
              rejectedItemIds.length,
              result.order.order_items.length,
            );
          }
        } catch (notifyError) {
          console.error("Error enviando notificación de rechazo:", notifyError);
          // No bloqueamos la respuesta por error de notificación
        }

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

    // Emitir socket al cliente para actualización en tiempo real
    try {
      const { data: orderData } = await supabaseAdmin
        .from("orders")
        .select("id_client")
        .eq("id", orderId)
        .single();

      if (orderData?.id_client) {
        emitClientStateUpdate(orderData.id_client, "client:state-update", {
          type: "items_action",
          action,
          itemIds,
        });
      }
    } catch (socketError) {
      console.error("Error emitiendo socket:", socketError);
    }

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

    const result = await updateKitchenItemStatus(
      itemId,
      status,
      req.user.appUserId,
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message,
      });
      return;
    }

    // Si el item está listo, notificar al mozo
    if (status === "ready") {
      try {
        // Consulta más simple para obtener la información necesaria
        const { data: itemData, error: itemError } = await supabaseAdmin
          .from("order_items")
          .select(
            `
            id,
            quantity,
            menu_items!inner(name),
            orders!inner(
              table_id,
              tables!inner(number, id_waiter)
            )
          `,
          )
          .eq("id", itemId)
          .single();

        if (!itemError && itemData) {
          const order = Array.isArray(itemData.orders)
            ? itemData.orders[0]
            : itemData.orders;
          const tables = order?.tables;
          const table = Array.isArray(tables) ? tables[0] : tables;
          const menuItems = itemData.menu_items;
          const menuItem = Array.isArray(menuItems) ? menuItems[0] : menuItems;

          if (
            table &&
            "id_waiter" in table &&
            "number" in table &&
            menuItem &&
            "name" in menuItem
          ) {
            await notifyWaiterKitchenItemsReady(
              table.id_waiter,
              table.number.toString(),
              [
                {
                  name: menuItem.name,
                  quantity: itemData.quantity || 1,
                },
              ],
            );
          }
        }
      } catch (notifyError) {
        console.error(
          "Error enviando notificación de plato listo:",
          notifyError,
        );
        // No bloqueamos la respuesta por error de notificación
      }
    }

    // Emitir socket al cliente para actualización en tiempo real
    try {
      const { data: itemData } = await supabaseAdmin
        .from("order_items")
        .select(
          `
          orders!inner(
            id_client
          )
        `,
        )
        .eq("id", itemId)
        .single();

      if (itemData) {
        const order = Array.isArray(itemData.orders)
          ? itemData.orders[0]
          : itemData.orders;

        if (order && "id_client" in order) {
          emitClientStateUpdate(order.id_client, "client:state-update", {
            type: "item_status_updated",
            itemId,
            status,
          });
        }
      }
    } catch (socketError) {
      console.error("Error emitiendo socket:", socketError);
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

    const result = await updateBartenderItemStatus(
      itemId,
      status,
      req.user.appUserId,
    );

    if (!result.success) {
      res.status(400).json({
        success: false,
        message: result.message,
      });
      return;
    }

    // Si el item está listo, notificar al mozo
    if (status === "ready") {
      try {
        // Consulta para obtener la información necesaria
        const { data: itemData, error: itemError } = await supabaseAdmin
          .from("order_items")
          .select(
            `
            id,
            quantity,
            menu_items!inner(name),
            orders!inner(
              table_id,
              tables!inner(number, id_waiter)
            )
          `,
          )
          .eq("id", itemId)
          .single();

        if (!itemError && itemData) {
          const order = Array.isArray(itemData.orders)
            ? itemData.orders[0]
            : itemData.orders;
          const tables = order?.tables;
          const table = Array.isArray(tables) ? tables[0] : tables;
          const menuItems = itemData.menu_items;
          const menuItem = Array.isArray(menuItems) ? menuItems[0] : menuItems;

          if (
            table &&
            "id_waiter" in table &&
            "number" in table &&
            menuItem &&
            "name" in menuItem
          ) {
            await notifyWaiterBartenderItemsReady(
              table.id_waiter,
              table.number.toString(),
              [
                {
                  name: menuItem.name,
                  quantity: itemData.quantity || 1,
                },
              ],
            );
          }
        }
      } catch (notifyError) {
        console.error(
          "Error enviando notificación de bebida lista:",
          notifyError,
        );
        // No bloqueamos la respuesta por error de notificación
      }
    }

    // Emitir socket al cliente para actualización en tiempo real
    try {
      const { data: itemData } = await supabaseAdmin
        .from("order_items")
        .select(
          `
          orders!inner(
            id_client
          )
        `,
        )
        .eq("id", itemId)
        .single();

      if (itemData) {
        const order = Array.isArray(itemData.orders)
          ? itemData.orders[0]
          : itemData.orders;

        if (order && "id_client" in order) {
          emitClientStateUpdate(order.id_client, "client:state-update", {
            type: "item_status_updated",
            itemId,
            status,
          });
        }
      }
    } catch (socketError) {
      console.error("Error emitiendo socket:", socketError);
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

    const tableId = req.params["tableId"];
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

// Procesar pago de una orden
export async function payOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const tableId = req.params["orderId"]; // Reusing orderId param for tableId
    const clientId = req.body.idClient || req.user.appUserId;
    const paymentDetails = req.body.paymentDetails; // Nuevos datos de pago con descuentos

    if (!tableId) {
      res.status(400).json({ error: "ID de mesa requerido" });
      return;
    }

    const result = await payOrder(tableId, clientId, paymentDetails);

    // Enviar notificación push a dueño y supervisor sobre el pago recibido
    try {
      // Obtener información de la mesa, cliente y mozo
      const { data: tableData, error: tableError } = await supabaseAdmin
        .from("tables")
        .select(
          `
          number,
          users!tables_id_client_fkey(first_name, last_name),
          waiter:users!tables_id_waiter_fkey(first_name, last_name)
        `,
        )
        .eq("id", tableId)
        .single();

      if (!tableError && tableData) {
        const clientData = (tableData as any).users;
        const waiterData = (tableData as any).waiter;

        const clientName = clientData
          ? `${clientData.first_name} ${clientData.last_name}`.trim()
          : "Cliente";

        const waiterName = waiterData
          ? `${waiterData.first_name} ${waiterData.last_name}`.trim()
          : "Mozo";

        // Calcular el monto total pagado
        const totalAmount = result.paidOrders.reduce(
          (sum, order) => sum + order.total_amount,
          0,
        );

        await notifyManagementPaymentReceived(
          clientName,
          tableData.number.toString(),
          totalAmount,
          waiterName,
        );
      }
    } catch (notifyError) {
      console.error("Error enviando notificación a gerencia:", notifyError);
      // No bloqueamos la respuesta por error de notificación
    }

    res.json(result);
  } catch (error: any) {
    console.error("❌ Error procesando pago:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al procesar el pago",
    });
  }
}

// Confirmar pago y liberar mesa (para mozos)
export async function confirmPaymentHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    const tableId = req.params["tableId"];
    const waiterId = req.user.appUserId;

    if (!tableId) {
      res.status(400).json({ error: "ID de mesa requerido" });
      return;
    }

    // Obtener el cliente que solicitó el pago buscando órdenes no pagadas
    const { data: unpaidOrders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("user_id")
      .eq("table_id", tableId)
      .eq("is_paid", false)
      .limit(1);

    if (ordersError || !unpaidOrders || unpaidOrders.length === 0) {
      res
        .status(400)
        .json({ error: "No se encontraron órdenes pendientes de pago" });
      return;
    }

    const payingClientId = unpaidOrders[0]?.user_id;

    if (!payingClientId) {
      res.status(400).json({
        error: "No se pudo identificar el cliente que solicitó el pago",
      });
      return;
    }

    // Generar factura ANTES de confirmar el pago
    let invoiceInfo: {
      generated: boolean;
      filePath?: string;
      fileName?: string;
      htmlContent?: string;
      isRegistered?: boolean;
      message?: string;
      error?: string;
    } = {
      generated: false,
      error: "No se generó factura",
    };

    try {
      // Obtener el cliente de la mesa para generar la factura
      const { data: tableData, error: tableError } = await supabaseAdmin
        .from("tables")
        .select("id_client")
        .eq("id", tableId)
        .single();

      if (!tableError && tableData?.id_client) {
        // PASO 1: Determinar si el cliente es registrado o anónimo
        const { getAuthEmailById } = await import("../admin/adminServices");
        const clientEmail = await getAuthEmailById(payingClientId);
        const isRegisteredUser = !!clientEmail;
        let invoiceResult;

        if (isRegisteredUser) {
          // CLIENTE REGISTRADO: Solo generar HTML (no guardar archivo)
          invoiceResult = await InvoiceService.generateInvoiceHTMLOnly(
            tableId,
            payingClientId,
          );

          if (invoiceResult.success && invoiceResult.htmlContent) {
            invoiceInfo = {
              generated: true,
              htmlContent: invoiceResult.htmlContent,
              isRegistered: true,
              message: "Factura generada exitosamente para envío por email",
            } as typeof invoiceInfo;
          } else {
            console.error(
              `❌ Error generando factura HTML: ${invoiceResult.error}`,
            );
            invoiceInfo = {
              generated: false,
              error: invoiceResult.error || "Error generando factura HTML",
            };
          }
        } else {
          // CLIENTE ANÓNIMO: Generar HTML y guardar archivo
          invoiceResult = await InvoiceService.generateInvoiceWithFile(
            tableId,
            payingClientId,
          );

          if (invoiceResult.success && invoiceResult.filePath) {
            const fileName = invoiceResult.filePath
              ? path.basename(invoiceResult.filePath)
              : undefined;
            invoiceInfo = {
              generated: true,
              filePath: invoiceResult.filePath,
              fileName: fileName,
              htmlContent: invoiceResult.htmlContent,
              isRegistered: false,
              message: "Factura generada exitosamente para descarga",
            } as typeof invoiceInfo;
          } else {
            console.error(
              `❌ Error generando factura con archivo: ${invoiceResult.error}`,
            );
            invoiceInfo = {
              generated: false,
              error:
                invoiceResult.error || "Error generando factura con archivo",
            };
          }
        }
      } else {
        console.error("❌ No se pudo obtener cliente de la mesa para factura");
        invoiceInfo = {
          generated: false,
          error: "No se pudo identificar el cliente para generar factura",
        };
      }
    } catch (invoiceError) {
      console.error("❌ Error en generación de factura:", invoiceError);
      invoiceInfo = {
        generated: false,
        error: "Error interno generando factura",
      };
    }

    // Confirmar pago y liberar mesa, pasando la información de la factura
    const result = await confirmPaymentAndReleaseTable(
      tableId,
      waiterId,
      payingClientId,
      invoiceInfo,
    );

    // Respuesta completa con información de pago y factura
    res.json({
      ...result,
      invoice: invoiceInfo,
    });
  } catch (error: any) {
    console.error("❌ Error confirmando pago:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al confirmar el pago",
    });
  }
}

// ============= CONTROLADORES PARA MOZOS - ITEMS READY =============

// Obtener items listos para entregar (ready) de las mesas asignadas al mozo
export async function getWaiterReadyItemsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que el usuario es mozo
    if (req.user.position_code !== "mozo") {
      res.status(403).json({
        error: "Solo los mozos pueden acceder a esta función",
      });
      return;
    }

    const waiterId = req.user.appUserId;
    const readyItems = await getWaiterReadyItems(waiterId);

    res.json({
      success: true,
      data: readyItems,
      message: `${readyItems.length} items listos para entregar`,
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo items ready para mozo:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message || "Error desconocido",
    });
  }
}

// Obtener mesas con pago pendiente de confirmación (para mozos)
export async function getWaiterPendingPaymentsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que el usuario es mozo
    if (req.user.position_code !== "mozo") {
      res.status(403).json({
        error: "Solo los mozos pueden acceder a esta función",
      });
      return;
    }

    const waiterId = req.user.appUserId;
    const pendingPayments = await getWaiterPendingPayments(waiterId);

    res.json({
      success: true,
      data: pendingPayments,
      message: `${pendingPayments.length} mesas con pago pendiente de confirmación`,
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo pagos pendientes para mozo:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message || "Error desconocido",
    });
  }
}

// Marcar item como entregado (ready -> delivered)
export async function markItemAsDeliveredHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que el usuario es mozo
    if (req.user.position_code !== "mozo") {
      res.status(403).json({
        error: "Solo los mozos pueden acceder a esta función",
      });
      return;
    }

    const { itemId } = req.params;
    const waiterId = req.user.appUserId;

    if (!itemId) {
      res.status(400).json({ error: "ID de item requerido" });
      return;
    }

    await markItemAsDelivered(itemId, waiterId);

    // Obtener información del cliente para emitir socket
    try {
      const { data: itemData } = await supabaseAdmin
        .from("order_items")
        .select(
          `
          orders!inner(
            id_client,
            table_id
          )
        `,
        )
        .eq("id", itemId)
        .single();

      if (itemData) {
        const order = Array.isArray(itemData.orders)
          ? itemData.orders[0]
          : itemData.orders;

        if (order && "id_client" in order) {
          emitClientStateUpdate(order.id_client, "client:state-update", {
            type: "item_delivered",
            itemId,
          });
        }
      }
    } catch (socketError) {
      console.error("Error emitiendo socket:", socketError);
    }

    res.json({
      success: true,
      message: "Item marcado como entregado",
    });
  } catch (error: any) {
    console.error("❌ Error marcando item como entregado:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al marcar item como entregado",
    });
  }
}

// PUT /api/orders/:orderId/submit-tanda-modifications - Reenviar modificaciones de tanda
export async function submitTandaModificationsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // Validar que el usuario esté autenticado
    if (!req.user) {
      res.status(401).json({ error: "No autenticado" });
      return;
    }

    // Solo clientes pueden reenviar modificaciones
    const allowedProfiles = ["cliente_registrado", "cliente_anonimo"];
    if (!allowedProfiles.includes(req.user.profile_code)) {
      res.status(403).json({
        error: "Solo clientes pueden reenviar modificaciones de tanda",
      });
      return;
    }

    const { orderId } = req.params;
    const { keepItems, newItems } = req.body;
    const clientId = req.user.appUserId;

    if (!orderId) {
      res.status(400).json({ error: "ID de orden requerido" });
      return;
    }
    await submitTandaModifications(orderId, clientId, keepItems, newItems);

    // Enviar notificación push al mozo sobre la resubmisión
    try {
      // Obtener información de la orden y mesa
      const { data: orderData, error: orderError } = await supabaseAdmin
        .from("orders")
        .select(
          `
          id,
          table_id,
          order_items(id),
          tables!inner(
            number,
            id_waiter,
            users!tables_id_client_fkey(first_name, last_name)
          )
        `,
        )
        .eq("id", orderId)
        .single();

      if (!orderError && orderData?.table_id) {
        const tableData = (orderData as any).tables;
        const clientData = tableData?.users;
        const clientName = clientData
          ? `${clientData.first_name} ${clientData.last_name}`.trim()
          : "Cliente";

        const itemsCount = (orderData as any).order_items.length;

        // Calcular total aproximado (esto se podría mejorar obteniendo el precio real)
        const estimatedTotal = itemsCount * 1500; // Estimación básica

        await notifyWaiterNewOrder(
          tableData.id_waiter,
          clientName,
          tableData.number.toString(),
          itemsCount,
          estimatedTotal,
        );
      }

      // Devolver orden actualizada
      const { data: updatedOrder } = await supabaseAdmin
        .from("orders")
        .select(
          `
          *,
          order_items(
            *,
            menu_items(*)
          )
        `,
        )
        .eq("id", orderId)
        .single();

      res.json({
        success: true,
        message: "Modificaciones de tanda reenviadas exitosamente",
        order: updatedOrder,
      });
    } catch (notifyError) {
      console.error("Error enviando notificación de resubmisión:", notifyError);
      // No bloqueamos la respuesta por error de notificación
      res.json({
        success: true,
        message: "Modificaciones de tanda reenviadas exitosamente",
      });
    }
  } catch (error: any) {
    console.error("❌ Error reenviando modificaciones de tanda:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al reenviar modificaciones de tanda",
    });
  }
}

// Obtener datos de pedido para generar factura en cliente anónimo
export async function getAnonymousOrderData(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const userId = req.user?.appUserId;

    if (!userId) {
      res.status(401).json({ error: "Usuario no autenticado" });
      return;
    }

    // Verificar que sea un usuario anónimo
    const { data: user, error: userError } = await supabaseAdmin
      .from("users")
      .select("profile_code, first_name, last_name")
      .eq("id", userId)
      .single();

    if (userError) {
      console.error("Error obteniendo usuario:", userError);
      res.status(500).json({ error: "Error obteniendo datos del usuario" });
      return;
    }

    if (!user || user.profile_code !== "cliente_anonimo") {
      res.json({ hasOrder: false });
      return;
    }

    // Buscar si tiene una orden pagada
    const { data: paidOrders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount, created_at, table_id")
      .eq("user_id", userId)
      .eq("is_paid", true)
      .order("created_at", { ascending: false })
      .limit(1);

    if (ordersError) {
      console.error("Error buscando órdenes pagadas:", ordersError);
      res.status(500).json({ error: "Error obteniendo datos del pedido" });
      return;
    }

    if (!paidOrders || paidOrders.length === 0) {
      res.json({ hasOrder: false });
      return;
    }

    const order = paidOrders[0];
    if (!order) {
      res.json({ hasOrder: false });
      return;
    }

    // Obtener datos de la mesa
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("number")
      .eq("id", order.table_id)
      .single();

    if (tableError) {
      console.error("Error obteniendo datos de mesa:", tableError);
    }

    // Obtener items de la orden
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        quantity,
        unit_price,
        menu_items(name, description, category)
      `,
      )
      .eq("order_id", order.id);

    if (itemsError) {
      console.error("Error obteniendo items de la orden:", itemsError);
      res.status(500).json({ error: "Error obteniendo items del pedido" });
      return;
    }

    // Formatear datos básicos para el PDF
    const tableNumber = tableData?.number || "N/A";

    const items =
      orderItems?.map((item: any) => ({
        name: item.menu_items.name,
        description: item.menu_items.description,
        category: item.menu_items.category,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.quantity * item.unit_price,
      })) || [];

    const subtotal = items.reduce(
      (sum: number, item: any) => sum + item.totalPrice,
      0,
    );

    res.json({
      hasOrder: true,
      orderData: {
        clientName: `${user.first_name || "Cliente"} ${user.last_name || "Anónimo"}`,
        tableNumber: tableNumber.toString(),
        items,
        subtotal,
        tipAmount: 0,
        gameDiscountAmount: 0,
        gameDiscountPercentage: 0,
        totalAmount: order.total_amount,
        satisfactionLevel: "",
        orderDate: new Date(order.created_at).toLocaleDateString("es-AR"),
        orderTime: new Date(order.created_at).toLocaleTimeString("es-AR"),
        invoiceNumber: `INV-${order.id.slice(0, 8).toUpperCase()}`,
      },
    });
  } catch (error: any) {
    console.error("❌ Error obteniendo datos del pedido:", error);
    res.status(500).json({ error: "Error interno del servidor" });
  }
}
