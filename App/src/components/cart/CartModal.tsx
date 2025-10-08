import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {ChefHat,
  Coffee,
  Clock,
  ShoppingCart,
  Plus,
  Minus,
  CheckCircle,
  X,
  Trash2,
} from "lucide-react-native";
import { useCart } from "../../context/CartContext";
import api from "../../api/axios";

interface CartModalProps {
  visible: boolean;
  onClose: () => void;
  tableId?: string;
}

export default function CartModal({ visible, onClose, tableId }: CartModalProps) {
  const { 
    pendingItems, 
    confirmedItems, 
    pendingCount, 
    confirmedCount,
    totalCount,
    pendingAmount, 
    confirmedAmount,
    totalAmount,
    pendingTime,
    totalTime,
    updateQuantity, 
    removeItem, 
    confirmOrder
  } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
    }).format(price);
  };

  const getCategoryIcon = (category: "plato" | "bebida") => {
    return category === "plato" ? ChefHat : Coffee;
  };

  const getCategoryColor = (category: "plato" | "bebida") => {
    return category === "plato" ? "#ef4444" : "#3b82f6";
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    updateQuantity(itemId, newQuantity);
  };

  const handleConfirmOrder = async () => {
    if (pendingItems.length === 0) {
      Alert.alert('Error', 'No hay items pendientes para confirmar');
      return;
    }

    if (!tableId) {
      Alert.alert('Error', 'No se pudo identificar la mesa. Por favor, inténtalo de nuevo.');
      return;
    }

    try {
      const orderData = pendingItems.map(item => ({
        id: item.id,
        name: item.name,
        category: item.category,
        price: item.price,
        prepMinutes: item.prepMinutes,
        quantity: item.quantity,
        image_url: item.image_url,
      }));
      
      const response = await api.post('/orders', {
        table_id: tableId,
        items: orderData,
        totalAmount: pendingAmount,
        estimatedTime: pendingTime
      });

      if (response.status === 201) {
        // Confirmar el pedido (mover a confirmados)
        confirmOrder();
        
        Alert.alert(
          "Pedido Confirmado",
          `Tu pedido por ${formatPrice(pendingAmount)} ha sido enviado a la cocina.`,
          [{ text: "OK", onPress: onClose }]
        );
      }
    } catch (error) {
      console.error("Error al confirmar pedido:", error);
      Alert.alert("Error", "No se pudo confirmar el pedido. Intenta de nuevo.");
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <LinearGradient colors={["#1a1a1a", "#2d1810", "#1a1a1a"]} style={{ flex: 1 }}>
        {/* Header */}
        <View style={{
          paddingTop: 48,
          paddingHorizontal: 24,
          paddingBottom: 16,
          borderBottomWidth: 1,
          borderBottomColor: "rgba(255,255,255,0.1)",
        }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
              <ShoppingCart size={24} color="#d4af37" />
              <Text style={{
                color: "white",
                fontSize: 24,
                fontWeight: "600",
                marginLeft: 8,
              }}>
                Mi Pedido
              </Text>
            </View>
            
            <TouchableOpacity
              onPress={onClose}
              style={{
                backgroundColor: "rgba(255,255,255,0.1)",
                borderRadius: 12,
                padding: 8,
              }}
            >
              <X size={24} color="white" />
            </TouchableOpacity>
          </View>
          
          <Text style={{ 
            color: "#d1d5db", 
            fontSize: 14, 
            marginTop: 4 
          }}>
            {totalCount > 0 && `${totalCount} ${totalCount === 1 ? 'producto' : 'productos'} • Tiempo estimado: ${totalTime} min`}
          </Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24 }}>
          {/* Items Confirmados */}
          {confirmedItems.length > 0 && (
            <View style={{ marginBottom: 24 }}>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 8,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(34, 197, 94, 0.3)",
              }}>
                <CheckCircle size={20} color="#22c55e" />
                <Text style={{
                  color: "#22c55e",
                  fontSize: 18,
                  fontWeight: "600",
                  marginLeft: 8,
                }}>
                  Confirmados ({confirmedCount} items)
                </Text>
                <Text style={{
                  color: "#9ca3af",
                  fontSize: 14,
                  marginLeft: 8,
                }}>
                  - En preparación
                </Text>
              </View>

              {confirmedItems.map((item, index) => {
                const CategoryIcon = getCategoryIcon(item.category as "plato" | "bebida");
                const categoryColor = getCategoryColor(item.category as "plato" | "bebida");
                
                return (
                  <View
                    key={`confirmed-${item.id}-${index}`}
                    style={{
                      flexDirection: "row",
                      backgroundColor: "rgba(34, 197, 94, 0.1)",
                      borderRadius: 12,
                      marginBottom: 12,
                      padding: 12,
                      borderWidth: 1,
                      borderColor: "rgba(34, 197, 94, 0.2)",
                    }}
                  >
                    {item.image_url && (
                      <Image
                        source={{ uri: item.image_url }}
                        style={{
                          width: 60,
                          height: 60,
                          borderRadius: 8,
                          marginRight: 12,
                        }}
                      />
                    )}
                    
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                        <View style={{
                          backgroundColor: categoryColor,
                          borderRadius: 6,
                          padding: 4,
                          marginRight: 8,
                        }}>
                          <CategoryIcon size={12} color="white" />
                        </View>
                        <Text style={{
                          color: "#9ca3af",
                          fontSize: 12,
                          textTransform: "uppercase",
                        }}>
                          {item.category === "plato" ? "Plato" : "Bebida"}
                        </Text>
                      </View>
                      
                      <Text style={{ color: "white", fontSize: 16, fontWeight: "600" }}>
                        {item.name}
                      </Text>
                      <Text style={{ color: "#9ca3af", fontSize: 14, marginTop: 2 }}>
                        {formatPrice(item.price)} x {item.quantity}
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <Clock size={12} color="#22c55e" />
                        <Text style={{ color: "#22c55e", fontSize: 12, marginLeft: 4 }}>
                          {item.prepMinutes} min
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={{
                      color: "#22c55e",
                      fontSize: 16,
                      fontWeight: "600",
                      alignSelf: "center",
                    }}>
                      {formatPrice(item.price * item.quantity)}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Items Pendientes */}
          {pendingItems.length > 0 && (
            <View>
              <View style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 8,
                borderBottomWidth: 1,
                borderBottomColor: "rgba(212, 175, 55, 0.3)",
              }}>
                <Clock size={20} color="#d4af37" />
                <Text style={{
                  color: "#d4af37",
                  fontSize: 18,
                  fontWeight: "600",
                  marginLeft: 8,
                }}>
                  Pendientes ({pendingCount} items)
                </Text>
                <Text style={{
                  color: "#9ca3af",
                  fontSize: 14,
                  marginLeft: 8,
                }}>
                  - Por confirmar
                </Text>
              </View>

              {pendingItems.map((item) => {
                const CategoryIcon = getCategoryIcon(item.category as "plato" | "bebida");
                const categoryColor = getCategoryColor(item.category as "plato" | "bebida");
                
                return (
                  <View
                    key={item.id}
                    style={{
                      backgroundColor: "rgba(255,255,255,0.05)",
                      borderRadius: 16,
                      padding: 16,
                      marginBottom: 16,
                      borderWidth: 1,
                      borderColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      {/* Image */}
                      {item.image_url && (
                        <Image
                          source={{ uri: item.image_url }}
                          style={{
                            width: 60,
                            height: 60,
                            borderRadius: 8,
                            marginRight: 12,
                          }}
                        />
                      )}
                      
                      {/* Content */}
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
                          <View style={{
                            backgroundColor: categoryColor,
                            borderRadius: 6,
                            padding: 4,
                            marginRight: 8,
                          }}>
                            <CategoryIcon size={12} color="white" />
                          </View>
                          <Text style={{
                            color: "#9ca3af",
                            fontSize: 12,
                            textTransform: "uppercase",
                          }}>
                            {item.category === "plato" ? "Plato" : "Bebida"}
                          </Text>
                        </View>
                        
                        <Text style={{
                          color: "white",
                          fontSize: 16,
                          fontWeight: "600",
                          marginBottom: 4,
                        }}>
                          {item.name}
                        </Text>
                        
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                          <Text style={{
                            color: "#d4af37",
                            fontSize: 16,
                            fontWeight: "600",
                          }}>
                            {formatPrice(item.price)}
                          </Text>
                          
                          <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <Clock size={12} color="#d1d5db" />
                            <Text style={{
                              color: "#d1d5db",
                              fontSize: 12,
                              marginLeft: 4,
                            }}>
                              {item.prepMinutes} min
                            </Text>
                          </View>
                        </View>
                      </View>
                      
                      {/* Controls */}
                      <View style={{ alignItems: "flex-end" }}>
                        <TouchableOpacity
                          onPress={() => removeItem(item.id)}
                          style={{
                            backgroundColor: "rgba(239, 68, 68, 0.2)",
                            borderRadius: 8,
                            padding: 6,
                            marginBottom: 8,
                          }}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                        
                        <View style={{
                          flexDirection: "row",
                          alignItems: "center",
                          backgroundColor: "#d4af37",
                          borderRadius: 8,
                          paddingHorizontal: 4,
                        }}>
                          <TouchableOpacity
                            onPress={() => handleQuantityChange(item.id, item.quantity - 1)}
                            style={{ padding: 6 }}
                          >
                            <Minus size={14} color="#1a1a1a" />
                          </TouchableOpacity>
                          
                          <Text style={{
                            color: "#1a1a1a",
                            fontWeight: "600",
                            fontSize: 16,
                            marginHorizontal: 8,
                          }}>
                            {item.quantity}
                          </Text>
                          
                          <TouchableOpacity
                            onPress={() => handleQuantityChange(item.id, item.quantity + 1)}
                            style={{ padding: 6 }}
                          >
                            <Plus size={14} color="#1a1a1a" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Estado vacío */}
          {pendingItems.length === 0 && confirmedItems.length === 0 && (
            <View style={{
              alignItems: "center",
              justifyContent: "center",
              paddingVertical: 48,
            }}>
              <ShoppingCart size={64} color="#6b7280" />
              <Text style={{
                color: "#9ca3af",
                fontSize: 18,
                marginTop: 16,
                textAlign: "center",
              }}>
                Tu carrito está vacío
              </Text>
              <Text style={{
                color: "#6b7280",
                fontSize: 14,
                marginTop: 4,
                textAlign: "center",
              }}>
                Agrega algunos productos del menú
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {(pendingItems.length > 0 || confirmedItems.length > 0) && (
          <View style={{
            padding: 24,
            borderTopWidth: 1,
            borderTopColor: "rgba(255,255,255,0.1)",
          }}>
            <View style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
            }}>
              {confirmedItems.length > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: "#22c55e", fontSize: 16 }}>
                    Confirmado ({confirmedCount} items)
                  </Text>
                  <Text style={{ color: "#22c55e", fontSize: 16, fontWeight: "600" }}>
                    {formatPrice(confirmedAmount)}
                  </Text>
                </View>
              )}
              
              {pendingItems.length > 0 && (
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
                  <Text style={{ color: "#d4af37", fontSize: 16 }}>
                    Pendiente ({pendingCount} items)
                  </Text>
                  <Text style={{ color: "#d4af37", fontSize: 16, fontWeight: "600" }}>
                    {formatPrice(pendingAmount)}
                  </Text>
                </View>
              )}
              
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: "#d1d5db", fontSize: 16 }}>
                  Tiempo estimado total
                </Text>
                <Text style={{ color: "#d1d5db", fontSize: 16, fontWeight: "600" }}>
                  {totalTime} minutos
                </Text>
              </View>
            </View>

            {pendingItems.length > 0 && (
              <TouchableOpacity
                onPress={handleConfirmOrder}
                style={{
                  backgroundColor: "#d4af37",
                  borderRadius: 12,
                  padding: 16,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <CheckCircle size={20} color="#1a1a1a" />
                <Text style={{
                  color: "#1a1a1a",
                  fontSize: 18,
                  fontWeight: "600",
                  marginLeft: 8,
                }}>
                  Confirmar Pedido • {formatPrice(pendingAmount)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </LinearGradient>
    </Modal>
  );
}