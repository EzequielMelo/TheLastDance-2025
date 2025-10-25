import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Dimensions,
  Modal,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import ClientLayout from "../../components/layout/ClientLayout";
import { useBottomNav } from "../../context/BottomNavContext";
import {
  ChefHat,
  Coffee,
  Clock,
  ArrowLeft,
  Utensils,
  Filter,
  RefreshCw,
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
import FloatingCart from "../../components/cart/FloatingCart";
import CartModal from "../../components/cart/CartModal";

const { width, height } = Dimensions.get("window");
// Altura disponible por producto (reducida para mejor separación)
const ITEM_VISIBLE_HEIGHT = Math.max(height - 220, 380);

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
  const {
    cartCount,
    addItem,
    updateQuantity,
    getItemQuantity,
    hasPendingOrder,
    refreshOrders,
  } = useCart();

  // Efecto para actualizar el tab activo cuando se enfoque la pantalla
  useFocusEffect(
    React.useCallback(() => {
      setActiveTab('menu');
    }, [setActiveTab])
  );

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | "plato" | "bebida"
  >("all");
  const [cartModalVisible, setCartModalVisible] = useState(false);

  // Modo de modificación de productos rechazados
  const isModifyMode = route.params?.mode === "modify-rejected";
  const rejectedItems = route.params?.rejectedItems || [];
  const orderId = route.params?.orderId;
  const [selectedModifyItems, setSelectedModifyItems] = useState<{
    [key: string]: number;
  }>({});
  const [isSubmittingChanges, setIsSubmittingChanges] = useState(false);

  useEffect(() => {
    loadMenuItems();
  }, [selectedCategory]);

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

    if (hasPendingOrder) {
      Alert.alert(
        "Pedido en proceso",
        "Tienes un pedido enviado esperando confirmación. No puedes agregar más items hasta que sea procesado.",
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
    return (
      isModifyMode &&
      rejectedItems.some(
        (rejected: any) =>
          rejected.menu_item_id === itemId && rejected.status === "rejected",
      )
    );
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

      // Separar items nuevos de items mantenidos
      // Incluir TODOS los items de la tanda original (rejected + needs_modification)
      const allOriginalItems = rejectedItems.filter(
        (item: any) =>
          item.status === "rejected" || item.status === "needs_modification",
      );
      const originalMenuItems = allOriginalItems.map(
        (item: any) => item.menu_item_id,
      );

      // Solo los items que NO existían en la tanda original son nuevos
      const formattedNewItems = Object.entries(selectedModifyItems)
        .filter(([itemId, quantity]) => !originalMenuItems.includes(itemId))
        .map(([itemId, quantity]) => {
          const menuItem = menuItems.find(m => m.id === itemId);
          return {
            menu_item_id: itemId,
            quantity,
            unit_price: menuItem?.price || 0,
          };
        });

      // Si no hay cambios, preguntar al usuario
      if (keepItems.length === 0 && formattedNewItems.length === 0) {
        Alert.alert(
          "Sin cambios",
          "No has realizado ningún cambio. ¿Quieres mantener solo los productos disponibles de la tanda original?",
          [
            { text: "Cancelar", style: "cancel" },
            {
              text: "Mantener disponibles",
              onPress: async () => {
                try {
                  await submitTandaModifications(orderId, {
                    keepItems: needsModificationItems.map(item => item.id),
                    newItems: [],
                  });

                  Alert.alert(
                    "Cambios Enviados",
                    "Se mantendrán los productos disponibles de la tanda original",
                    [
                      {
                        text: "OK",
                        onPress: () => {
                          refreshOrders();
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
                }
                setIsSubmittingChanges(false);
              },
            },
          ],
        );
        setIsSubmittingChanges(false);
        return;
      }

      // Enviar modificaciones de tanda
      await submitTandaModifications(orderId, {
        keepItems,
        newItems: formattedNewItems,
      });

      Alert.alert(
        "Cambios Enviados",
        "Los productos modificados han sido enviados para aprobación del mozo",
        [
          {
            text: "OK",
            onPress: () => {
              refreshOrders();
              navigation.goBack();
            },
          },
        ],
      );
    } catch (error: any) {
      console.error("Error submitting modifications:", error);
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
                Alert.alert("Error", "No hay items rechazados para eliminar.");
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

  if (loading) {
    return (
      <LinearGradient
        colors={["#1a1a1a", "#2d1810", "#1a1a1a"]}
        style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
      >
        <ActivityIndicator size="large" color="#d4af37" />
        <Text style={{ color: "white", fontSize: 18, marginTop: 16 }}>
          Cargando menú...
        </Text>
      </LinearGradient>
    );
  }

  return (
    <ClientLayout
      onOpenCart={() => setCartModalVisible(true)}
      onOpenSidebar={() => {
        // Lógica para abrir sidebar si es necesario
        console.log("Abrir sidebar desde MenuScreen");
      }}
    >
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

        {/* Información compacta de items rechazados */}
        {isModifyMode &&
          (() => {
            // Filtrar solo los items que fueron realmente rechazados (sin stock)
            const actuallyRejectedItems = rejectedItems.filter(
              (item: any) => item.status === "rejected",
            );

            if (actuallyRejectedItems.length === 0) return null;

            return (
              <View
                style={{
                  backgroundColor: "rgba(239, 68, 68, 0.1)",
                  borderRadius: 8,
                  padding: 12,
                  marginHorizontal: 24,
                  marginBottom: 16,
                  borderLeftWidth: 4,
                  borderLeftColor: "#ef4444",
                }}
              >
                <View>
                  <Text
                    style={{
                      color: "#ef4444",
                      fontSize: 14,
                      fontWeight: "600",
                      marginBottom: 2,
                    }}
                  >
                    ❌ Sin stock:{" "}
                    {actuallyRejectedItems
                      .map(item => item.menu_item?.name)
                      .join(", ")}
                  </Text>
                  <Text
                    style={{
                      color: "#dc2626",
                      fontSize: 12,
                    }}
                  >
                    Selecciona productos alternativos del menú
                  </Text>
                </View>
              </View>
            );
          })()}

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
        data={filteredItems}
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

        renderItem={({ item }) => {
          const CategoryIcon = getCategoryIcon(item.category);
          const categoryColor = getCategoryColor(item.category);
          const isRejected = wasItemRejected(item.id);

          // Calculamos un espacio fijo para evitar saltos visuales
          const RESERVED_BOTTOM = 120; // Espacio fijo para carrito + navbar + padding
          
          const innerCardHeight = Math.max(
            ITEM_VISIBLE_HEIGHT - RESERVED_BOTTOM - 40, // Restamos espacio consistente
            280, // Altura mínima
          );

          return (
            <View
              style={{
                height: ITEM_VISIBLE_HEIGHT,
                width: "100%",
                justifyContent: "flex-start",
                paddingHorizontal: 24,
                paddingBottom: 32, // Más separación entre cards
              }}
            >
              <View
                style={{
                  height: innerCardHeight,
                  backgroundColor: "rgba(255,255,255,0.05)",
                  borderRadius: 16,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: isRejected ? "#ef4444" : "rgba(255,255,255,0.1)",
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
                {item.menu_item_images && item.menu_item_images.length > 0 && (
                  <View style={{ height: innerCardHeight * 0.55 }}>
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
                      renderItem={({ item: imgItem }) => (
                        <Image
                          source={{ uri: imgItem.image_url }}
                          style={{
                            width: width - 48,
                            height: innerCardHeight * 0.55,
                            resizeMode: "cover",
                          }}
                        />
                      )}
                    />
                  </View>
                )}

                {/* Content Section */}
                <View style={{ padding: 20 }}>
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
                      fontSize: 24,
                      fontWeight: "700",
                      marginBottom: 8,
                    }}
                  >
                    {item.name}
                  </Text>

                  <Text
                    style={{
                      color: "#d1d5db",
                      fontSize: 14,
                      lineHeight: 20,
                      marginBottom: 16,
                    }}
                  >
                    {item.description}
                  </Text>

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

                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      {getCurrentItemQuantity(item.id) > 0 ? (
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: isRejected ? "#9ca3af" : "#d4af37",
                            borderRadius: 8,
                            paddingHorizontal: 4,
                            opacity: isRejected ? 0.5 : 1,
                          }}
                        >
                          <TouchableOpacity
                            onPress={() =>
                              handleQuantityChange(
                                item.id,
                                getCurrentItemQuantity(item.id) - 1,
                              )
                            }
                            disabled={isRejected}
                            style={{ padding: 8 }}
                          >
                            <Minus
                              size={16}
                              color={isRejected ? "#ffffff" : "#1a1a1a"}
                            />
                          </TouchableOpacity>

                          <Text
                            style={{
                              color: isRejected ? "#ffffff" : "#1a1a1a",
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
                            disabled={isRejected}
                            style={{ padding: 8 }}
                          >
                            <Plus
                              size={16}
                              color={isRejected ? "#ffffff" : "#1a1a1a"}
                            />
                          </TouchableOpacity>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleAddToCart(item)}
                          disabled={isRejected}
                          style={{
                            backgroundColor: isRejected
                              ? "#9ca3af"
                              : hasPendingOrder && !isModifyMode
                                ? "#6b7280"
                                : "#d4af37",
                            borderRadius: 8,
                            paddingHorizontal: 16,
                            paddingVertical: 8,
                            flexDirection: "row",
                            alignItems: "center",
                            opacity: isRejected
                              ? 0.5
                              : hasPendingOrder && !isModifyMode
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
                          ) : hasPendingOrder && !isModifyMode ? (
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

      {/* Floating Cart Component o Carrito de Modificaciones */}
      {isModifyMode ? (
        // Carrito flotante para modificaciones
        Object.keys(selectedModifyItems).length > 0 && (
          <TouchableOpacity
            onPress={() => setCartModalVisible(true)}
            style={{
              position: "absolute",
              bottom: 34,
              left: 24,
              right: 24,
              backgroundColor: "#d4af37",
              borderRadius: 16,
              padding: 16,
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: "#1a1a1a",
                  fontSize: 16,
                  fontWeight: "600",
                }}
              >
                � Productos de reemplazo
              </Text>
              <Text
                style={{
                  color: "#1a1a1a",
                  fontSize: 14,
                  opacity: 0.8,
                }}
              >
                {Object.values(selectedModifyItems).reduce(
                  (sum, qty) => sum + qty,
                  0,
                )}{" "}
                productos de reemplazo
              </Text>
            </View>

            <View
              style={{
                backgroundColor: "#1a1a1a",
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 6,
                flexDirection: "row",
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  color: "#d4af37",
                  fontWeight: "600",
                  marginRight: 4,
                }}
              >
                Ver carrito
              </Text>
              <View
                style={{
                  backgroundColor: "#d4af37",
                  borderRadius: 10,
                  width: 20,
                  height: 20,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{
                    color: "#1a1a1a",
                    fontSize: 12,
                    fontWeight: "bold",
                  }}
                >
                  {Object.values(selectedModifyItems).reduce(
                    (sum, qty) => sum + qty,
                    0,
                  )}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        )
      ) : (
        // FloatingCart normal
        <>
          <FloatingCart onPress={() => setCartModalVisible(true)} />
          <CartModal
            visible={cartModalVisible}
            onClose={() => setCartModalVisible(false)}
          />
        </>
      )}
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
        />
      )}
    </ClientLayout>
  );
}
