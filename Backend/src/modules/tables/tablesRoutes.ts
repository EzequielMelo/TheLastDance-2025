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
  freeTableHandler,
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

// POST /api/tables/assign - Asignar cliente a mesa (maitre, supervisor, dueño)
router.post(
  "/assign",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre"]),
  assignTableHandler,
);

// POST /api/tables/:id/free - Liberar mesa (staff)
router.post(
  "/:id/free",
  authenticateUser,
  roleGuard(["dueno", "supervisor", "maitre", "mozo"]),
  freeTableHandler,
);

export default router;
