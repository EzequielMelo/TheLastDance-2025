import { Router } from "express";
import { authenticateUser } from "../../middlewares/authMiddleware";
import { DeliveryChatController } from "./deliveryChatController";

const router = Router();

/**
 * Todas las rutas requieren autenticación
 */
router.use(authenticateUser);

/**
 * @route   GET /api/delivery-chat/delivery/:deliveryId
 * @desc    Obtener o crear chat para un delivery
 * @access  Private (cliente o repartidor del delivery)
 */
router.get(
  "/delivery/:deliveryId",
  DeliveryChatController.getOrCreateChatByDelivery,
);

/**
 * @route   GET /api/delivery-chat/my-chats
 * @desc    Obtener chats activos del usuario
 * @access  Private
 */
router.get("/my-chats", DeliveryChatController.getMyChats);

/**
 * @route   GET /api/delivery-chat/:chatId/messages
 * @desc    Obtener mensajes de un chat
 * @access  Private (participantes del chat)
 */
router.get("/:chatId/messages", DeliveryChatController.getMessages);

/**
 * @route   POST /api/delivery-chat/:chatId/messages
 * @desc    Enviar mensaje en un chat
 * @access  Private (participantes del chat)
 */
router.post("/:chatId/messages", DeliveryChatController.sendMessage);

/**
 * @route   PUT /api/delivery-chat/:chatId/read
 * @desc    Marcar mensajes como leídos
 * @access  Private (participantes del chat)
 */
router.put("/:chatId/read", DeliveryChatController.markAsRead);

/**
 * @route   GET /api/delivery-chat/:chatId/unread-count
 * @desc    Obtener cantidad de mensajes no leídos
 * @access  Private (participantes del chat)
 */
router.get("/:chatId/unread-count", DeliveryChatController.getUnreadCount);

export default router;
