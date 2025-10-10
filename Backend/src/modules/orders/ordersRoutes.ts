import express from "express";
import { authenticateUser } from "../../middlewares/authMiddleware";
import {
  createOrderHandler,
  getOrderHandler,
  getUserOrdersHandler,
  getTableOrdersHandler,
  getPendingOrdersHandler,
  getWaiterPendingOrdersHandler,
  getWaiterActiveOrdersHandler,
  waiterOrderActionHandler,
  addItemsToPartialOrderHandler,
  addItemsToExistingOrderHandler,
  waiterItemsActionHandler,
  getWaiterPendingItemsHandler,
  getWaiterPendingBatchesHandler,
  replaceRejectedItemsHandler,
  rejectIndividualItemsHandler,
  approveBatchCompletelyHandler,
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

// Rutas específicas para mozos
router.get("/waiter/pending", getWaiterPendingOrdersHandler);
router.get("/waiter/active", getWaiterActiveOrdersHandler);
router.get("/waiter/pending-items", getWaiterPendingItemsHandler); // Solo items pendientes (legacy)
router.get("/waiter/pending-batches", getWaiterPendingBatchesHandler); // Tandas pendientes agrupadas por batch_id
router.put("/:orderId/waiter-action", waiterOrderActionHandler);
router.put("/:orderId/waiter-items-action", waiterItemsActionHandler); // Acción sobre items específicos

// Nuevas rutas para rechazar/aprobar items individuales
router.put("/:orderId/reject-individual-items", rejectIndividualItemsHandler); // Marcar items como no disponibles - devuelve toda la tanda
router.put("/:orderId/approve-batch", approveBatchCompletelyHandler); // Aprobar toda la tanda completa

// Agregar items a pedido parcial (legacy)
router.put("/:orderId/add-items", addItemsToPartialOrderHandler);
// Agregar items a cualquier orden existente (nuevo sistema granular)
router.put("/:orderId/add-items-to-existing", addItemsToExistingOrderHandler);
// Reemplazar items rechazados con nuevos items
router.put("/:orderId/replace-rejected-items", replaceRejectedItemsHandler);

// Obtener pedido específico por ID
router.get("/:orderId", getOrderHandler);

// Obtener pedidos de una mesa específica
router.get("/table/:tableId", getTableOrdersHandler);

// RUTA OBSOLETA - Eliminada con el nuevo sistema de estados por item
// Los estados ahora se manejan únicamente a nivel de item individual

export default router;
