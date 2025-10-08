import express from "express";
import { authenticateUser } from "../../middlewares/authMiddleware";
import {
  createOrderHandler,
  getOrderHandler,
  getUserOrdersHandler,
  getTableOrdersHandler,
  updateOrderStatusHandler,
  getPendingOrdersHandler,
} from "./ordersController";

const router = express.Router();

// Rutas protegidas - requieren autenticación
router.use(authenticateUser);

// Crear nuevo pedido
router.post("/", createOrderHandler);

// Obtener pedidos del usuario actual
router.get("/my-orders", getUserOrdersHandler);

// Obtener pedidos pendientes (para empleados)
router.get("/pending", getPendingOrdersHandler);

// Obtener pedido específico por ID
router.get("/:orderId", getOrderHandler);

// Obtener pedidos de una mesa específica
router.get("/table/:tableId", getTableOrdersHandler);

// Actualizar estado del pedido (para empleados)
router.patch("/:orderId/status", updateOrderStatusHandler);

export default router;