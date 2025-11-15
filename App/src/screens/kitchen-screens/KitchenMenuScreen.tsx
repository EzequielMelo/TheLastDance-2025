import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  RefreshControl,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import ChefLoading from "../../components/common/ChefLoading";
import {
  ArrowLeft,
  RefreshCw,
  Utensils,
  Clock,
  ChefHat,
} from "lucide-react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import api from "../../api/axios";

const { width, height } = Dimensions.get("window");
// Altura disponible por producto (optimizada para dispositivos reales)
const ITEM_VISIBLE_HEIGHT = Math.max(height - 180, 460);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface MenuItemImage {
  id: string;
  item_id: string;
  position: number;
  storage_path: string;
  image_url: string;
}

interface MenuItem {
  id: string;
  category: "plato" | "bebida";
  name: string;
  description: string;
  prepMinutes: number;
  price: number;
  createdBy: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  menu_item_images: MenuItemImage[];
}

export default function KitchenMenuScreen() {
  const navigation = useNavigation<NavigationProp>();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Estado para manejar los indicadores de imagen
  const [currentImageIndex, setCurrentImageIndex] = useState<{
    [key: string]: number;
  }>({});

  useEffect(() => {
    loadMenuItems();
  }, []);

  const loadMenuItems = async () => {
    try {
      // Solo cargar platos para el cocinero
      const response = await api.get("/menu/items?category=plato");
      setMenuItems(response.data);
    } catch (error) {
      console.error("Error loading menu items:", error);
      Alert.alert(
        "Error",
        "No se pudo cargar el menú. Por favor intenta de nuevo.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMenuItems();
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ChefLoading size="large" text="Cargando platos..." />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
      style={{ flex: 1 }}
    >
      {/* Header */}
      <View
        style={{
          paddingTop: 30,
          paddingHorizontal: 24,
          paddingBottom: 26,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 8,
              marginRight: 16,
            }}
          >
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>

          <View style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <ChefHat size={24} color="#d4af37" />
              <Text
                style={{
                  color: "white",
                  fontSize: 24,
                  fontWeight: "600",
                  marginLeft: 8,
                }}
              >
                Menú de Platos
              </Text>
            </View>
            <Text style={{ color: "#d1d5db", fontSize: 14 }}>
              Visualiza todos los platos disponibles
            </Text>
          </View>

          <TouchableOpacity
            onPress={onRefresh}
            style={{
              backgroundColor: "rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 8,
            }}
          >
            <RefreshCw size={20} color="#d4af37" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Menu Items */}
      <FlatList
        data={menuItems}
        keyExtractor={item => item.id}
        pagingEnabled
        decelerationRate="fast"
        snapToAlignment="start"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d4af37"
            colors={["#d4af37"]}
          />
        }
        contentContainerStyle={{
          paddingBottom: 40, // Espacio inferior sin carrito flotante
        }}
        renderItem={({ item }) => {
          // Calculamos un espacio más optimizado para dispositivos reales
          const RESERVED_BOTTOM = 80; // Menos espacio reservado sin carrito

          const innerCardHeight = Math.max(
            ITEM_VISIBLE_HEIGHT - RESERVED_BOTTOM - 15,
            360,
          );

          // Función para manejar el scroll de imágenes
          const handleImageScroll = (
            event: NativeSyntheticEvent<NativeScrollEvent>,
          ) => {
            const scrollPosition = event.nativeEvent.contentOffset.x;
            const imageIndex = Math.round(scrollPosition / (width - 48));
            setCurrentImageIndex(prev => ({
              ...prev,
              [item.id]: imageIndex,
            }));
          };

          const currentImageIdx = currentImageIndex[item.id] || 0;

          return (
            <View
              style={{
                height: ITEM_VISIBLE_HEIGHT,
                width: "100%",
                justifyContent: "flex-start",
                paddingHorizontal: 24,
                paddingBottom: 20,
              }}
            >
              <View
                style={{
                  height: innerCardHeight,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(255,255,255,0.1)",
                }}
              >
                {/* Images Section */}
                {item.menu_item_images && item.menu_item_images.length > 0 && (
                  <View
                    style={{
                      height: innerCardHeight * 0.5,
                      position: "relative",
                    }}
                  >
                    <FlatList
                      data={item.menu_item_images.sort(
                        (a, b) => a.position - b.position,
                      )}
                      keyExtractor={img => img.id}
                      horizontal
                      pagingEnabled
                      decelerationRate="fast"
                      snapToInterval={width - 48}
                      showsHorizontalScrollIndicator={false}
                      onScroll={handleImageScroll}
                      scrollEventThrottle={16}
                      renderItem={({ item: imgItem }) => (
                        <Image
                          source={{ uri: imgItem.image_url }}
                          style={{
                            width: width - 48,
                            height: innerCardHeight * 0.5,
                            resizeMode: "cover",
                          }}
                        />
                      )}
                    />

                    {/* Indicadores de página para las imágenes */}
                    {item.menu_item_images.length > 1 && (
                      <View
                        style={{
                          position: "absolute",
                          bottom: 12,
                          left: 0,
                          right: 0,
                          flexDirection: "row",
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        {item.menu_item_images.map((_, index) => (
                          <View
                            key={index}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor:
                                currentImageIdx === index
                                  ? "#d4af37"
                                  : "rgba(255,255,255,0.4)",
                              marginHorizontal: 4,
                            }}
                          />
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {/* Content Section */}
                <View style={{ flex: 1, padding: 20, paddingBottom: 10 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <View
                        style={{
                          backgroundColor: "#ef4444",
                          borderRadius: 8,
                          padding: 6,
                          marginRight: 12,
                        }}
                      >
                        <Utensils size={16} color="white" />
                      </View>
                      <Text
                        style={{
                          color: "#9ca3af",
                          fontSize: 12,
                          fontWeight: "500",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                        }}
                      >
                        Plato
                      </Text>
                    </View>

                    <View
                      style={{
                        backgroundColor: "#d4af37",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                      }}
                    >
                      <Text
                        style={{
                          color: "#1a1a1a",
                          fontSize: 16,
                          fontWeight: "700",
                        }}
                      >
                        {formatPrice(item.price)}
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={{
                      color: "white",
                      fontSize: 22,
                      fontWeight: "700",
                      marginBottom: 8,
                    }}
                  >
                    {item.name}
                  </Text>

                  {/* Descripción scrolleable limitada a 3 líneas de altura */}
                  <ScrollView
                    style={{
                      maxHeight: 60, // Altura de 3 líneas (20px lineHeight * 3)
                      marginBottom: 16,
                    }}
                    contentContainerStyle={{
                      paddingRight: 4, // Un poco de padding para evitar que se corte el texto
                    }}
                    showsVerticalScrollIndicator={true} // Mostrar barra para indicar que es scrolleable
                    nestedScrollEnabled={true}
                  >
                    <Text
                      style={{
                        color: "#d1d5db",
                        fontSize: 14,
                        lineHeight: 20,
                      }}
                    >
                      {item.description}
                    </Text>
                  </ScrollView>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.1)",
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        flex: 1,
                      }}
                    >
                      <Clock size={16} color="#d4af37" />
                      <Text
                        style={{
                          color: "#d4af37",
                          fontSize: 14,
                          fontWeight: "500",
                          marginLeft: 6,
                        }}
                      >
                        {item.prepMinutes} min
                      </Text>
                    </View>

                    {/* Información de solo vista */}
                    <View
                      style={{
                        backgroundColor: "rgba(212, 175, 55, 0.2)",
                        borderRadius: 8,
                        paddingHorizontal: 16,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: "#d4af37",
                      }}
                    >
                      <Text
                        style={{
                          color: "#d4af37",
                          fontWeight: "600",
                          fontSize: 14,
                        }}
                      >
                        Solo vista
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />
    </LinearGradient>
  );
}
