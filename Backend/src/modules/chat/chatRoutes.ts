import { Router } from "express";
import { ChatController } from "./chatController";
import { authenticateUser } from "../../middlewares/authMiddleware";

const router = Router();

// Aplicar middleware de autenticación a todas las rutas
router.use(authenticateUser);

// Obtener o crear chat por mesa
router.get("/table/:tableId", ChatController.getOrCreateChat);

// Obtener mensajes de un chat
router.get("/:chatId/messages", ChatController.getMessages);

// Marcar mensajes como leídos
router.put("/:chatId/read", ChatController.markAsRead);

// Obtener chats activos del mesero (solo para meseros)
router.get("/waiter/active", ChatController.getWaiterChats);

export default router;
