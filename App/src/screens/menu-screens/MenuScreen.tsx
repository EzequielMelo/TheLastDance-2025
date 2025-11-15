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
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  useNavigation,
  useRoute,
  useFocusEffect,
} from "@react-navigation/native";
import ChefLoading from "../../components/common/ChefLoading";
import CustomAlert from "../../components/common/CustomAlert";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import ClientLayout from "../../components/layout/ClientLayout";
import { useBottomNav } from "../../context/BottomNavContext";
import {
  ChefHat,
  Coffee,
  Clock,
  Utensils,
  Filter,
  Plus,
  Minus,
  Lock,
  X,
  ShoppingCart,
} from "lucide-react-native";
import api from "../../api/axios";
import {
  replaceRejectedItems,
  addItemsToExistingOrder,
  submitTandaModifications,
} from "../../api/orders";
import { useCart } from "../../context/CartContext";
import { useClientState } from "../../Hooks/useClientState";
import { useAuth } from "../../auth/useAuth";
import FloatingCart from "../../components/cart/FloatingCart";
import FloatingModifyCart from "../../components/cart/FloatingModifyCart";
import CartModal from "../../components/cart/CartModal";

const { width, height } = Dimensions.get("window");
// Altura disponible por producto (optimizada para dispositivos reales)
const ITEM_VISIBLE_HEIGHT = Math.max(height - 180, 460);

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type MenuScreenRouteProp = RouteProp<RootStackParamList, "Menu">;

interface MenuItemImage {
  id: string;
  item_id: string;
  position: number;
  storage_path: string;
  image_url: string; // URL completa desde el backend
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

export default function MenuScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<MenuScreenRouteProp>();
  const { setActiveTab } = useBottomNav();
  const { state: clientState } = useClientState();
  const { user } = useAuth();
  const {
    cartCount,
    addItem,
    updateQuantity,
    getItemQuantity,
    hasPendingOrder,
    refreshOrders,
    isDeliveryOrder,
  } = useCart();

  // El cliente no está sentado en una mesa (excepto si es delivery)
  const isNotSeated = clientState !== "seated" && !isDeliveryOrder;

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "plato" | "bebida"
  >("all");
  const [cartModalVisible, setCartModalVisible] = useState(false);

  // Estado para manejar los indicadores de imagen
  const [currentImageIndex, setCurrentImageIndex] = useState<{
    [key: string]: number;
  }>({});

  // Modo de modificación de productos rechazados
  const isModifyMode = route.params?.mode === "modify-rejected";
  const rejectedItems = route.params?.rejectedItems || [];
  const orderId = route.params?.orderId;
  const [selectedModifyItems, setSelectedModifyItems] = useState<{
    [key: string]: number;
  }>({});
  const [isSubmittingChanges, setIsSubmittingChanges] = useState(false);

  // Estado para almacenar TODOS los items rechazados de la sesión actual
  const [allRejectedItemIds, setAllRejectedItemIds] = useState<Set<string>>(
    new Set(),
  );

