/**
 * DeliveryPaymentModal - Modal simplificado para repartidores
 * Solo permite seleccionar método de pago (QR o Efectivo)
 * El cliente decidirá la propina en la siguiente pantalla
 */

import React from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from "react-native";
import { X, QrCode, Banknote } from "lucide-react-native";
import type { DeliveryWithOrder } from "../../types/Delivery";

interface DeliveryPaymentModalProps {
  visible: boolean;
  delivery: DeliveryWithOrder;
  onClose: () => void;
  onSelectPaymentMethod: (
    method: "qr" | "cash",
    tipAmount: number,
    tipPercentage: number,
    satisfactionLevel: string,
  ) => void;
}

const DeliveryPaymentModal: React.FC<DeliveryPaymentModalProps> = ({
  visible,
  delivery,
  onClose,
  onSelectPaymentMethod,
}) => {
  const totalAmount = delivery.delivery_order?.total_amount || 0;

  const handlePaymentMethod = (method: "qr" | "cash") => {
    console.log("💳 Método de pago seleccionado:", method);
    // Repartidor solo elige método, cliente decide propina después
    onSelectPaymentMethod(method, 0, 0, "");
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Método de Pago</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#d4af37" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent}>
            {/* Total del Pedido */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Total del Pedido</Text>
              <View style={styles.totalCard}>
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    ${totalAmount.toFixed(2)}
                  </Text>
                </View>
              </View>
              <Text style={styles.infoText}>
                El cliente decidirá la propina al momento de pagar
              </Text>
            </View>

            {/* Instrucciones */}
            <View style={styles.section}>
              <View style={styles.instructionsCard}>
                <Text style={styles.instructionsTitle}>
                  Selecciona cómo cobrará el cliente
                </Text>
                <Text style={styles.instructionsText}>
                  El cliente elegirá la propina según su nivel de satisfacción
                </Text>
              </View>
            </View>

            {/* Botones de Método de Pago */}
            <View style={styles.paymentMethodsSection}>
              <Text style={styles.paymentMethodsTitle}>
                Selecciona el método de pago
              </Text>

              {/* Botón Pagar con QR */}
              <TouchableOpacity
                style={styles.paymentMethodButton}
                onPress={() => handlePaymentMethod("qr")}
              >
                <View style={styles.paymentMethodIcon}>
                  <QrCode size={32} color="#d4af37" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodName}>Pagar con QR</Text>
                  <Text style={styles.paymentMethodDescription}>
                    El cliente escanea el código QR
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Botón Pagar en Efectivo */}
              <TouchableOpacity
                style={styles.paymentMethodButton}
                onPress={() => handlePaymentMethod("cash")}
              >
                <View style={styles.paymentMethodIcon}>
                  <Banknote size={32} color="#10b981" />
                </View>
                <View style={styles.paymentMethodInfo}>
                  <Text style={styles.paymentMethodName}>
                    Pagar en Efectivo
                  </Text>
                  <Text style={styles.paymentMethodDescription}>
                    Confirmarás la recepción del dinero
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#1a1a1a",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "90%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#d4af37",
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginLeft: 8,
  },
  totalCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  totalLabel: {
    fontSize: 16,
    color: "#9ca3af",
  },
  totalValue: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#d4af37",
  },
  infoText: {
    fontSize: 12,
    color: "#9ca3af",
    marginTop: 8,
    textAlign: "center",
    fontStyle: "italic",
  },
  instructionsCard: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: "#d4af37",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 8,
  },
  instructionsText: {
    fontSize: 14,
    color: "#d1d5db",
    lineHeight: 20,
  },
  paymentMethodsSection: {
    marginBottom: 20,
  },
  paymentMethodsTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 16,
  },
  paymentMethodButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "transparent",
  },
  paymentMethodIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  paymentMethodInfo: {
    flex: 1,
  },
  paymentMethodName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 4,
  },
  paymentMethodDescription: {
    fontSize: 14,
    color: "#9ca3af",
  },
});

export default DeliveryPaymentModal;
