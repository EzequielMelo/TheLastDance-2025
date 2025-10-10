import React, { useEffect, useState, useContext, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  ToastAndroid,
  Modal,
  FlatList,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { AuthContext } from "../auth/AuthContext";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/axios";
import { Menu, User as UserIcon, Users, QrCode, UtensilsCrossed, Wine, BookOpen } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "../types/User";
import ClientFlowNavigation from "../components/navigation/ClientFlowNavigation";
import Sidebar from "../components/navigation/Sidebar";
import CartModal from "../components/cart/CartModal";
import ActionCard from "../components/common/ActionCard";
import { getDishesForKitchen, getDrinksForBar, MenuItem } from "../services/menuService";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation, route }: Props) {
  const { token, logout } = useContext(AuthContext);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuType, setMenuType] = useState<"platos" | "bebidas">("platos");
  // Estado para el status en la lista de espera
  const [waitingListStatus, setWaitingListStatus] = useState<string | null>(null);

  // Función para verificar el estado en la lista de espera
  const checkWaitingListStatus = useCallback(async () => {
    if (!token || !user) return;
    
    try {
      const response = await api.get("/tables/my-status");
      setWaitingListStatus(response.data.status);
    } catch (error) {
      // Si hay error, asumimos que no está en la lista
      setWaitingListStatus("not_in_queue");
    }
  }, [token, user]);

  // Cargar perfil desde backend (usa el Authorization del interceptor)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        if (!token) return;
        const { data } = await api.get("/auth/validate-token");
        const u: User = data?.user ?? data;
        if (mounted) setUser(u);
      } catch (err: any) {
        ToastAndroid.show("No se pudo cargar tu perfil", ToastAndroid.SHORT);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [token]);

  // Escuchar parámetros de navegación para refrescar cuando sea necesario
  useEffect(() => {
    if (route.params?.refresh && user && token) {
      setTimeout(() => {
        checkWaitingListStatus();
      }, 300);
    }
  }, [route.params?.refresh, user, token, checkWaitingListStatus]);

  const handleNavigate = (screenName: string, params?: any) => {
    navigation.navigate(screenName as any, params);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleOpenCart = () => {
    setCartModalVisible(true);
  };

  const loadDishesMenu = async () => {
    try {
      const dishes = await getDishesForKitchen();
      setMenuItems(dishes);
      setMenuType("platos");
      setShowMenu(true);
    } catch (error) {
      console.error("Error loading dishes:", error);
      ToastAndroid.show("Error al cargar el menú de platos", ToastAndroid.SHORT);
    }
  };

  const loadDrinksMenu = async () => {
    try {
      const drinks = await getDrinksForBar();
      setMenuItems(drinks);
      setMenuType("bebidas");
      setShowMenu(true);
    } catch (error) {
      console.error("Error loading drinks:", error);
      ToastAndroid.show("Error al cargar el menú de bebidas", ToastAndroid.SHORT);
    }
  };

  const isCliente =
    user?.profile_code === "cliente_registrado" ||
    user?.profile_code === "cliente_anonimo";

  const getProfileLabel = (profileCode: string, positionCode?: string) => {
    const profileLabels: { [key: string]: string } = {
      dueno: "Dueño",
      supervisor: "Supervisor",
      empleado: "Empleado",
      cliente_registrado: "Cliente Registrado",
      cliente_anonimo: "Cliente Anónimo",
    };

    const positionLabels: { [key: string]: string } = {
      cocinero: "Cocinero",
      bartender: "Bartender", 
      maitre: "Maître",
      mozo: "Mozo",
    };

    let label = profileLabels[profileCode] || profileCode;
    if (positionCode && positionLabels[positionCode]) {
      label += ` - ${positionLabels[positionCode]}`;
    }
    return label;
  };

  const getProfileColor = (profileCode: string) => {
    const colors: { [key: string]: string } = {
      dueno: "#430fa6", // aura
      supervisor: "#ea580c", // naranja
      empleado: "#2563eb", // azul
      cliente_registrado: "#16a34a", // verde
      cliente_anonimo: "#6b7280", // gris
    };
    return colors[profileCode] || "#6b7280";
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <View className="px-6 pt-14 pb-8 flex-1">
        {/* Header con menú hamburguesa */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <View>
            <Text style={{ color: "white", fontSize: 24, fontWeight: "600" }}>
              TheLastDance
            </Text>
            <Text style={{ color: "#9ca3af", fontSize: 14 }}>
              {user ? `¡Hola, ${user.first_name}!` : "Bienvenido"}
            </Text>
          </View>
          
          <TouchableOpacity
            onPress={() => setSidebarVisible(true)}
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.2)",
            }}
          >
            <Menu size={24} color="#d4af37" />
          </TouchableOpacity>
        </View>

        {/* Quick Stats Card */}
        {user && (
          <View style={{ marginBottom: 24 }}>
            <LinearGradient
              colors={["rgba(212, 175, 55, 0.2)", "rgba(212, 175, 55, 0.1)"]}
              style={{
                borderRadius: 16,
                padding: 20,
                borderWidth: 1,
                borderColor: "rgba(212, 175, 55, 0.3)",
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View>
                  <Text style={{ color: "#d4af37", fontSize: 16, fontWeight: "600" }}>
                    Estado actual
                  </Text>
                  <Text style={{ color: "white", fontSize: 14, marginTop: 4 }}>
                    {getProfileLabel(user.profile_code, user.position_code || undefined)}
                  </Text>
                </View>
                
                <View style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: getProfileColor(user.profile_code),
                  alignItems: "center",
                  justifyContent: "center",
                }}>
                  {user.photo_url ? (
                    <Image
                      source={{ uri: user.photo_url }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                  ) : (
                    <UserIcon size={24} color="white" />
                  )}
                </View>
              </View>
            </LinearGradient>
          </View>
        )}

        {/* Contenido principal basado en rol */}
        <View style={{ flex: 1 }}>
          {isCliente ? (
            <View>
              <ClientFlowNavigation />
              
              {/* Info sobre el sidebar para clientes */}
              <View style={{
                backgroundColor: "rgba(212, 175, 55, 0.1)",
                borderRadius: 12,
                padding: 16,
                marginTop: 16,
                borderWidth: 1,
                borderColor: "rgba(212, 175, 55, 0.3)",
              }}>
                <Text style={{ color: "#d4af37", fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
                  💡 Consejo
                </Text>
                <Text style={{ color: "white", fontSize: 12, lineHeight: 16 }}>
                  También puedes acceder a estas funciones desde el menú lateral (☰) según tu estado actual
                </Text>
              </View>
            </View>
          ) : user?.position_code === "cocinero" ? (
            <View>
              {/* Panel de acceso rápido para cocinero */}
              <ActionCard
                title="🍳 Panel de Cocina"
                description="Ver pedidos pendientes y actualizar el estado de preparación"
                icon={UtensilsCrossed}
                variant="primary"
                onPress={() => handleNavigate("KitchenDashboard")}
              />

              {/* Acceso a crear platos */}
              <ActionCard
                title="Agregar plato al menú"
                description="Crear nuevos platos para el restaurante"
                icon={QrCode}
                onPress={() => handleNavigate("CreateMenuItem", { initialCategory: "plato" })}
              />

              {/* Ver menú de platos */}
              <ActionCard
                title="Ver menú de platos"
                description="Consultar todos los platos del menú"
                icon={BookOpen}
                onPress={loadDishesMenu}
              />

              {/* Info adicional para cocineros */}
              <View style={{
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderRadius: 12,
                padding: 16,
                marginTop: 16,
                borderWidth: 1,
                borderColor: "rgba(59, 130, 246, 0.3)",
              }}>
                <Text style={{ color: "#3b82f6", fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
                  ℹ️ Información
                </Text>
                <Text style={{ color: "white", fontSize: 12, lineHeight: 16 }}>
                  Los pedidos aparecen aquí cuando los mozos los aprueban. Solo verás productos de categoría "plato"
                </Text>
              </View>
            </View>
          ) : user?.position_code === "bartender" ? (
            <View>
              {/* Panel de acceso rápido para bartender */}
              <ActionCard
                title="🍷 Panel de Bar"
                description="Ver bebidas pendientes y actualizar el estado de preparación"
                icon={Wine}
                variant="primary"
                onPress={() => handleNavigate("BartenderDashboard")}
              />

              {/* Acceso a crear bebidas */}
              <ActionCard
                variant="secondary"
                title="Agregar bebida al menú"
                description="Crear nuevas bebidas para el restaurante"
                icon={QrCode}
                onPress={() => handleNavigate("CreateMenuItem", { initialCategory: "bebida" })}
                style={{ marginBottom: 12 }}
              />

              {/* Ver menú de bebidas */}
              <ActionCard
                variant="secondary"
                title="Ver menú de bebidas"
                description="Consultar todas las bebidas del menú"
                icon={BookOpen}
                onPress={loadDrinksMenu}
              />

              {/* Info adicional para bartenders */}
              <View style={{
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                borderRadius: 12,
                padding: 16,
                marginTop: 16,
                borderWidth: 1,
                borderColor: "rgba(59, 130, 246, 0.3)",
              }}>
                <Text style={{ color: "#3b82f6", fontSize: 14, fontWeight: "600", marginBottom: 4 }}>
                  ℹ️ Información
                </Text>
                <Text style={{ color: "white", fontSize: 12, lineHeight: 16 }}>
                  Los pedidos aparecen aquí cuando los mozos los aprueban. Solo verás productos de categoría "bebida"
                </Text>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}
        </View>
      </View>

      {/* Sidebar */}
      <Sidebar
        visible={sidebarVisible}
        onClose={() => setSidebarVisible(false)}
        user={user}
        onLogout={handleLogout}
        onNavigate={handleNavigate}
        onOpenCart={handleOpenCart}
      />

      {/* Cart Modal */}
      <CartModal
        visible={cartModalVisible}
        onClose={() => setCartModalVisible(false)}
      />

      {/* Modal del Menú */}
      <Modal
        visible={showMenu}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowMenu(false)}
      >
        <View style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.8)",
          justifyContent: "center",
          alignItems: "center",
        }}>
          <View style={{
            width: "90%",
            maxHeight: "80%",
            backgroundColor: "#1a1a1a",
            borderRadius: 16,
            borderWidth: 1,
            borderColor: "#333",
          }}>
            {/* Header del Modal */}
            <View style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 20,
              borderBottomWidth: 1,
              borderBottomColor: "#333",
            }}>
              <Text style={{
                fontSize: 20,
                fontWeight: "bold",
                color: "#ffffff",
              }}>
                Menú de {menuType === "platos" ? "Platos" : "Bebidas"}
              </Text>
              <TouchableOpacity
                onPress={() => setShowMenu(false)}
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: "#333",
                }}
              >
                <Text style={{ color: "#ffffff", fontSize: 16 }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Lista del Menú */}
            <FlatList
              data={menuItems}
              keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <View style={{
                  padding: 16,
                  borderBottomWidth: 1,
                  borderBottomColor: "#333",
                }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#ffffff",
                    marginBottom: 4,
                  }}>
                    {item.name}
                  </Text>
                  <Text style={{
                    fontSize: 14,
                    color: "#999",
                    marginBottom: 8,
                  }}>
                    {item.description}
                  </Text>
                  <View style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}>
                    <Text style={{
                      fontSize: 16,
                      fontWeight: "bold",
                      color: "#d4af37",
                    }}>
                      ${item.price}
                    </Text>
                    <Text style={{
                      fontSize: 12,
                      color: "#666",
                      backgroundColor: "#333",
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 4,
                    }}>
                      {item.category}
                    </Text>
                  </View>
                </View>
              )}
              style={{ maxHeight: 400 }}
              showsVerticalScrollIndicator={false}
              ListEmptyComponent={() => (
                <View style={{ 
                  padding: 40, 
                  alignItems: "center" 
                }}>
                  <Text style={{ 
                    color: "#999", 
                    fontSize: 16,
                    textAlign: "center" 
                  }}>
                    No hay {menuType} disponibles en el menú
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}