  // Estados para CustomAlert
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    type: "info" as "success" | "error" | "warning" | "info",
    title: "",
    message: "",
    buttons: [] as Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  });

  const showCustomAlert = (
    title: string,
    message: string,
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
    type: "success" | "error" | "warning" | "info" = "info",
  ) => {
    setAlertConfig({
      type,
      title,
      message,
      buttons: buttons || [{ text: "OK" }],
    });
    setShowAlert(true);
  };

  useEffect(() => {
    loadMenuItems();
  }, [selectedCategory]);

  // Cargar TODOS los items rechazados de la orden actual del usuario
  const loadRejectedItems = async () => {
    try {
      const response = await api.get("/orders/my-orders");
      const myOrders = response.data;

      // Buscar la orden activa (no pagada)
      const activeOrder = myOrders.find((order: any) => !order.is_paid);

      if (activeOrder && activeOrder.order_items) {
        // Obtener todos los menu_item_id de items con status "rejected"
        const rejectedIds = new Set<string>(
          activeOrder.order_items
            .filter((item: any) => item.status === "rejected")
            .map((item: any) => item.menu_item_id as string),
        );
        setAllRejectedItemIds(rejectedIds);
      } else {
        // No hay orden activa, limpiar items rechazados
        setAllRejectedItemIds(new Set());
      }
    } catch (error) {
      console.error("Error cargando items rechazados:", error);
    }
  };

  useEffect(() => {
    loadRejectedItems();
  }, [refreshing]); // Re-cargar cuando se refresca

  // Inicializar items seleccionados solo con los disponibles (NO los rechazados)
  useEffect(() => {
    if (isModifyMode && rejectedItems.length > 0) {
      const initialSelected: { [key: string]: number } = {};
      // Solo incluir items que NO están rechazados (disponibles en la tanda)
      rejectedItems.forEach((item: any) => {
        if (item.status !== "rejected") {
          initialSelected[item.menu_item_id] = item.quantity;
        }
      });
      setSelectedModifyItems(initialSelected);
    }
  }, [isModifyMode, rejectedItems]);

  const loadMenuItems = async () => {
    try {
      const endpoint =
        selectedCategory === "all"
          ? "/menu/items"
          : `/menu/items?category=${selectedCategory}`;

      const response = await api.get(endpoint);
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

  const handleAddToCart = (item: MenuItem) => {
    // No permitir agregar items rechazados
    if (wasItemRejected(item.id)) {
      Alert.alert(
        "Producto no disponible",
        "Este producto fue rechazado por falta de stock. Selecciona un producto alternativo.",
        [{ text: "Entendido" }],
      );
      return;
    }

    if (isModifyMode) {
      // En modo modificación, actualizar items seleccionados
      setSelectedModifyItems(prev => ({
        ...prev,
        [item.id]: (prev[item.id] || 0) + 1,
      }));
      return;
    }

    // Verificar que el cliente esté sentado
    if (isNotSeated) {
      Alert.alert(
        "No estás sentado",
        "Debes estar sentado en una mesa para agregar productos al menú. Por favor, solicita una mesa primero.",
        [{ text: "Entendido" }],
      );
      return;
    }

    if (hasPendingOrder) {
      Alert.alert(
        "Pedido en proceso",
        "Tienes un pedido enviado esperando confirmación. No puedes agregar más productos hasta que sea procesado.",
        [{ text: "Entendido" }],
      );
      return;
    }

    addItem({
      id: item.id,
      name: item.name,
      price: item.price,
      prepMinutes: item.prepMinutes,
      category: item.category,
      image_url: item.menu_item_images?.[0]?.image_url,
    });
  };

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    // No permitir cambiar cantidad de items rechazados
    if (wasItemRejected(itemId)) {
      Alert.alert(
        "Producto no disponible",
        "Este producto fue rechazado por falta de stock. No puedes modificar su cantidad.",
        [{ text: "Entendido" }],
      );
      return;
    }

    if (isModifyMode) {
      // En modo modificación, actualizar items seleccionados
      if (newQuantity <= 0) {
        setSelectedModifyItems(prev => {
          const updated = { ...prev };
          delete updated[itemId];
          return updated;
        });
      } else {
        setSelectedModifyItems(prev => ({
          ...prev,
          [itemId]: newQuantity,
        }));
      }
      return;
    }

    // Verificar que el cliente esté sentado
    if (isNotSeated) {
      Alert.alert(
        "No estás sentado",
        "Debes estar sentado en una mesa para modificar tu pedido.",
        [{ text: "Entendido" }],
      );
      return;
    }

    updateQuantity(itemId, newQuantity);
  };

  const getModifyItemQuantity = (itemId: string) => {
    return selectedModifyItems[itemId] || 0;
  };

  const getCurrentItemQuantity = (itemId: string) => {
    return isModifyMode
      ? getModifyItemQuantity(itemId)
      : getItemQuantity(itemId);
  };

  const wasItemRejected = (itemId: string) => {
    // Verificar si el item está en la lista global de items rechazados de esta sesión
    return allRejectedItemIds.has(itemId);
  };

  const handleSubmitModifications = async () => {
    if (!orderId) {
      Alert.alert("Error", "No se pudo identificar la orden");
      return;
    }

    setIsSubmittingChanges(true);
    try {
      // Identificar items needs_modification de la tanda original
      const needsModificationItems = rejectedItems.filter(
        (item: any) => item.status === "needs_modification",
      );

      // Items needs_modification que el usuario mantiene (están en selectedModifyItems)
      const keepItems = needsModificationItems
        .filter((item: any) => selectedModifyItems[item.menu_item_id])
        .map((item: any) => item.id);

      // IDs de los items needs_modification (NO incluir los rejected)
      const needsModificationMenuItemIds = needsModificationItems.map(
        (item: any) => item.menu_item_id,
      );

      // Items nuevos = todos los que están en selectedModifyItems pero NO son needs_modification
      const formattedNewItems = Object.entries(selectedModifyItems)
        .filter(
          ([itemId, quantity]) =>
            !needsModificationMenuItemIds.includes(itemId),
        )
        .map(([itemId, quantity]) => {
          const menuItem = menuItems.find(m => m.id === itemId);
          return {
            menu_item_id: itemId,
            quantity,
            unit_price: menuItem?.price || 0,
          };
        });

      // Si no hay cambios (ni keepItems ni newItems), preguntar al usuario
      if (keepItems.length === 0 && formattedNewItems.length === 0) {
        Alert.alert(
          "Sin cambios",
          "No has seleccionado ningún producto. ¿Quieres cancelar la modificación?",
          [
            { text: "Volver a seleccionar", style: "cancel" },
            {
              text: "Cancelar modificación",
              style: "destructive",
              onPress: () => {
                setIsSubmittingChanges(false);
                navigation.goBack();
              },
            },
          ],
        );
        setIsSubmittingChanges(false);
        return;
      }

      const payload = {
        keepItems,
        newItems: formattedNewItems,
      };

      // Enviar modificaciones de tanda
      const response = await submitTandaModifications(orderId, payload);

      Alert.alert(
        "Cambios Enviados",
        `Se han enviado ${keepItems.length} producto(s) original(es) y ${formattedNewItems.length} producto(s) nuevo(s) para aprobación`,
        [
          {
            text: "OK",
            onPress: () => {
              refreshOrders();
              loadRejectedItems(); // Recargar items rechazados
              navigation.goBack();
            },
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.message || "No se pudieron enviar los cambios",
      );
    } finally {
      setIsSubmittingChanges(false);
    }
  };

  const handleCancelModifications = () => {
    const actuallyRejectedCount = rejectedItems.filter(
      (item: any) => item.status === "rejected",
    ).length;
    Alert.alert(
      "Cancelar Modificación",
      `¿Estás seguro que quieres cancelar? Los ${actuallyRejectedCount} productos rechazados serán eliminados permanentemente y no se agregarán productos nuevos.`,
      [
        {
          text: "No, continuar modificando",
          style: "cancel",
        },
        {
          text: "Sí, eliminar productos",
          style: "destructive",
          onPress: async () => {
            if (!orderId) {
              Alert.alert("Error", "No se pudo identificar la orden");
              return;
            }

            try {
              // Solo eliminar los productos rechazados sin reemplazarlos
              const actuallyRejectedItems = rejectedItems.filter(
                (item: any) => item.status === "rejected",
              );
              const rejectedItemIds = actuallyRejectedItems.map(
                (item: any) => item.id,
              );

              if (rejectedItemIds.length === 0) {
                Alert.alert(
                  "Error",
                  "No hay productos rechazados para eliminar.",
                );
                return;
              }

              await replaceRejectedItems(orderId, rejectedItemIds, []); // Array vacío = no reemplazar

              Alert.alert(
                "Productos Eliminados",
                "Los productos rechazados han sido eliminados de tu pedido",
                [
                  {
                    text: "OK",
                    onPress: () => {
                      refreshOrders();
                      loadRejectedItems(); // Recargar items rechazados
                      navigation.goBack();
                    },
                  },
                ],
              );
            } catch (error: any) {
              console.error("Error canceling modifications:", error);
              Alert.alert("Error", "No se pudieron eliminar los productos");
            }
          },
        },
      ],
    );
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
    }).format(price);
  };

  const getCategoryIcon = (category: "plato" | "bebida") => {
    return category === "plato" ? ChefHat : Coffee;
  };

  const getCategoryColor = (category: "plato" | "bebida") => {
    return category === "plato" ? "#ef4444" : "#3b82f6";
  };

  const filteredItems = menuItems.filter(item => {
    if (selectedCategory === "all") return true;
    return item.category === selectedCategory;
  });

  const flatListRef = useRef<FlatList>(null);

  // Efecto para actualizar el tab activo cuando se enfoque la pantalla
  useFocusEffect(
    React.useCallback(() => {
      setActiveTab("menu");
    }, [setActiveTab]),
  );

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ChefLoading size="large" text="Cargando menú..." />
      </LinearGradient>
    );
  }

  return (
    <ClientLayout
      onOpenCart={() => setCartModalVisible(true)}
      onOpenSidebar={() => {
        // Lógica para abrir sidebar si es necesario
      }}
    >
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View
          style={{
            paddingTop: 48,
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
            <View style={{ flex: 1, alignItems: "center" }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: 4,
                }}
              >
                <Utensils size={24} color="#d4af37" />
                <Text
                  style={{
                    color: "white",
                    fontSize: 24,
                    fontWeight: "600",
                    marginLeft: 8,
                  }}
                >
                  {isModifyMode ? "Modificar Productos" : "Nuestro Menú"}
                </Text>
              </View>
              <Text style={{ color: "#d1d5db", fontSize: 14 }}>
                {isModifyMode
                  ? "Selecciona nuevos productos para reemplazar los rechazados"
                  : "Explora nuestros deliciosos platos y bebidas"}
              </Text>
            </View>
          </View>

          {/* Category Filter */}
          <View
            style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}
          >
            {[
              { key: "all", label: "Todo", icon: Filter },
              { key: "plato", label: "Platos", icon: ChefHat },
              { key: "bebida", label: "Bebidas", icon: Coffee },
            ].map(category => {
              const IconComponent = category.icon;
              const isSelected = selectedCategory === category.key;

              return (
                <TouchableOpacity
                  key={category.key}
                  onPress={() => setSelectedCategory(category.key as any)}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: isSelected
                      ? "#d4af37"
                      : "rgba(255,255,255,0.1)",
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 20,
                  }}
                >
                  <IconComponent
                    size={16}
                    color={isSelected ? "#1a1a1a" : "#d1d5db"}
                  />
                  <Text
                    style={{
                      color: isSelected ? "#1a1a1a" : "#d1d5db",
                      fontWeight: "500",
                      marginLeft: 6,
                    }}
                  >
                    {category.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Menu Items */}
        <FlatList
          ref={flatListRef}
          data={filteredItems}
          keyExtractor={item => item.id}
          pagingEnabled
          decelerationRate="fast"
          snapToAlignment="start"
          showsVerticalScrollIndicator={false}
          // Optimizaciones de rendimiento
          removeClippedSubviews={true}
          maxToRenderPerBatch={2}
          initialNumToRender={1}
          windowSize={3}
          updateCellsBatchingPeriod={50}
          getItemLayout={(data, index) => ({
            length: ITEM_VISIBLE_HEIGHT,
            offset: ITEM_VISIBLE_HEIGHT * index,
            index,
          })}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#d4af37"
              colors={["#d4af37"]}
            />
          }
          contentContainerStyle={{
            paddingBottom: 140, // Espacio optimizado para carrito flotante + navbar
          }}
          renderItem={({ item }) => {
            const CategoryIcon = getCategoryIcon(item.category);
            const categoryColor = getCategoryColor(item.category);
            const isRejected = wasItemRejected(item.id);
            const isAnonymous = user?.profile_code === "cliente_anonimo";

            // Calculamos un espacio más optimizado para dispositivos reales
            const RESERVED_BOTTOM = 130; // Optimizado para mejor aprovechamiento

            const innerCardHeight = Math.max(
              ITEM_VISIBLE_HEIGHT - RESERVED_BOTTOM - 15, // Menos agresivo en la reducción
              360, // Altura mínima aumentada para garantizar espacio
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
                  paddingBottom: 20, // Reducido para mejor aprovechamiento del espacio
                }}
              >
                <View
                  style={{
                    height: innerCardHeight,
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: isRejected
                      ? "#ef4444"
                      : "rgba(255,255,255,0.1)",
                  }}
                >
                  {isRejected && (
                    <View
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        backgroundColor: "#ef4444",
                        borderRadius: 8,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        zIndex: 1,
                      }}
                    >
                      <Text
                        style={{
                          color: "white",
                          fontSize: 12,
                          fontWeight: "600",
                        }}
                      >
                        RECHAZADO
                      </Text>
                    </View>
                  )}

                  {/* Images Section */}
                  {item.menu_item_images &&
                    item.menu_item_images.length > 0 && (
                      <View
                        style={{
                          height: innerCardHeight * 0.5,
                          position: "relative",
                        }}
                      >
                        <FlatList
                          data={item.menu_item_images.sort(
                            (a: MenuItemImage, b: MenuItemImage) =>
                              a.position - b.position,
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
                              // Optimizaciones de rendimiento
                              resizeMethod="resize"
                              fadeDuration={0}
                              progressiveRenderingEnabled={true}
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
                            {item.menu_item_images.map(
                              (_: MenuItemImage, index: number) => (
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
                              ),
                            )}
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
                            backgroundColor: categoryColor,
                            borderRadius: 8,
                            padding: 6,
                            marginRight: 12,
                          }}
                        >
                          <CategoryIcon size={16} color="white" />
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
                          {item.category === "plato" ? "Plato" : "Bebida"}
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
                        maxHeight: 60,
                        marginBottom: 16,
                      }}
                      contentContainerStyle={{
                        paddingRight: 4,
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
                        minHeight: 48, // Altura mínima para evitar superposición
                      }}
                    >
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flex: 1,
                          marginRight: 12, // Espacio entre tiempo y botones
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

                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flexShrink: 0, // Evita que se comprima
                        }}
                      >
                        {getCurrentItemQuantity(item.id) > 0 ? (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor:
                                isRejected || (isNotSeated && !isModifyMode)
                                  ? "#9ca3af"
                                  : "#d4af37",
                              borderRadius: 8,
                              paddingHorizontal: 4,
                              opacity:
                                isRejected ||
                                (isNotSeated && !isModifyMode) ||
                                isAnonymous
                                  ? 0.5
                                  : 1,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() =>
                                handleQuantityChange(
                                  item.id,
                                  getCurrentItemQuantity(item.id) - 1,
                                )
                              }
                              disabled={
                                isRejected ||
                                (isNotSeated && !isModifyMode) ||
                                isAnonymous
                              }
                              style={{ padding: 8 }}
                            >
                              <Minus
                                size={16}
                                color={
                                  isRejected ||
                                  (isNotSeated && !isModifyMode) ||
                                  isAnonymous
                                    ? "#ffffff"
                                    : "#1a1a1a"
                                }
                              />
                            </TouchableOpacity>

                            <Text
                              style={{
                                color:
                                  isRejected ||
                                  (isNotSeated && !isModifyMode) ||
                                  isAnonymous
                                    ? "#ffffff"
                                    : "#1a1a1a",
                                fontWeight: "600",
                                fontSize: 16,
                                marginHorizontal: 12,
                              }}
                            >
                              {getCurrentItemQuantity(item.id)}
                            </Text>

                            <TouchableOpacity
                              onPress={() =>
                                handleQuantityChange(
                                  item.id,
                                  getCurrentItemQuantity(item.id) + 1,
                                )
                              }
                              disabled={
                                isRejected ||
                                (isNotSeated && !isModifyMode) ||
                                isAnonymous
                              }
                              style={{ padding: 8 }}
                            >
                              <Plus
                                size={16}
                                color={
                                  isRejected ||
                                  (isNotSeated && !isModifyMode) ||
                                  isAnonymous
                                    ? "#ffffff"
                                    : "#1a1a1a"
                                }
                              />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleAddToCart(item)}
                            disabled={
                              isRejected ||
                              (isNotSeated && !isModifyMode) ||
                              (hasPendingOrder && !isModifyMode) ||
                              isAnonymous
                            }
                            style={{
                              backgroundColor: isRejected
                                ? "#9ca3af"
                                : (isNotSeated && !isModifyMode) ||
                                    (hasPendingOrder && !isModifyMode) ||
                                    isAnonymous
                                  ? "#6b7280"
                                  : "#d4af37",
                              borderRadius: 8,
                              paddingHorizontal: 16,
                              paddingVertical: 10,
                              flexDirection: "row",
                              alignItems: "center",
                              opacity: isRejected
                                ? 0.5
                                : (isNotSeated && !isModifyMode) ||
                                    (hasPendingOrder && !isModifyMode)
                                  ? 0.8
                                  : 1,
                            }}
                          >
                            {isRejected ? (
                              <>
                                <X size={16} color="#ffffff" />
                                <Text
                                  style={{
                                    color: "#ffffff",
                                    fontWeight: "600",
                                    marginLeft: 4,
                                  }}
                                >
                                  No disponible
                                </Text>
                              </>
                            ) : (isNotSeated && !isModifyMode) ||
                              (hasPendingOrder && !isModifyMode) ? (
                              <>
                                <Lock size={16} color="#ffffff" />
                                <Text
                                  style={{
                                    color: "#ffffff",
                                    fontWeight: "600",
                                    marginLeft: 4,
                                  }}
                                >
                                  Bloqueado
                                </Text>
                              </>
                            ) : (
                              <>
                                <Plus size={16} color="#1a1a1a" />
                                <Text
                                  style={{
                                    color: "#1a1a1a",
                                    fontWeight: "600",
                                    marginLeft: 4,
                                  }}
                                >
                                  {isModifyMode ? "Seleccionar" : "Agregar"}
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              </View>
            );
          }}
        />

        {/* Floating Cart Component */}
        {isModifyMode ? (
          <FloatingModifyCart
            onPress={() => setCartModalVisible(true)}
            selectedItems={selectedModifyItems}
            menuItems={menuItems}
          />
        ) : (
          <FloatingCart onPress={() => setCartModalVisible(true)} />
        )}

        <CartModal
          visible={cartModalVisible}
          onClose={() => setCartModalVisible(false)}
        />
      </LinearGradient>

      {/* Modal para modificaciones o CartModal normal */}
      {isModifyMode ? (
        <Modal
          visible={cartModalVisible}
          animationType="slide"
          presentationStyle="pageSheet"
          onRequestClose={() => setCartModalVisible(false)}
        >
          <LinearGradient
            colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
            style={{ flex: 1 }}
          >
            <View style={{ flex: 1, paddingTop: 60 }}>
              {/* Header del modal */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 24,
                  paddingBottom: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: "rgba(255,255,255,0.1)",
                }}
              >
                <View>
                  <Text
                    style={{
                      color: "white",
                      fontSize: 24,
                      fontWeight: "700",
                    }}
                  >
                    🛒 Productos de reemplazo
                  </Text>
                  <Text
                    style={{
                      color: "#d1d5db",
                      fontSize: 14,
                      marginTop: 4,
                    }}
                  >
                    {Object.values(selectedModifyItems).reduce(
                      (sum, qty) => sum + qty,
                      0,
                    )}{" "}
                    productos de reemplazo
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setCartModalVisible(false)}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    padding: 8,
                  }}
                >
                  <X size={24} color="white" />
                </TouchableOpacity>
              </View>

              {/* Lista de productos seleccionados */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 24 }}
              >
                {/* Sección informativa de productos rechazados */}
                {(() => {
                  const actuallyRejectedItems = rejectedItems.filter(
                    (item: any) => item.status === "rejected",
                  );
                  if (actuallyRejectedItems.length === 0) return null;

                  return (
                    <View
                      style={{
                        backgroundColor: "rgba(239, 68, 68, 0.1)",
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 20,
                        borderLeftWidth: 4,
                        borderLeftColor: "#ef4444",
                      }}
                    >
                      <Text
                        style={{
                          color: "#ef4444",
                          fontSize: 16,
                          fontWeight: "600",
                          marginBottom: 8,
                        }}
                      >
                        📋 Productos que necesitas reemplazar:
                      </Text>
                      {actuallyRejectedItems.map((item: any, index: number) => (
                        <Text
                          key={index}
                          style={{
                            color: "#fca5a5",
                            fontSize: 14,
                            marginBottom: 4,
                            textDecorationLine: "line-through",
                          }}
                        >
                          • {item.menu_item?.name || "Producto"} (x
                          {item.quantity})
                        </Text>
                      ))}
                      <Text
                        style={{
                          color: "#dc2626",
                          fontSize: 12,
                          marginTop: 8,
                          fontStyle: "italic",
                        }}
                      >
                        Estos productos no se incluyen en el total del carrito
                      </Text>
                    </View>
                  );
                })()}

                {/* Productos de reemplazo seleccionados */}
                {Object.keys(selectedModifyItems).length > 0 && (
                  <Text
                    style={{
                      color: "#22c55e",
                      fontSize: 16,
                      fontWeight: "600",
                      marginBottom: 16,
                    }}
                  >
                    ✅ Productos de reemplazo seleccionados:
                  </Text>
                )}

                {Object.entries(selectedModifyItems).map(
                  ([itemId, quantity]) => {
                    const menuItem = menuItems.find(m => m.id === itemId);
                    if (!menuItem) return null;

                    return (
                      <View
                        key={itemId}
                        style={{
                          backgroundColor: "rgba(255,255,255,0.05)",
                          borderRadius: 12,
                          padding: 16,
                          marginBottom: 12,
                          borderWidth: 1,
                          borderColor: "rgba(255,255,255,0.1)",
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                color: "white",
                                fontSize: 16,
                                fontWeight: "600",
                              }}
                            >
                              {menuItem.name}
                            </Text>
                            <Text
                              style={{
                                color: "#d1d5db",
                                fontSize: 14,
                                marginTop: 4,
                              }}
                            >
                              {formatPrice(menuItem.price)} •{" "}
                              {menuItem.prepMinutes} min
                            </Text>
                          </View>

                          {/* Controles de cantidad */}
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              backgroundColor: "#d4af37",
                              borderRadius: 8,
                              paddingHorizontal: 4,
                            }}
                          >
                            <TouchableOpacity
                              onPress={() =>
                                handleQuantityChange(itemId, quantity - 1)
                              }
                              style={{ padding: 8 }}
                            >
                              <Minus size={16} color="#1a1a1a" />
                            </TouchableOpacity>

                            <Text
                              style={{
                                color: "#1a1a1a",
                                fontWeight: "600",
                                fontSize: 16,
                                marginHorizontal: 12,
                              }}
                            >
                              {quantity}
                            </Text>

                            <TouchableOpacity
                              onPress={() =>
                                handleQuantityChange(itemId, quantity + 1)
                              }
                              style={{ padding: 8 }}
                            >
                              <Plus size={16} color="#1a1a1a" />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    );
                  },
                )}

                {Object.keys(selectedModifyItems).length === 0 && (
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      paddingVertical: 60,
                    }}
                  >
                    <ShoppingCart size={64} color="#6b7280" />
                    <Text
                      style={{
                        color: "#9ca3af",
                        fontSize: 18,
                        marginTop: 16,
                        textAlign: "center",
                      }}
                    >
                      No has seleccionado productos de reemplazo
                    </Text>
                    <Text
                      style={{
                        color: "#6b7280",
                        fontSize: 14,
                        marginTop: 8,
                        textAlign: "center",
                      }}
                    >
                      Navega por el menú y selecciona productos alternativos
                    </Text>
                  </View>
                )}
              </ScrollView>

              {/* Resumen del total */}
              {Object.keys(selectedModifyItems).length > 0 && (
                <View
                  style={{
                    paddingHorizontal: 24,
                    paddingVertical: 16,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.1)",
                    backgroundColor: "rgba(255,255,255,0.02)",
                  }}
                >
                  {(() => {
                    const totalQuantity = Object.values(
                      selectedModifyItems,
                    ).reduce((sum, qty) => sum + qty, 0);
                    const totalPrice = Object.entries(
                      selectedModifyItems,
                    ).reduce((sum, [itemId, quantity]) => {
                      const menuItem = menuItems.find(m => m.id === itemId);
                      return sum + (menuItem ? menuItem.price * quantity : 0);
                    }, 0);

                    return (
                      <View>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 8,
                          }}
                        >
                          <Text style={{ color: "#d1d5db", fontSize: 16 }}>
                            Productos de reemplazo:
                          </Text>
                          <Text
                            style={{
                              color: "white",
                              fontSize: 16,
                              fontWeight: "600",
                            }}
                          >
                            {totalQuantity}{" "}
                            {totalQuantity === 1 ? "producto" : "productos"}
                          </Text>
                        </View>
                        <View
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                          }}
                        >
                          <Text
                            style={{
                              color: "#d1d5db",
                              fontSize: 18,
                              fontWeight: "600",
                            }}
                          >
                            Total de reemplazos:
                          </Text>
                          <Text
                            style={{
                              color: "#d4af37",
                              fontSize: 20,
                              fontWeight: "700",
                            }}
                          >
                            {formatPrice(totalPrice)}
                          </Text>
                        </View>
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Footer con botones de acción */}
              {Object.keys(selectedModifyItems).length > 0 && (
                <View
                  style={{
                    padding: 24,
                    borderTopWidth: 1,
                    borderTopColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity
                      onPress={handleCancelModifications}
                      style={{
                        flex: 1,
                        backgroundColor: "rgba(239, 68, 68, 0.2)",
                        borderRadius: 12,
                        padding: 16,
                        alignItems: "center",
                        borderWidth: 1,
                        borderColor: "rgba(239, 68, 68, 0.4)",
                      }}
                    >
                      <Text
                        style={{
                          color: "#ef4444",
                          fontWeight: "600",
                          fontSize: 16,
                        }}
                      >
                        🗑️ Eliminar todo
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleSubmitModifications}
                      disabled={isSubmittingChanges}
                      style={{
                        flex: 2,
                        backgroundColor: "#d4af37",
                        borderRadius: 12,
                        padding: 16,
                        alignItems: "center",
                        opacity: isSubmittingChanges ? 0.7 : 1,
                      }}
                    >
                      <Text
                        style={{
                          color: "#1a1a1a",
                          fontWeight: "700",
                          fontSize: 16,
                        }}
                      >
                        {isSubmittingChanges
                          ? "Enviando..."
                          : "✅ Confirmar cambios"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          </LinearGradient>
        </Modal>
      ) : (
        <CartModal
          visible={cartModalVisible}
          onClose={() => setCartModalVisible(false)}
          showCustomAlert={showCustomAlert}
        />
      )}

      {/* CustomAlert */}
      <CustomAlert
        visible={showAlert}
        type={alertConfig.type}
        title={alertConfig.title}
        message={alertConfig.message}
        buttons={alertConfig.buttons}
        onClose={() => setShowAlert(false)}
      />
    </ClientLayout>
  );
}
