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

  const renderOrderItem = ({ item: orderItem }: { item: BartenderOrderItem }) => (
    <View
      style={{
        backgroundColor: "white",
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 12,
        padding: 16,
        elevation: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "600", color: "#1F2937", marginBottom: 4 }}>
            {orderItem.menu_item.name}
          </Text>
          <Text style={{ fontSize: 14, color: "#6B7280", marginBottom: 8 }}>
            Cantidad: {orderItem.quantity}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View
              style={{
                backgroundColor: getStatusColor(orderItem.status),
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "white", fontSize: 12, fontWeight: "500" }}>
                {getStatusText(orderItem.status)}
              </Text>
            </View>
          </View>
        </View>
        
        <View style={{ alignItems: "flex-end" }}>
          <Clock size={16} color="#6B7280" />
          <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
            {orderItem.menu_item.prep_minutes} min
          </Text>
        </View>
      </View>

      {/* Botones de acción */}
      <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
        {orderItem.status === "accepted" && (
          <TouchableOpacity
            onPress={() => updateItemStatus(orderItem.id, "preparing")}
            style={{
              backgroundColor: "#d4af37",
              flex: 1,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Empezar preparación</Text>
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
            }}
          >
            <Text style={{ color: "white", fontWeight: "600" }}>Marcar como lista</Text>
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
            {allItems.length} {allItems.length === 1 ? "bebida pendiente" : "bebidas pendientes"}
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
              {allItems.filter(item => item.status === "accepted").length}
            </Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Pendientes</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#8B4513" }}>
              {allItems.filter(item => item.status === "preparing").length}
            </Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Preparando</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#228B22" }}>
              {allItems.filter(item => item.status === "ready").length}
            </Text>
            <Text style={{ fontSize: 12, color: "#999" }}>Listas</Text>
          </View>
        </View>
      </View>

      {/* Lista de items */}
      <FlatList
        data={allItems}
        keyExtractor={(item) => item.id}
        renderItem={renderOrderItem}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={() => (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 }}>
            <Wine size={64} color="#6b7280" />
            <Text style={{ fontSize: 20, fontWeight: "bold", color: "#ffffff", marginTop: 16, marginBottom: 8 }}>
              No hay bebidas pendientes
            </Text>
            <Text style={{ fontSize: 16, color: "#999", textAlign: "center", lineHeight: 24 }}>
              Las bebidas aparecerán aquí cuando los mozos las acepten
            </Text>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </SafeAreaView>
  );
}