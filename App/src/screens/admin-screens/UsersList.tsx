import React, { useEffect, useState, useContext } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ToastAndroid,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import ChefLoading from "../../components/common/ChefLoading";
import { Check, X } from "lucide-react-native";
import api from "../../api/axios";
import { AuthContext } from "../../auth/AuthContext";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";

type Props = NativeStackScreenProps<RootStackParamList, "Clients">;

type Client = {
  id: string;
  first_name: string;
  last_name: string;
  state: string;
  created_at: string;
  profile_image?: string | null;
};

export default function ClientsScreen({}: Props) {
  const { token } = useContext(AuthContext);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClients = async () => {
    try {
      const { data } = await api.get("/admin/clients?state=pendiente"); // tu endpoint
      setClients(data ?? []);
    } catch (err: any) {
      ToastAndroid.show("Error cargando usuarios", ToastAndroid.SHORT);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.post(`/admin/clients/${id}/approve`);
      ToastAndroid.show("Usuario aprobado", ToastAndroid.SHORT);
      setClients(prev => prev.filter(c => c.id !== id));
    } catch {
      ToastAndroid.show("Error aprobando", ToastAndroid.SHORT);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.post(`/admin/clients/${id}/reject`);
      ToastAndroid.show("Usuario rechazado", ToastAndroid.SHORT);
      setClients(prev => prev.filter(c => c.id !== id));
    } catch {
      ToastAndroid.show("Error rechazando", ToastAndroid.SHORT);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [token]);

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        className="flex-1 items-center justify-center"
      >
        <ChefLoading size="large" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      className="flex-1"
    >
      <View className="flex-1 p-4">
        <Text className="text-white text-xl font-bold mb-4">
          Usuarios pendientes
        </Text>

        {clients.length === 0 ? (
          <Text className="text-gray-400">No hay usuarios pendientes.</Text>
        ) : (
          <FlatList
            data={clients}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <View className="flex-row items-center mb-4 rounded-2xl border border-white/15 bg-white/5 p-3">
                {/* Foto */}
                {item.profile_image ? (
                  <Image
                    source={{ uri: item.profile_image }}
                    className="w-12 h-12 rounded-full bg-gray-700"
                  />
                ) : (
                  <View className="w-12 h-12 rounded-full bg-gray-700 items-center justify-center">
                    <Text className="text-white text-lg">
                      {item.first_name.charAt(0)}
                    </Text>
                  </View>
                )}

                {/* Info */}
                <View className="flex-1 ml-3">
                  <Text className="text-white text-base font-medium">
                    {item.first_name} {item.last_name}
                  </Text>
                  <Text className="text-gray-400 text-xs">
                    {new Date(item.created_at).toLocaleDateString("es-AR")}
                  </Text>
                </View>

                {/* Acciones */}
                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => handleApprove(item.id)}
                    className="w-10 h-10 rounded-full bg-green-600 items-center justify-center"
                  >
                    <Check size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleReject(item.id)}
                    className="w-10 h-10 rounded-full bg-red-600 items-center justify-center"
                  >
                    <X size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </LinearGradient>
  );
}
