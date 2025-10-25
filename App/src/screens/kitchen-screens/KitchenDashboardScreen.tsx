import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ToastAndroid,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import { ArrowLeft, Clock, Users, Utensils, CheckCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import api from "../../api/axios";

type Props = NativeStackScreenProps<RootStackParamList, "KitchenDashboard">;

interface KitchenOrderItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  status: "accepted" | "preparing" | "ready";
  created_at: string;
  menu_item: {
    id: string;
    name: string;
    description: string;
    prep_minutes: number;
    category: string;
  };
}

interface KitchenOrder {
  id: string;
  total_amount: number;
  estimated_time: number;
  notes?: string;
  created_at: string;
  table?: {
    id: string;
    number: string;
  };
  user?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  order_items: KitchenOrderItem[];
}

export default function KitchenDashboardScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingItems, setUpdatingItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"accepted" | "preparing" | "ready">("accepted");

  const loadKitchenOrders = useCallback(async () => {
    try {
      const response = await api.get("/orders/kitchen/pending");
      
      if (response.data.success) {
        setOrders(response.data.data || []);
      } else {
        ToastAndroid.show("Error cargando pedidos", ToastAndroid.SHORT);
      }
    } catch (error: any) {
      console.error("Error loading kitchen orders:", error);
      ToastAndroid.show(
        error.response?.data?.message || "Error de conexión",
        ToastAndroid.SHORT
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadKitchenOrders();
  }, [loadKitchenOrders]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadKitchenOrders();
  }, [loadKitchenOrders]);

  const updateItemStatus = async (itemId: string, newStatus: "preparing" | "ready") => {
    try {
      setUpdatingItems(prev => new Set([...prev, itemId]));

      const response = await api.put(`/orders/kitchen/item/${itemId}/status`, {
        status: newStatus
      });

      if (response.data.success) {
        ToastAndroid.show(
          `Item marcado como ${newStatus === "preparing" ? "preparando" : "listo"}`,
          ToastAndroid.SHORT
        );
        
        // Recargar datos
        await loadKitchenOrders();
      } else {
        ToastAndroid.show("Error actualizando item", ToastAndroid.SHORT);
      }
    } catch (error: any) {
      console.error("Error updating item status:", error);
      ToastAndroid.show(
        error.response?.data?.message || "Error actualizando item",
        ToastAndroid.SHORT
      );
    } finally {
      setUpdatingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }
  };

  const handleItemStatusChange = (item: KitchenOrderItem) => {
    const nextStatus = item.status === "accepted" ? "preparing" : "ready";
    const actionText = nextStatus === "preparing" ? "empezar a preparar" : "marcar como listo";
    
    Alert.alert(
      "Confirmar acción",
      `¿Quieres ${actionText} "${item.menu_item.name}"?`,
      [
        { text: "Cancelar", style: "cancel" },
        { 
          text: "Confirmar", 
          onPress: () => updateItemStatus(item.id, nextStatus)
        }
      ]
    );
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <Clock size={20} color="#f59e0b" />;
      case "preparing":
        return <Utensils size={20} color="#3b82f6" />;
      case "ready":
        return <CheckCircle size={20} color="#10b981" />;
      default:
        return <Clock size={20} color="#6b7280" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "accepted":
        return "Pendiente";
      case "preparing":
        return "Preparando";
      case "ready":
        return "Listo";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted":
        return "#f59e0b";
      case "preparing":
        return "#3b82f6";
      case "ready":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  // Renderizar item individual (nuevo)
  const renderIndividualItem = ({ item }: { item: any }) => (
    <View style={{
      backgroundColor: "#1a1a1a",
      marginHorizontal: 16,
      marginVertical: 8,
      borderRadius: 12,
      padding: 16,
      borderLeftWidth: 4,
      borderLeftColor: getStatusColor(item.status),
      elevation: 2,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }}>
      {/* Info de la mesa y cliente */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#d4af37" }}>
            Mesa #{item.table_number}
          </Text>
          <Text style={{ fontSize: 14, color: "#999" }}>
            {item.customer_name}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {getStatusIcon(item.status)}
            <Text style={{ marginLeft: 6, color: getStatusColor(item.status), fontWeight: "600" }}>
              {getStatusText(item.status)}
            </Text>
          </View>
        </View>
      </View>

      {/* Info del plato */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#ffffff", marginBottom: 4 }}>
            {item.menu_item.name}
          </Text>
          <Text style={{ fontSize: 14, color: "#999", marginBottom: 8 }}>
            {item.menu_item.description}
          </Text>
          <Text style={{ fontSize: 14, color: "#d4af37" }}>
            Cantidad: {item.quantity}
          </Text>
        </View>
        
        <View style={{ alignItems: "flex-end", marginLeft: 16 }}>
          <Clock size={16} color="#6b7280" />
          <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {item.menu_item.prep_minutes} min
          </Text>
        </View>
      </View>

      {/* Botones de acción */}
      <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
        {item.status === "accepted" && (
          <TouchableOpacity
            onPress={() => updateItemStatus(item.id, "preparing")}
            style={{
              backgroundColor: "#d4af37",
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center"
            }}
            disabled={updatingItems.has(item.id)}
          >
            {updatingItems.has(item.id) ? (
              <ActivityIndicator size="small" color="#000" />
            ) : (
              <>
                <Utensils size={16} color="#000" />
                <Text style={{ color: "#000", fontWeight: "600", marginLeft: 8 }}>
                  Empezar preparación
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
        
        {item.status === "preparing" && (
          <TouchableOpacity
            onPress={() => updateItemStatus(item.id, "ready")}
            style={{
              backgroundColor: "#10b981",
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center"
            }}
            disabled={updatingItems.has(item.id)}
          >
            {updatingItems.has(item.id) ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <CheckCircle size={16} color="#fff" />
                <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 8 }}>
                  Marcar como listo
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderOrderItem = ({ item: order }: { item: KitchenOrder }) => (
    <View style={styles.orderCard}>
      {/* Header de la orden */}
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.tableNumber}>Mesa #{order.table?.number || "?"}</Text>
          <Text style={styles.customerName}>
            {order.user ? `${order.user.first_name} ${order.user.last_name}` : "Cliente"}
          </Text>
        </View>
        <View style={styles.timeInfo}>
          <Text style={styles.orderDate}>{formatDate(order.created_at)}</Text>
          <Text style={styles.orderTime}>{formatTime(order.created_at)}</Text>
        </View>
      </View>

      {/* Items de la orden */}
      <View style={styles.itemsContainer}>
        {order.order_items.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.itemCard,
              { borderLeftColor: getStatusColor(item.status) }
            ]}
            onPress={() => handleItemStatusChange(item)}
            disabled={updatingItems.has(item.id)}
          >
            <View style={styles.itemHeader}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.menu_item.name}</Text>
                <Text style={styles.itemDescription} numberOfLines={2}>
                  {item.menu_item.description}
                </Text>
              </View>
              <View style={styles.itemMeta}>
                <Text style={styles.itemQuantity}>x{item.quantity}</Text>
                <Text style={styles.itemPrepTime}>
                  {item.menu_item.prep_minutes} min
                </Text>
              </View>
            </View>

            <View style={styles.itemFooter}>
              <View style={styles.statusContainer}>
                {getStatusIcon(item.status)}
                <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
                  {getStatusText(item.status)}
                </Text>
              </View>
              
              {updatingItems.has(item.id) ? (
                <ActivityIndicator size="small" color="#d4af37" />
              ) : (
                <Text style={styles.actionHint}>
                  {item.status === "accepted" ? "Tocar para empezar" : 
                   item.status === "preparing" ? "Tocar para finalizar" : "Completado"}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {order.notes && (
        <View style={styles.notesContainer}>
          <Text style={styles.notesTitle}>Notas del pedido:</Text>
          <Text style={styles.notesText}>{order.notes}</Text>
        </View>
      )}
    </View>
  );

  // Aplanar todos los items de todas las órdenes
  const allItems = orders.flatMap(order => 
    order.order_items.map(item => ({
      ...item,
      order_id: order.id,
      table_number: order.table?.number || "N/A",
      customer_name: order.user ? `${order.user.first_name} ${order.user.last_name}` : "Cliente"
    }))
  );

  // Filtrar items por tab activo
  const filteredItems = allItems.filter(item => item.status === activeTab);

  // Estadísticas por tab
  const stats = {
    accepted: allItems.filter(item => item.status === "accepted").length,
    preparing: allItems.filter(item => item.status === "preparing").length,
    ready: allItems.filter(item => item.status === "ready").length,
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#d4af37" />
          <Text style={styles.loadingText}>Cargando pedidos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={["#1a1a1a", "#2d2d2d"]}
        style={styles.header}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#d4af37" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Cocina</Text>
          <Text style={styles.headerSubtitle}>
            {filteredItems.length} {filteredItems.length === 1 ? "plato" : "platos"} {
              activeTab === "accepted" ? "pendiente" + (filteredItems.length === 1 ? "" : "s") :
              activeTab === "preparing" ? "preparando" + (filteredItems.length === 1 ? "se" : "") :
              "listo" + (filteredItems.length === 1 ? "" : "s")
            }
          </Text>
        </View>
        <View style={styles.headerStats}>
          <Users size={20} color="#d4af37" />
        </View>
      </LinearGradient>

      {/* Stats Card */}
      <View style={{
        margin: 16,
        backgroundColor: "#1a1a1a",
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: "#333",
      }}>
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#d4af37" }}>
              {stats.accepted}
            </Text>
            <Text style={{ fontSize: 14, color: "#999" }}>Pendientes</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#3b82f6" }}>
              {stats.preparing}
            </Text>
            <Text style={{ fontSize: 14, color: "#999" }}>Preparando</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#22c55e" }}>
              {stats.ready}
            </Text>
            <Text style={{ fontSize: 14, color: "#999" }}>Listos</Text>
          </View>
        </View>
      </View>

      {/* Tabs */}
      <View style={{
        flexDirection: "row",
        marginHorizontal: 16,
        marginBottom: 16,
        backgroundColor: "#1a1a1a",
        borderRadius: 12,
        padding: 4,
        borderWidth: 1,
        borderColor: "#333",
      }}>
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: activeTab === "accepted" ? "#d4af37" : "transparent",
          }}
          onPress={() => setActiveTab("accepted")}
        >
          <Text style={{
            textAlign: "center",
            fontWeight: "600",
            fontSize: 14,
            color: activeTab === "accepted" ? "#000" : "#999",
          }}>
            Pendientes ({stats.accepted})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: activeTab === "preparing" ? "#d4af37" : "transparent",
          }}
          onPress={() => setActiveTab("preparing")}
        >
          <Text style={{
            textAlign: "center",
            fontWeight: "600",
            fontSize: 14,
            color: activeTab === "preparing" ? "#000" : "#999",
          }}>
            Preparando ({stats.preparing})
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={{
            flex: 1,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 8,
            backgroundColor: activeTab === "ready" ? "#d4af37" : "transparent",
          }}
          onPress={() => setActiveTab("ready")}
        >
          <Text style={{
            textAlign: "center",
            fontWeight: "600",
            fontSize: 14,
            color: activeTab === "ready" ? "#000" : "#999",
          }}>
            Listos ({stats.ready})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de platos */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Utensils size={64} color="#6b7280" />
          <Text style={styles.emptyTitle}>
            {activeTab === "accepted" ? "No hay platos pendientes" :
             activeTab === "preparing" ? "No hay platos preparándose" :
             "No hay platos listos"}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === "accepted" ? "Los platos aparecerán aquí cuando los mozos los acepten" :
             activeTab === "preparing" ? "Los platos en preparación aparecerán aquí" :
             "Los platos terminados aparecerán aquí"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderIndividualItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={["#d4af37"]}
              tintColor="#d4af37"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = {
  container: {
    flex: 1,
    backgroundColor: "#0f0f0f",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#d4af37",
  },
  header: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold" as const,
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  headerStats: {
    marginLeft: 16,
  },
  listContainer: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "bold" as const,
    color: "#ffffff",
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: "#999",
    textAlign: "center" as const,
    lineHeight: 24,
  },
  orderCard: {
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  orderHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: 16,
  },
  orderInfo: {
    flex: 1,
  },
  tableNumber: {
    fontSize: 20,
    fontWeight: "bold" as const,
    color: "#d4af37",
  },
  customerName: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  timeInfo: {
    alignItems: "flex-end" as const,
  },
  orderDate: {
    fontSize: 12,
    color: "#999",
  },
  orderTime: {
    fontSize: 16,
    fontWeight: "bold" as const,
    color: "#ffffff",
    marginTop: 2,
  },
  itemsContainer: {
    gap: 12,
  },
  itemCard: {
    backgroundColor: "#2d2d2d",
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
  },
  itemHeader: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "flex-start" as const,
    marginBottom: 8,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "bold" as const,
    color: "#ffffff",
  },
  itemDescription: {
    fontSize: 14,
    color: "#999",
    marginTop: 2,
  },
  itemMeta: {
    alignItems: "flex-end" as const,
  },
  itemQuantity: {
    fontSize: 18,
    fontWeight: "bold" as const,
    color: "#d4af37",
  },
  itemPrepTime: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  itemFooter: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    alignItems: "center" as const,
  },
  statusContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600" as const,
  },
  actionHint: {
    fontSize: 12,
    color: "#999",
    fontStyle: "italic" as const,
  },
  notesContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: "#333",
    borderRadius: 6,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: "bold" as const,
    color: "#d4af37",
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: "#ffffff",
    lineHeight: 20,
  },
};