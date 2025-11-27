import { useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/RootStackParamList";
import {
  NotificationService,
  NotificationData,
} from "../services/notificationService";
import { useNotifications } from "../auth/NotificationContext";
import { Logger } from "../utils/Logger";

type NavigationProp = StackNavigationProp<RootStackParamList>;

/**
 * Hook para manejar notificaciones de chat (mesa y delivery)
 * Se ejecuta cuando llegan notificaciones push de mensajes de chat
 */
export const useChatNotificationHandler = () => {
  // Usar try-catch para manejar el caso donde NavigationContainer no está listo
  let navigation: NavigationProp | null = null;
  try {
    navigation = useNavigation<NavigationProp>();
  } catch (error) {
    // NavigationContainer no está disponible aún, navigation será null
  }
  
  const { showCustomAlert } = useNotifications();

  useEffect(() => {
    // Si no hay navegación disponible, no configurar handlers
    if (!navigation) {
      return;
    }

    const handleChatNotification = (data: NotificationData) => {
      Logger.info("📨 [CHAT NOTIFICATION] Recibida:", data);

      switch (data.type) {
        case "chat_message_client":
          // Mesero recibe mensaje del cliente
          handleWaiterReceivesMessage(data);
          break;

        case "chat_message_waiter":
          // Cliente recibe mensaje del mesero
          handleClientReceivesMessage(data);
          break;

        case "delivery_chat_message":
          // Mensaje del chat de delivery (cliente o repartidor)
          handleDeliveryChatMessage(data);
          break;

        default:
          break;
      }
    };

    // Registrar handler
    NotificationService.addNotificationHandler(handleChatNotification);

    // Cleanup
    return () => {
      NotificationService.removeNotificationHandler(handleChatNotification);
    };
  }, [navigation, showCustomAlert]);

  /**
   * Mesero recibe mensaje del cliente
   */
  const handleWaiterReceivesMessage = (data: NotificationData) => {
    const clientName = data.clientName || "Cliente";
    const tableNumber = data.tableNumber || "?";
    const message = data.message || "Nuevo mensaje";

    showCustomAlert({
      title: `${clientName} - Mesa #${tableNumber}`,
      message: message,
      type: "info",
      buttons: [
        {
          text: "Ver Chat",
          style: "default",
          onPress: () => {
            if (navigation && data.chatId && data.tableNumber) {
              navigation.navigate("TableChatScreen" as any, {
                tableId: data.tableNumber,
                chatId: data.chatId,
              });
            }
          },
        },
        {
          text: "Después",
          style: "cancel",
        },
      ],
    });
  };

  /**
   * Cliente recibe mensaje del mesero
   */
  const handleClientReceivesMessage = (data: NotificationData) => {
    const waiterName = data.waiterName || "Mesero";
    const tableNumber = data.tableNumber || "?";
    const message = data.message || "Nuevo mensaje";

    showCustomAlert({
      title: `${waiterName} - Mesa #${tableNumber}`,
      message: message,
      type: "info",
      buttons: [
        {
          text: "Ver Chat",
          style: "default",
          onPress: () => {
            if (navigation && data.chatId && data.tableNumber) {
              navigation.navigate("TableChatScreen" as any, {
                tableId: data.tableNumber,
                chatId: data.chatId,
              });
            }
          },
        },
        {
          text: "Después",
          style: "cancel",
        },
      ],
    });
  };

  /**
   * Mensaje del chat de delivery (cliente o repartidor)
   */
  const handleDeliveryChatMessage = (data: NotificationData) => {
    const senderName = data.clientName || data.driverName || "Mensaje";
    const message = data.message || "Nuevo mensaje";
    const emoji = data.driverName ? "🚗" : "📦";

    showCustomAlert({
      title: `${emoji} ${senderName}`,
      message: message,
      type: "info",
      buttons: [
        {
          text: "Ver Chat",
          style: "default",
          onPress: () => {
            if (navigation && data.deliveryId) {
              navigation.navigate("DeliveryChatScreen" as any, {
                deliveryId: data.deliveryId,
              });
            }
          },
        },
        {
          text: "Después",
          style: "cancel",
        },
      ],
    });
  };
};
