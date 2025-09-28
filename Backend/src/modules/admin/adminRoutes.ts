import express from "express";
import { authenticateUser } from "../../middlewares/authMiddleware";
import { roleGuard } from "../../middlewares/roleGuard";
import { listClients, approveClient, rejectClient } from "./adminController";

const router = express.Router();

// Solo dueño/supervisor
router.use(authenticateUser, roleGuard(["dueno", "supervisor"]));

router.get("/clients", listClients);
router.post("/clients/:id/approve", approveClient);
router.post("/clients/:id/reject", rejectClient);

export default router;
