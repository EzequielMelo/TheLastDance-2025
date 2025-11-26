import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { RootStackNavigationProp } from "../navigation/RootStackParamList";
import { useNotifications } from "../auth/NotificationContext";

export const usePaymentNotificationHandler = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { showCustomAlert } = useNotifications();

  const handlePaymentConfirmedNotification = useCallback(
    (notificationData: {
      type: string;
      tableNumber?: string;
      waiterName?: string;
      totalAmount?: number;
      screen?: string;
      downloadUrl?: string;
      fileName?: string;
      invoiceData?: {
        generated: boolean;
        filePath?: string;
        fileName?: string;
        message?: string;
        error?: string;
      };
    }) => {
      try {
        console.log(
          "📱 Handling payment confirmed notification:",
          notificationData,
        );

        if (
          notificationData.type === "payment_confirmed" ||
          notificationData.type === "anonymous_invoice_ready"
        ) {
          const waiterName = notificationData.waiterName || "El mozo";
          const amount = notificationData.totalAmount || 0;

          // Mostrar CustomAlert con confirmación de pago y redirigir al Home
          showCustomAlert(
            "✅ Pago Confirmado",
            `${waiterName} confirmó tu pago de $${amount.toLocaleString()}.\n\n¡Tu factura está lista! Podrás descargarla desde la pantalla principal.`,
            "success",
            [
              {
                text: "Ver Factura",
                style: "default",
                onPress: () => {
                  // Navegar al Home donde verá el botón de descargar factura
                  navigation.navigate("Home");
                },
              },
            ],
          );
        }
      } catch (error) {
        console.error("❌ Error handling payment notification:", error);

        // Fallback: mostrar CustomAlert básico y navegar al Home
        showCustomAlert(
          "Pago confirmado",
          "Tu pago ha sido confirmado. ¡Gracias por tu visita!",
          "success",
          [
            {
              text: "OK",
              style: "default",
              onPress: () => navigation.navigate("Home"),
            },
          ],
        );
      }
    },
    [navigation, showCustomAlert],
  );

  return {
    handlePaymentConfirmedNotification,
  };
};

export default usePaymentNotificationHandler;
