import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  ToastAndroid,
} from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../navigation/RootStackParamList";
import { AuthContext } from "../auth/AuthContext";
import api from "../api/axios";
import { Menu, User as UserIcon, Users, QrCode } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "../types/User";
import ClientFlowNavigation from "../components/navigation/ClientFlowNavigation";
import Sidebar from "../components/navigation/Sidebar";
import CartModal from "../components/cart/CartModal";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { token, logout } = useContext(AuthContext);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const [cartModalVisible, setCartModalVisible] = useState(false);

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

  const handleNavigate = (screenName: string, params?: any) => {
    navigation.navigate(screenName as any, params);
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleOpenCart = () => {
    setCartModalVisible(true);
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
    </LinearGradient>
  );
}
