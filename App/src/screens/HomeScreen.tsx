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
import { LogOut, Bell } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { User } from "../types/User";

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

export default function HomeScreen({ navigation }: Props) {
  const { token, logout } = useContext(AuthContext);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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

  const handleLogout = async () => {
    await logout();
  };

  const goCreate = (initialCategory: "plato" | "bebida") => {
    navigation.navigate("CreateMenuItem", { initialCategory });
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-black">
        <ActivityIndicator />
      </View>
    );
  }

  const isCocinero = user?.position_code === "cocinero";
  const isBartender = user?.position_code === "bartender";
  const isDueno = user?.profile_code === "dueno";
  const isSupervisor = user?.profile_code === "supervisor";
  const IMGS = {
    newStaff: require("../../assets/new-staff.png"),
    churrasco: require("../../assets/churrasco.png"),
    fernet: require("../../assets/fernet.png"),
  };

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <View className="px-6 pt-14 pb-8 flex-1">
        {/* Header */}
        <View className="mb-8">
          <Text className="text-white text-2xl font-light">
            ¡Hola{user?.first_name ? `, ${user.first_name}` : ""}!
          </Text>
          <Text className="text-gray-400 mt-1">
            {user?.position_code
              ? `Estás logueado como ${user.position_code}`
              : "Bienvenido a Last Dance"}
          </Text>
        </View>

        {/* Acciones por rol */}
        <View className="gap-4">
          {isDueno && (
            <ActionTile
              title="Añadir empleado/supervisor"
              subtitle="Crear nuevos perfiles del equipo"
              onPress={() => navigation.navigate("AddStaff", { userRole: "dueno" })}
              icon={<Image source={IMGS.newStaff} style={{ width: 26, height: 26 }} />}
            />
          )}

          {isSupervisor && (
            <ActionTile
              title="Añadir empleado"
              subtitle="Crear nuevos empleados del equipo"
              onPress={() => navigation.navigate("AddStaff", { userRole: "supervisor" })}
              icon={<Image source={IMGS.newStaff} style={{ width: 26, height: 26 }} />}
            />
          )}

          {isCocinero && (
            <ActionTile
              title="Agregar plato"
              subtitle="Publicá un nuevo plato en el menú"
              onPress={() => goCreate("plato")}
              icon={<Image source={IMGS.churrasco} style={{ width: 26, height: 26 }} />}
            />
          )}

          {isBartender && (
            <ActionTile
              title="Agregar bebida"
              subtitle="Sumá una nueva bebida al menú"
              onPress={() => goCreate("bebida")}
              icon={<Image source={IMGS.fernet} style={{ width: 26, height: 26 }} />}
            />
          )}

          {isDueno || isSupervisor&& (
            <TouchableOpacity
              onPress={() => navigation.navigate("Clients")}
              className="flex-row items-center p-4 bg-white/10 rounded-lg mb-4"
            >
              <Text className="text-white text-lg font-medium">
                Gestionar Usuarios Pendientes
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Spacer */}
        <View className="flex-1" />

        {/* Logout */}
        <TouchableOpacity
          onPress={handleLogout}
          className="flex-row items-center justify-center rounded-xl h-12 bg-white/10 border border-white/20"
        >
          <LogOut size={18} color="#fff" />
          <Text className="text-white ml-2">Cerrar sesión</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

/** Tarjeta/CTA simple */
function ActionTile({
  title,
  subtitle,
  onPress,
  icon,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
  icon: React.ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="rounded-2xl overflow-hidden"
      activeOpacity={0.92}
    >
      <LinearGradient
        colors={["#d4af37", "#b8941f", "#d4af37"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className="p-4"
      >
        <View className="flex-row items-center">
          <View className="w-10 h-10 rounded-xl bg-[#1a1a1a] items-center justify-center">
            {icon}
          </View>
          <View className="ml-3 flex-1">
            <Text className="text-[#1a1a1a] text-base font-semibold">
              {title}
            </Text>
            <Text className="text-[#1a1a1a] opacity-80 text-xs">
              {subtitle}
            </Text>
          </View>
          <Text className="text-[#1a1a1a] text-xl">›</Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}
