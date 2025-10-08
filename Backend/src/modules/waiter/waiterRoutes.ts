import { Router } from "express";
import { authenticateUser } from "../../middlewares/authMiddleware";
import {
  getMyWaiterInfo,
  getAvailableTables,
  assignTable,
  unassignTable,
  getAllWaiters,
  checkCanUnassignTable,
} from "./waiterController";

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateUser);

// Rutas para meseros
router.get("/me", getMyWaiterInfo); // GET /api/waiter/me
router.get("/available-tables", getAvailableTables); // GET /api/waiter/available-tables
router.post("/assign-table", assignTable); // POST /api/waiter/assign-table
router.delete("/unassign-table/:tableId", unassignTable); // DELETE /api/waiter/unassign-table/:tableId
router.get("/can-unassign/:tableId", checkCanUnassignTable); // GET /api/waiter/can-unassign/:tableId

// Rutas administrativas (solo para dueno/supervisor)
router.get("/all", getAllWaiters); // GET /api/waiter/all

export default router;
