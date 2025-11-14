import React, { ReactNode, useState } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../../auth/useAuth";
import { useBottomNav } from "../../context/BottomNavContext";
import { useClientState } from "../../Hooks/useClientState";
import BottomNavbar from "../navigation/BottomNavbar";
import Sidebar from "../navigation/Sidebar";
import {
  RootStackNavigationProp,
  RootStackParamList,
} from "../../navigation/RootStackParamList";

interface ClientLayoutProps {
  children: ReactNode;
  showNavbar?: boolean;
  onOpenCart?: () => void;
  onOpenSidebar?: () => void;
}

export default function ClientLayout({
  children,
  showNavbar = true,
  onOpenCart,
  onOpenSidebar,
}: ClientLayoutProps) {
  const navigation = useNavigation<RootStackNavigationProp>();
  const { user, logout } = useAuth();
  const { activeTab, setActiveTab } = useBottomNav();
  const { state } = useClientState();
  const [sidebarVisible, setSidebarVisible] = useState(false);

  const isCliente =
    user?.profile_code === "cliente_registrado" ||
    user?.profile_code === "cliente_anonimo";

  const handleNavigateHome = () => {
    setActiveTab("home");
    navigation.navigate("Home");
  };

  const handleNavigateMenu = () => {
    setActiveTab("menu");
    navigation.navigate("Menu");
  };

  const handleScanQR = () => {
    // Si el cliente no está en la lista de espera o tiene mesa asignada:
    // Usar ScanTableQR que maneja tanto:
    // - Unirse a lista de espera (si escanea QR del maitre)
    // - Activar reserva (si escanea QR de mesa y tiene reserva)
    // - Confirmar llegada (si escanea QR de mesa asignada)
    if (state === "not_in_queue" || state === "assigned") {
      navigation.navigate("ScanTableQR");
    }
    // Para otros estados (seated, in_queue, etc.), usar el escáner general
    else {
      navigation.navigate("QRScanner", {
        mode: "order_status",
        onScanSuccess: async (tableId: string) => {
          // La lógica de verificación y navegación se maneja en HomeScreen
          // Este callback solo se usa como referencia del modo de escaneo
        },
      });
    }
  };

  const handleOpenCart = () => {
    setActiveTab("cart");
    setSidebarVisible(false);
    if (onOpenCart) {
      onOpenCart();
    }
  };

  const handleOpenSidebar = () => {
    setSidebarVisible(true);
    if (onOpenSidebar) {
      onOpenSidebar();
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigation.navigate("Login");
    } catch (error) {}
  };

  const handleNavigate = (screen: string, params?: any) => {
    setSidebarVisible(false);
    navigation.navigate(screen as any, params);
  };

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      style={{ flex: 1 }}
    >
      <View
        style={{
          flex: 1,
          paddingBottom: showNavbar && isCliente ? 100 : 0,
        }}
      >
        {children}
      </View>

      {/* BottomNavbar solo para clientes */}
      {showNavbar && isCliente && (
        <BottomNavbar
          onNavigateHome={handleNavigateHome}
          onNavigateMenu={handleNavigateMenu}
          onScanQR={handleScanQR}
          onOpenCart={handleOpenCart}
          onOpenSidebar={handleOpenSidebar}
          activeTab={activeTab}
        />
      )}

      {/* Sidebar para clientes */}
      {isCliente && (
        <Sidebar
          visible={sidebarVisible}
          onClose={() => setSidebarVisible(false)}
          user={user}
          onLogout={handleLogout}
          onNavigate={handleNavigate}
          onOpenCart={handleOpenCart}
        />
      )}
    </LinearGradient>
  );
}
