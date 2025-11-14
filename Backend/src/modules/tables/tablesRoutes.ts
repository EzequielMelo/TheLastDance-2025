import express from "express";
import { authenticateUser } from "../../middlewares/authMiddleware";
import { roleGuard } from "../../middlewares/roleGuard";
import {
  getWaitingListHandler,
  addToWaitingListHandler,
  getMyPositionHandler,
  getClientPositionHandler,
  cancelWaitingListHandler,
  markAsNoShowHandler,
  getTablesStatusHandler,
  assignTableHandler,
  activateTableHandler,
  freeTableHandler,
  cancelTableReservationHandler,
  getMyTableHandler,
  getMyAssignedTableHandler,
  getMyStatusHandler,
  confirmDeliveryHandler,
  getBillData,
  requestBillHandler,
  getTableOrderStatusHandler,
} from "./tablesController";

const router = express.Router();

// ========== RUTAS PARA LISTA DE ESPERA ==========

// GET /api/tables/waiting-list - Ver lista de espera (solo staff)
router.get(
  "/waiting-list",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre"]),
  getWaitingListHandler,
);

// POST /api/tables/waiting-list - Agregar a lista de espera (cualquier usuario autenticado)
router.post("/waiting-list", authenticateUser, addToWaitingListHandler);

// GET /api/tables/waiting-list/my-position - Mi posición en la cola (clientes)
router.get("/waiting-list/my-position", authenticateUser, getMyPositionHandler);

// GET /api/tables/waiting-list/position/:clientId - Posición de cliente específico (staff)
router.get(
  "/waiting-list/position/:clientId",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre"]),
  getClientPositionHandler,
);

// PUT /api/tables/waiting-list/:id/cancel - Cancelar entrada en lista (staff + propio cliente)
router.put(
  "/waiting-list/:id/cancel",
  authenticateUser,
  cancelWaitingListHandler,
);

// PUT /api/tables/waiting-list/:id/no-show - Marcar como no show (solo staff)
router.put(
  "/waiting-list/:id/no-show",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre"]),
  markAsNoShowHandler,
);

// ========== RUTAS PARA MESAS ==========

// GET /api/tables/status - Ver estado de todas las mesas (staff)
router.get(
  "/status",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre", "mozo"]),
  getTablesStatusHandler,
);

// GET /api/tables/my-table - Ver mi mesa ocupada (clientes)
router.get("/my-table", authenticateUser, getMyTableHandler);

// GET /api/tables/my-assigned - Ver mi mesa asignada pero no ocupada (clientes)
router.get("/my-assigned", authenticateUser, getMyAssignedTableHandler);

// GET /api/tables/my-status - Ver estado completo del cliente (clientes)
router.get("/my-status", authenticateUser, getMyStatusHandler);

// POST /api/tables/assign - Asignar cliente a mesa (maitre, supervisor, dueño)
router.post(
  "/assign",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre"]),
  assignTableHandler,
);

// POST /api/tables/:id/activate - Activar mesa por QR (solo clientes)
router.post("/:id/activate", authenticateUser, activateTableHandler);

// POST /api/tables/:id/free - Liberar mesa (staff)
router.post(
  "/:id/free",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre", "mozo"]),
  freeTableHandler,
);

// POST /api/tables/:id/cancel-reservation - Cancelar reserva de una mesa (staff)
router.post(
  "/:id/cancel-reservation",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre"]),
  cancelTableReservationHandler,
);

// POST /api/tables/:id/confirm-delivery - Confirmar entrega de pedido (solo clientes)
router.post("/:id/confirm-delivery", authenticateUser, confirmDeliveryHandler);

// POST /api/tables/:id/request-bill - Solicitar la cuenta (solo clientes)
router.post("/:id/request-bill", authenticateUser, requestBillHandler);

// GET /api/tables/:tableId/order-status - Consultar solo el estado de productos (QR flotante)
router.get("/:tableId/order-status", authenticateUser, getTableOrderStatusHandler);

// GET /api/tables/:tableId/bill - Obtener datos de la cuenta para pagar (solo clientes)
router.get("/:tableId/bill", authenticateUser, getBillData);

export default router;
