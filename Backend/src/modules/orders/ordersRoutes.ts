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
  getKitchenPendingOrdersHandler,
  updateKitchenItemStatusHandler,
  getBartenderPendingOrdersHandler,
  updateBartenderItemStatusHandler,
  checkTableDeliveryStatusHandler,
  getTableOrdersStatusHandler,
  rejectIndividualItemsHandler,
  approveBatchCompletelyHandler,
  payOrderHandler,
  confirmPaymentHandler,
  getWaiterReadyItemsHandler,
  getWaiterPendingPaymentsHandler,
  markItemAsDeliveredHandler,
  submitTandaModificationsHandler,
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
router.get("/waiter/ready-items", getWaiterReadyItemsHandler); // Items listos para entregar
router.get("/waiter/pending-payments", getWaiterPendingPaymentsHandler); // Mesas con pago pendiente de confirmación
router.put("/:orderId/waiter-action", waiterOrderActionHandler);
router.put("/:orderId/waiter-items-action", waiterItemsActionHandler); // Acción sobre items específicos
router.put("/waiter/item/:itemId/delivered", markItemAsDeliveredHandler); // Marcar item como entregado

// Nuevas rutas para rechazar/aprobar items individuales
router.put("/:orderId/reject-individual-items", rejectIndividualItemsHandler); // Marcar items como no disponibles - devuelve toda la tanda
router.put("/:orderId/approve-batch", approveBatchCompletelyHandler); // Aprobar toda la tanda completa

// Agregar items a pedido parcial (legacy)
router.put("/:orderId/add-items", addItemsToPartialOrderHandler);
// Agregar items a cualquier orden existente (nuevo sistema granular)
router.put("/:orderId/add-items-to-existing", addItemsToExistingOrderHandler);
// Reemplazar items rechazados con nuevos items
router.put("/:orderId/replace-rejected-items", replaceRejectedItemsHandler);

// Reenviar modificaciones de tanda (cambiar items 'needs_modification' a 'pending')
router.put("/:orderId/submit-tanda-modifications", submitTandaModificationsHandler);

// Procesar pago de todas las órdenes de una mesa (usando orderId como tableId)
router.put("/:orderId/pay", payOrderHandler);

// Confirmar pago y liberar mesa (para mozos)
router.put("/table/:tableId/confirm-payment", confirmPaymentHandler);

// Obtener pedido específico por ID
router.get("/:orderId", getOrderHandler);

// Obtener pedidos de una mesa específica
router.get("/table/:tableId", getTableOrdersHandler);

// Obtener estado de pedidos de una mesa (cliente escanea QR)
router.get("/table/:tableId/status", getTableOrdersStatusHandler);

// Verificar si todos los items de una mesa están entregados
router.get("/table/:tableId/delivery-status", checkTableDeliveryStatusHandler);

// ============= RUTAS PARA COCINA =============
// Obtener pedidos pendientes para cocina (solo cocineros)
router.get("/kitchen/pending", getKitchenPendingOrdersHandler);

// Actualizar status de item de cocina
router.put("/kitchen/item/:itemId/status", updateKitchenItemStatusHandler);

// ============= RUTAS PARA BAR =============
// Obtener pedidos pendientes para bar (solo bartenders)
router.get("/bar/pending", getBartenderPendingOrdersHandler);

// Actualizar status de item de bar
router.put("/bar/item/:itemId/status", updateBartenderItemStatusHandler);

// RUTA OBSOLETA - Eliminada con el nuevo sistema de estados por item
// Los estados ahora se manejan únicamente a nivel de item individual

export default router;
