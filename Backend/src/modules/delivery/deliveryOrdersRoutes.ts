import express from "express";
import { authenticateUser } from "../../middlewares/authMiddleware";
import * as deliveryOrdersController from "./deliveryOrdersController";

const router = express.Router();

/**
 * POST /api/delivery-orders
 * Crear una nueva orden de delivery
 */
router.post(
  "/",
  authenticateUser,
  deliveryOrdersController.createDeliveryOrderHandler,
);

/**
 * GET /api/delivery-orders/user/me
 * Obtener órdenes de delivery del usuario autenticado
 */
router.get(
  "/user/me",
  authenticateUser,
  deliveryOrdersController.getMyDeliveryOrdersHandler,
);

/**
 * GET /api/delivery-orders/:orderId
 * Obtener una orden de delivery por ID
 */
router.get(
  "/:orderId",
  authenticateUser,
  deliveryOrdersController.getDeliveryOrderByIdHandler,
);

/**
 * PUT /api/delivery-orders/:orderId/items/batch
 * Actualizar items en batch (enviar a cocina o bar)
 */
router.put(
  "/:orderId/items/batch",
  authenticateUser,
  deliveryOrdersController.updateItemsBatchHandler,
);

export default router;
