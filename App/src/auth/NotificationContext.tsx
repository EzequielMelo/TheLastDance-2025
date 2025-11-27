import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import Constants from "expo-constants";
import { NotificationService } from "../services/notificationService";
import { AuthContext } from "./AuthContext";
import api from "../api/axios";
import { useChatNotificationHandler } from "../Hooks/useChatNotificationHandler";
import CustomAlert from "../components/common/CustomAlert";

interface CustomAlertConfig {
  visible: boolean;
  title: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
  buttons: Array<{
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }>;
}

interface NotificationContextType {
  expoPushToken: string | null;
  sendTokenToBackend: () => Promise<void>;
  showTestNotification: () => Promise<void>;
  setupPaymentNotificationHandler: (handler: (data: any) => void) => void;
  showCustomAlert: {
    // Sobrecarga 1: Formato antiguo (para compatibilidad)
    (
      title: string,
      message: string,
      type?: "success" | "error" | "warning" | "info",
      buttons?: Array<{
        text: string;
        onPress?: () => void;
        style?: "default" | "cancel" | "destructive";
      }>,
    ): void;
    // Sobrecarga 2: Formato nuevo (objeto config)
    (config: Omit<CustomAlertConfig, "visible">): void;
  };
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  sendTokenToBackend: async () => {},
  showTestNotification: async () => {},
  setupPaymentNotificationHandler: () => {},
  showCustomAlert: () => {},
});

export const useNotifications = () => useContext(NotificationContext);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
}) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const { user, token } = useContext(AuthContext);
  const [alertConfig, setAlertConfig] = useState<CustomAlertConfig>({
    visible: false,
    title: "",
    message: "",
    type: "info",
    buttons: [{ text: "OK" }],
  });

  // Hook para manejar notificaciones de chat (mesa y delivery)
  useChatNotificationHandler();

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    // Enviar token tanto para usuarios registrados como anónimos
    if (user && token && expoPushToken) {
      sendTokenToBackend();
    }
  }, [user, token, expoPushToken]);

  const setupPaymentNotificationHandler = (handler: (data: any) => void) => {
    try {
      // Configurar listeners de notificaciones
      NotificationService.setupNotificationListeners();

      // Agregar handler para notificaciones de pago
      NotificationService.addNotificationHandler(data => {
        if (
          data.type === "payment_confirmed" ||
          data.type === "anonymous_invoice_ready"
        ) {
          handler(data);
        }
      });
    } catch (error) {}
  };

  const generateToken = () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 15);
    const tokenId = (timestamp + randomPart).substr(0, 22);
    return `ExponentPushToken[${tokenId}]`;
  };

  const setupNotifications = async () => {
    try {
      // Configurar canal de notificaciones para Android
      await NotificationService.setupNotificationChannel();

      // SIEMPRE intentar obtener token REAL primero
      let token = await NotificationService.registerForPushNotifications();

      if (token) {
        setExpoPushToken(token);
        return;
      }

      // Solo usar token simulado si es Expo Go Y falló el real
      const isExpoGo = Constants.executionEnvironment === "storeClient";
      if (isExpoGo) {
        const simulatedToken = generateToken();
        setExpoPushToken(simulatedToken);
        return;
      }

      setExpoPushToken(null);
    } catch (error) {
      // Solo en caso de error crítico, usar token simulado
      const isExpoGo = Constants.executionEnvironment === "storeClient";
      if (isExpoGo) {
        setExpoPushToken(generateToken());
      }
    }
  };

  const sendTokenToBackend = async () => {
    if (!expoPushToken || !token) {
      return;
    }

    try {
      await api.post("/auth/update-push-token", {
        pushToken: expoPushToken,
      });
    } catch (error: any) {}
  };

  const showTestNotification = async () => {
    await NotificationService.showLocalNotification(
      "Nuevo cliente registrado",
      "Un nuevo cliente se ha registrado y necesita aprobación",
      {
        type: "new_client_registration",
        clientId: "test123",
        clientName: "Cliente de Prueba",
      },
    );
  };

  const showCustomAlert = (
    titleOrConfig: string | Omit<CustomAlertConfig, "visible">,
    message?: string,
    type: "success" | "error" | "warning" | "info" = "info",
    buttons: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }> = [{ text: "OK" }],
  ) => {
    // Si el primer argumento es un objeto, usar formato nuevo
    if (typeof titleOrConfig === "object") {
      setAlertConfig({ visible: true, ...titleOrConfig });
    } else {
      // Formato antiguo (compatibilidad)
      setAlertConfig({
        visible: true,
        title: titleOrConfig,
        message: message || "",
        type,
        buttons,
      });
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        sendTokenToBackend,
        showTestNotification,
        setupPaymentNotificationHandler,
        showCustomAlert,
      }}
    >
      {children}
      <CustomAlert
        visible={alertConfig.visible}
        onClose={() => setAlertConfig({ ...alertConfig, visible: false })}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
    </NotificationContext.Provider>
  );
};
