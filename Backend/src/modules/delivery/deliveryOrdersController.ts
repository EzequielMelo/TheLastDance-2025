import type { Request, Response } from "express";
import * as deliveryOrdersService from "./deliveryOrdersServices";

/**
 * POST /api/delivery-orders
 * Crear una nueva orden de delivery
 */
export async function createDeliveryOrderHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { items, totalAmount, estimatedTime, notes } = req.body;

    // Validar datos requeridos
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: "Debes incluir al menos un producto",
      });
      return;
    }

    if (!totalAmount || !estimatedTime) {
      res.status(400).json({
        success: false,
        error: "Faltan datos requeridos (totalAmount, estimatedTime)",
      });
      return;
    }

    const orderData = {
      userId: req.user.appUserId,
      items,
      totalAmount,
      estimatedTime,
      notes,
    };

    const order = await deliveryOrdersService.createDeliveryOrder(orderData);

    res.status(201).json({
      success: true,
      order,
      message: "Orden de delivery creada exitosamente",
    });
  } catch (error: any) {
    console.error("❌ Error en createDeliveryOrderHandler:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al crear la orden de delivery",
    });
  }
}

/**
 * GET /api/delivery-orders/:orderId
 * Obtener una orden de delivery por ID
 */
export async function getDeliveryOrderByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const { orderId } = req.params;

    if (!orderId) {
      res.status(400).json({
        success: false,
        error: "ID de orden requerido",
      });
      return;
    }

    const order = await deliveryOrdersService.getDeliveryOrderById(orderId);

    res.status(200).json({
      success: true,
      order,
    });
  } catch (error: any) {
    console.error("❌ Error en getDeliveryOrderByIdHandler:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al obtener la orden de delivery",
    });
  }
}

/**
 * GET /api/delivery-orders/user/me
 * Obtener órdenes de delivery del usuario autenticado
 */
export async function getMyDeliveryOrdersHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    const orders = await deliveryOrdersService.getDeliveryOrdersByUser(
      req.user.appUserId,
    );

    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error: any) {
    console.error("❌ Error en getMyDeliveryOrdersHandler:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al obtener órdenes de delivery",
    });
  }
}

/**
 * PUT /api/delivery-orders/:orderId/items/batch
 * Actualizar items en batch (enviar a cocina o bar)
 */
export async function updateItemsBatchHandler(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: "Usuario no autenticado",
      });
      return;
    }

    // Verificar permisos (solo dueño y supervisor)
    if (
      req.user.profile_code !== "dueno" &&
      req.user.profile_code !== "supervisor"
    ) {
      res.status(403).json({
        success: false,
        error: "No tienes permisos para realizar esta acción",
      });
      return;
    }

    const { orderId } = req.params;
    const { itemIds, status, station } = req.body;

    if (
      !orderId ||
      !itemIds ||
      !Array.isArray(itemIds) ||
      itemIds.length === 0
    ) {
      res.status(400).json({
        success: false,
        error: "Faltan datos requeridos (orderId, itemIds)",
      });
      return;
    }

    if (!status || !station) {
      res.status(400).json({
        success: false,
        error: "Faltan datos requeridos (status, station)",
      });
      return;
    }

    if (station !== "kitchen" && station !== "bar") {
      res.status(400).json({
        success: false,
        error: "La estación debe ser 'kitchen' o 'bar'",
      });
      return;
    }

    await deliveryOrdersService.updateItemsBatch(
      orderId,
      itemIds,
      status,
      station,
    );

    res.status(200).json({
      success: true,
      message: `Items enviados a ${station === "kitchen" ? "cocina" : "bar"}`,
    });
  } catch (error: any) {
    console.error("❌ Error en updateItemsBatchHandler:", error);
    res.status(400).json({
      success: false,
      error: error.message || "Error al actualizar items",
    });
  }
}
