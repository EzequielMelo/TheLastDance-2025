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
import { ArrowLeft, Clock, Users, Wine, CheckCircle } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import api from "../../api/axios";

type Props = NativeStackScreenProps<RootStackParamList, "BartenderDashboard">;

interface BartenderOrderItem {
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

interface BartenderOrder {
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
  order_items: BartenderOrderItem[];
}

export default function BartenderDashboardScreen({ navigation }: Props) {
  const [orders, setOrders] = useState<BartenderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"accepted" | "preparing" | "ready">("accepted");

  const fetchBartenderOrders = useCallback(async () => {
    try {
      console.log("📋 Cargando órdenes de bar...");
      const response = await api.get("/orders/bar/pending");
      console.log("📊 Respuesta del servidor:", response.data);
      
      const ordersData = response.data?.data || [];
      setOrders(ordersData);
      console.log(`✅ Se cargaron ${ordersData.length} órdenes para bar`);
    } catch (error: any) {
      console.error("❌ Error cargando órdenes de bar:", error);
      Alert.alert("Error", "No se pudieron cargar las órdenes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBartenderOrders();
  }, [fetchBartenderOrders]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBartenderOrders();
    setRefreshing(false);
  }, [fetchBartenderOrders]);

  const updateItemStatus = async (itemId: string, newStatus: "preparing" | "ready") => {
    try {
      await api.put(`/orders/bar/item/${itemId}/status`, { status: newStatus });
      ToastAndroid.show("Estado actualizado", ToastAndroid.SHORT);
      await fetchBartenderOrders();
    } catch (error) {
      console.error("Error actualizando estado:", error);
      Alert.alert("Error", "No se pudo actualizar el estado");
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "accepted": return "Pendiente";
      case "preparing": return "Preparando";
      case "ready": return "Lista";
      default: return "Desconocido";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "accepted": return "#d4af37"; // Dorado para pendiente
      case "preparing": return "#8B4513"; // Marrón dorado para preparando
      case "ready": return "#228B22"; // Verde para listo
      default: return "#6B7280";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <Clock size={20} color="#d4af37" />;
      case "preparing":
        return <Wine size={20} color="#8B4513" />;
      case "ready":
        return <CheckCircle size={20} color="#228B22" />;
      default:
        return <Clock size={20} color="#6b7280" />;
    }
  };

  const renderOrderItem = ({ item: orderItem }: { item: any }) => (
    <View
      style={{
        backgroundColor: "#1a1a1a",
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        borderLeftColor: getStatusColor(orderItem.status),
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }}
    >
      {/* Info de la mesa y cliente */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <View>
          <Text style={{ fontSize: 16, fontWeight: "600", color: "#d4af37" }}>
            Mesa #{orderItem.table_number}
          </Text>
          <Text style={{ fontSize: 14, color: "#999" }}>
            {orderItem.customer_name}
          </Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {getStatusIcon(orderItem.status)}
            <Text style={{ marginLeft: 6, color: getStatusColor(orderItem.status), fontWeight: "600" }}>
              {getStatusText(orderItem.status)}
            </Text>
          </View>
        </View>
      </View>

      {/* Info de la bebida */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#ffffff", marginBottom: 4 }}>
            {orderItem.menu_item.name}
          </Text>
          <Text style={{ fontSize: 14, color: "#999", marginBottom: 8 }}>
            {orderItem.menu_item.description || "Bebida"}
          </Text>
          <Text style={{ fontSize: 14, color: "#d4af37" }}>
            Cantidad: {orderItem.quantity}
          </Text>
        </View>
        
        <View style={{ alignItems: "flex-end", marginLeft: 16 }}>
          <Clock size={16} color="#6b7280" />
          <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
            {orderItem.menu_item.prep_minutes} min
          </Text>
        </View>
      </View>

      {/* Botones de acción */}
      <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
        {orderItem.status === "accepted" && (
          <TouchableOpacity
            onPress={() => updateItemStatus(orderItem.id, "preparing")}
            style={{
              backgroundColor: "#d4af37",
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center"
            }}
          >
            <Wine size={16} color="#000" />
            <Text style={{ color: "#000", fontWeight: "600", marginLeft: 8 }}>
              Empezar preparación
            </Text>
          </TouchableOpacity>
        )}
        
        {orderItem.status === "preparing" && (
          <TouchableOpacity
            onPress={() => updateItemStatus(orderItem.id, "ready")}
            style={{
              backgroundColor: "#228B22",
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center"
            }}
          >
            <CheckCircle size={16} color="#fff" />
            <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 8 }}>
              Marcar como lista
            </Text>
          </TouchableOpacity>
        )}
      </View>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f0f" }}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color="#d4af37" />
          <Text style={{ marginTop: 16, color: "#d4af37" }}>Cargando órdenes de bar...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f0f0f" }}>
      {/* Header */}
      <LinearGradient
        colors={["#1a1a1a", "#2d2d2d"]}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: "#333",
        }}
      >
        <TouchableOpacity
          style={{ marginRight: 16 }}
          onPress={() => navigation.goBack()}
        >
          <ArrowLeft size={24} color="#d4af37" />
        </TouchableOpacity>
        
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: "#ffffff" }}>
            Bar
          </Text>
          <Text style={{ fontSize: 14, color: "#999", marginTop: 2 }}>
            {filteredItems.length} {filteredItems.length === 1 ? "bebida" : "bebidas"} {
              activeTab === "accepted" ? "pendiente" + (filteredItems.length === 1 ? "" : "s") :
              activeTab === "preparing" ? "preparando" + (filteredItems.length === 1 ? "se" : "") :
              "lista" + (filteredItems.length === 1 ? "" : "s")
            }
          </Text>
        </View>
        
        <View style={{ marginLeft: 16 }}>
          <Wine size={20} color="#d4af37" />
        </View>
      </LinearGradient>

      {/* Stats Card */}
      <View
        style={{
          margin: 16,
          backgroundColor: "#1a1a1a",
          borderRadius: 12,
          padding: 16,
          borderWidth: 1,
          borderColor: "#333",
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-around" }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#d4af37" }}>
              {stats.accepted}
            </Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Pendientes</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#8B4513" }}>
              {stats.preparing}
            </Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Preparando</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#228B22" }}>
              {stats.ready}
            </Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Listas</Text>
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
            Listas ({stats.ready})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lista de items */}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
            <Wine size={64} color="#6b7280" />
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#ffffff", marginTop: 16, marginBottom: 8 }}>
              {activeTab === "accepted" ? "No hay bebidas pendientes" :
               activeTab === "preparing" ? "No hay bebidas preparándose" :
               "No hay bebidas listas"}
            </Text>
            <Text style={{ fontSize: 16, color: "#999", textAlign: "center", lineHeight: 24 }}>
              {activeTab === "accepted" ? "Las bebidas aparecerán aquí cuando los mozos las acepten" :
               activeTab === "preparing" ? "Las bebidas en preparación aparecerán aquí" :
               "Las bebidas terminadas aparecerán aquí"}
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}