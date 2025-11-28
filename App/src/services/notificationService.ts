import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";

// Configurar handler solo si no estamos en Expo Go
if (Constants.executionEnvironment !== "storeClient") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export interface NotificationData {
  type:
    | "new_client_registration"
    | "payment_confirmed"
    | "anonymous_invoice_ready"
    | "chat_message_client" // Cliente envía mensaje al mesero
    | "chat_message_waiter" // Mesero envía mensaje al cliente
    | "delivery_chat_message"; // Mensajes del chat delivery (cliente-repartidor)
  clientId?: string;
  clientName?: string;
  tableNumber?: string;
  waiterName?: string;
  driverName?: string;
  totalAmount?: number;
  screen?: string;
  downloadUrl?: string;
  fileName?: string;
  message?: string;
  chatId?: string;
  deliveryId?: string;
  invoiceData?: {
    generated: boolean;
    filePath?: string;
    fileName?: string;
    message?: string;
    error?: string;
  };
}

export class NotificationService {
  private static expoPushToken: string | null = null;
  private static notificationHandlers: ((data: NotificationData) => void)[] =
    [];

  static addNotificationHandler(handler: (data: NotificationData) => void) {
    this.notificationHandlers.push(handler);
  }

  static removeNotificationHandler(handler: (data: NotificationData) => void) {
    this.notificationHandlers = this.notificationHandlers.filter(
      h => h !== handler,
    );
  }

  private static handleNotificationReceived(data: NotificationData) {
    console.log("📱 Notification received:", data);
    this.notificationHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error("❌ Error in notification handler:", error);
      }
    });
  }

  static async registerForPushNotifications(): Promise<string | null> {
    if (Constants.executionEnvironment === "storeClient" || !Device.isDevice) {
      return null;
    }

    try {
      // Solicitar permisos explícitamente
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        console.log("🔑 Requesting notification permissions...");
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        console.log("❌ Notification permissions denied");
        return null;
      }

      // Intentar obtener token REAL con projectId específico
      console.log("🎯 Attempting to get REAL Expo push token...");
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: "c88bacd6-f3c2-4626-ae66-3a6cb5659877",
      });

      this.expoPushToken = tokenData.data;
      console.log("✅ REAL Expo push token obtained:", this.expoPushToken);

      return this.expoPushToken;
    } catch (error) {
      console.error("❌ Error getting real push token:", error);

      // Segundo intento sin projectId
      try {
        console.log("🔄 Trying without explicit projectId...");
        const tokenData = await Notifications.getExpoPushTokenAsync();
        this.expoPushToken = tokenData.data;
        console.log("✅ Alternative token obtained:", this.expoPushToken);
        return this.expoPushToken;
      } catch (fallbackError) {
        console.error("❌ Fallback token attempt failed:", fallbackError);
        return null;
      }
    }
  }

  static async setupNotificationChannel() {
    if (
      Constants.executionEnvironment === "storeClient" ||
      Platform.OS !== "android"
    ) {
      return;
    }

    await Notifications.setNotificationChannelAsync("client_registrations", {
      name: "Registro de Clientes",
      description: "Notificaciones de nuevos registros de clientes",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#d4af37",
    });

    await Notifications.setNotificationChannelAsync("payment_confirmations", {
      name: "Confirmación de Pagos",
      description: "Notificaciones de pagos confirmados",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 500, 250, 500],
      lightColor: "#10b981",
    });

    await Notifications.setNotificationChannelAsync("chat_messages", {
      name: "Mensajes de Chat",
      description: "Notificaciones de mensajes en chats (mesa y delivery)",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#3b82f6",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync("kitchen_orders", {
      name: "Pedidos de Cocina",
      description: "Notificaciones de nuevos pedidos para cocina",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f59e0b",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync("bar_orders", {
      name: "Pedidos de Bar",
      description: "Notificaciones de nuevos pedidos para bartender",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#8b5cf6",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync("waiter_orders", {
      name: "Pedidos de Mesero",
      description: "Notificaciones de nuevos pedidos para meseros",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#f97316",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync("order_updates", {
      name: "Actualizaciones de Pedidos",
      description:
        "Notificaciones sobre estado de pedidos (listos, modificados, etc)",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#22c55e",
      sound: "default",
    });

    await Notifications.setNotificationChannelAsync("reservation_updates", {
      name: "Reservas",
      description: "Notificaciones de nuevas reservas y actualizaciones",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#d4af37",
      sound: "default",
    });
  }

  static getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  static async showLocalNotification(title: string, body: string, data?: any) {
    const channelId =
      data?.type === "payment_confirmed"
        ? "payment_confirmations"
        : "client_registrations";

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: "default",
        ...(Platform.OS === "android" && {
          channelId,
        }),
      },
      trigger: null,
    });

    // Manejar la notificación internamente
    if (data) {
      this.handleNotificationReceived(data);
    }
  }

  static setupNotificationListeners() {
    // Listener para cuando la app está en foreground
    Notifications.addNotificationReceivedListener(notification => {
      console.log("📱 Notification received in foreground:", notification);
      const data = notification.request.content
        .data as unknown as NotificationData;
      if (data && data.type) {
        this.handleNotificationReceived(data);
      }
    });

    // Listener para cuando el usuario toca la notificación
    Notifications.addNotificationResponseReceivedListener(response => {
      console.log("👆 Notification tapped:", response);
      const data = response.notification.request.content
        .data as unknown as NotificationData;
      if (data && data.type) {
        this.handleNotificationReceived(data);
      }
    });
  }
}
