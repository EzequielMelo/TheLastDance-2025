import { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';
import type { RootStackNavigationProp } from '../navigation/RootStackParamList';

export const usePaymentNotificationHandler = () => {
  const navigation = useNavigation<RootStackNavigationProp>();

  const handlePaymentConfirmedNotification = useCallback((notificationData: {
    type: string;
    tableNumber?: string;
    waiterName?: string;
    totalAmount?: number;
    screen?: string;
    invoiceData?: {
      generated: boolean;
      filePath?: string;
      fileName?: string;
      message?: string;
      error?: string;
    };
  }) => {
    try {
      console.log("📱 Handling payment confirmed notification:", notificationData);

      if (notificationData.type === "payment_confirmed") {
        // Si hay información de factura, navegar a la pantalla de factura
        if (notificationData.invoiceData?.generated) {
          console.log("📄 Navigating to invoice view with data:", notificationData.invoiceData);
          
          navigation.navigate("InvoiceView", {
            invoiceData: notificationData.invoiceData,
            paymentAmount: notificationData.totalAmount || 0,
          });
        } else {
          // Si no hay factura o hubo error, mostrar una pantalla de confirmación simple
          console.log("⚠️ Payment confirmed but no invoice generated");
          
          const waiterName = notificationData.waiterName || 'El mozo';
          const amount = notificationData.totalAmount || 0;
          
          // Mostrar alert con confirmación de pago
          Alert.alert(
            "✅ Pago confirmado", 
            `${waiterName} confirmó tu pago de $${amount.toLocaleString()}.\n\n${notificationData.invoiceData?.error || 'Gracias por tu visita!'}`,
            [{ text: "OK", style: "default" }]
          );
        }
      }
    } catch (error) {
      console.error("❌ Error handling payment notification:", error);
      
      // Fallback: mostrar alert básico
      Alert.alert(
        "Pago confirmado", 
        "Tu pago ha sido confirmado. Gracias por tu visita!",
        [{ text: "OK", style: "default" }]
      );
    }
  }, [navigation]);

  return {
    handlePaymentConfirmedNotification,
  };
};

export default usePaymentNotificationHandler;