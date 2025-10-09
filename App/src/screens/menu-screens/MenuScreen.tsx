import React, { useState, useEffect } from "react";
import {View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, RefreshControl, Dimensions} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { RootStackParamList } from "../../navigation/RootStackParamList";
import {ChefHat, Coffee, Clock, ArrowLeft, Utensils, Filter, RefreshCw, Plus, Minus, Lock} from "lucide-react-native";
import api from "../../api/axios";
import { useCart } from "../../context/CartContext";
import FloatingCart from "../../components/cart/FloatingCart";
import CartModal from "../../components/cart/CartModal";

const { width } = Dimensions.get("window");

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
  const { cartCount, addItem, updateQuantity, getItemQuantity, hasPendingOrder } = useCart();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<"all" | "plato" | "bebida">("all");
  const [cartModalVisible, setCartModalVisible] = useState(false);

  useEffect(() => {
    loadMenuItems();
  }, [selectedCategory]);

  const loadMenuItems = async () => {
    try {
      const endpoint = selectedCategory === "all" 
        ? "/menu/items" 
        : `/menu/items?category=${selectedCategory}`;
      
      const response = await api.get(endpoint);
      setMenuItems(response.data);
    } catch (error) {
      console.error("Error loading menu items:", error);
      Alert.alert(
        "Error",
        "No se pudo cargar el menú. Por favor intenta de nuevo."
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
    if (hasPendingOrder) {
      Alert.alert(
        "Pedido en proceso", 
        "Tienes un pedido enviado esperando confirmación. No puedes agregar más items hasta que sea procesado.",
        [{ text: "Entendido" }]
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
    updateQuantity(itemId, newQuantity);
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS'
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
    <LinearGradient colors={["#1a1a1a", "#2d1810", "#1a1a1a"]} style={{ flex: 1 }}>
      {/* Header */}
      <View style={{
        paddingTop: 48,
        paddingHorizontal: 24,
        paddingBottom: 16,
      }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
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
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}>
              <Utensils size={24} color="#d4af37" />
              <Text style={{
                color: "white",
                fontSize: 24,
                fontWeight: "600",
                marginLeft: 8,
              }}>
                Nuestro Menú
              </Text>
            </View>
            <Text style={{ color: "#d1d5db", fontSize: 14 }}>
              Explora nuestros deliciosos platos y bebidas
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

        {/* Category Filter */}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 8 }}>
          {[
            { key: "all", label: "Todo", icon: Filter },
            { key: "plato", label: "Platos", icon: ChefHat },
            { key: "bebida", label: "Bebidas", icon: Coffee },
          ].map((category) => {
            const IconComponent = category.icon;
            const isSelected = selectedCategory === category.key;
            
            return (
              <TouchableOpacity
                key={category.key}
                onPress={() => setSelectedCategory(category.key as any)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: isSelected ? "#d4af37" : "rgba(255,255,255,0.1)",
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                }}
              >
                <IconComponent 
                  size={16} 
                  color={isSelected ? "#1a1a1a" : "#d1d5db"} 
                />
                <Text style={{
                  color: isSelected ? "#1a1a1a" : "#d1d5db",
                  fontWeight: "500",
                  marginLeft: 6,
                }}>
                  {category.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Menu Items */}
      <ScrollView 
        style={{ flex: 1 }}
        contentContainerStyle={{ 
          paddingHorizontal: 24, 
          paddingBottom: cartCount > 0 ? 120 : 24 // Más espacio cuando hay items en el carrito
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#d4af37"
            colors={["#d4af37"]}
          />
        }
      >
        {filteredItems.length === 0 ? (
          <View style={{ 
            alignItems: "center", 
            justifyContent: "center", 
            paddingVertical: 48 
          }}>
            <Utensils size={64} color="#6b7280" />
            <Text style={{ 
              color: "#9ca3af", 
              fontSize: 18, 
              marginTop: 16,
              textAlign: "center"
            }}>
              {selectedCategory === "all" 
                ? "No hay elementos en el menú" 
                : `No hay ${selectedCategory === "plato" ? "platos" : "bebidas"} disponibles`
              }
            </Text>
          </View>
        ) : (
          <View style={{ gap: 20 }}>
            {filteredItems.map((item) => {
              const CategoryIcon = getCategoryIcon(item.category);
              const categoryColor = getCategoryColor(item.category);
              
              return (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderRadius: 16,
                    overflow: "hidden",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  {/* Images Section */}
                  {item.menu_item_images && item.menu_item_images.length > 0 && (
                    <View style={{ height: 200 }}>
                      <ScrollView 
                        horizontal 
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={{ flex: 1 }}
                      >
                        {item.menu_item_images
                          .sort((a, b) => a.position - b.position)
                          .map((img, index) => (
                            <Image
                              key={img.id}
                              source={{ uri: img.image_url }}
                              style={{
                                width: width - 48,
                                height: 200,
                                resizeMode: "cover",
                              }}
                            />
                          ))}
                      </ScrollView>
                      
                      {/* Image indicators */}
                      <View style={{
                        position: "absolute",
                        bottom: 12,
                        left: 0,
                        right: 0,
                        flexDirection: "row",
                        justifyContent: "center",
                        gap: 6,
                      }}>
                        {item.menu_item_images.map((_, index) => (
                          <View
                            key={index}
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: 4,
                              backgroundColor: "rgba(255,255,255,0.7)",
                            }}
                          />
                        ))}
                      </View>
                    </View>
                  )}

                  {/* Content Section */}
                  <View style={{ padding: 20 }}>
                    {/* Header with category */}
                    <View style={{ 
                      flexDirection: "row", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      marginBottom: 12 
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View style={{
                          backgroundColor: categoryColor,
                          borderRadius: 8,
                          padding: 6,
                          marginRight: 12,
                        }}>
                          <CategoryIcon size={16} color="white" />
                        </View>
                        <Text style={{
                          color: "#9ca3af",
                          fontSize: 12,
                          fontWeight: "500",
                          textTransform: "uppercase",
                          letterSpacing: 1,
                        }}>
                          {item.category === "plato" ? "Plato" : "Bebida"}
                        </Text>
                      </View>
                      
                      <View style={{
                        backgroundColor: "#d4af37",
                        borderRadius: 8,
                        paddingHorizontal: 12,
                        paddingVertical: 4,
                      }}>
                        <Text style={{
                          color: "#1a1a1a",
                          fontSize: 16,
                          fontWeight: "700",
                        }}>
                          {formatPrice(item.price)}
                        </Text>
                      </View>
                    </View>

                    {/* Name */}
                    <Text style={{
                      color: "white",
                      fontSize: 20,
                      fontWeight: "600",
                      marginBottom: 8,
                    }}>
                      {item.name}
                    </Text>

                    {/* Description */}
                    <Text style={{
                      color: "#d1d5db",
                      fontSize: 14,
                      lineHeight: 20,
                      marginBottom: 16,
                    }}>
                      {item.description}
                    </Text>

                    {/* Footer with prep time and cart controls */}
                    <View style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: "rgba(255,255,255,0.1)",
                    }}>
                      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
                        <Clock size={16} color="#d4af37" />
                        <Text style={{
                          color: "#d4af37",
                          fontSize: 14,
                          fontWeight: "500",
                          marginLeft: 6,
                        }}>
                          {item.prepMinutes} min
                        </Text>
                      </View>

                      {/* Add to cart controls */}
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {getItemQuantity(item.id) > 0 ? (
                          <View style={{
                            flexDirection: "row",
                            alignItems: "center",
                            backgroundColor: "#d4af37",
                            borderRadius: 8,
                            paddingHorizontal: 4,
                          }}>
                            <TouchableOpacity
                              onPress={() => handleQuantityChange(item.id, getItemQuantity(item.id) - 1)}
                              style={{
                                padding: 8,
                              }}
                            >
                              <Minus size={16} color="#1a1a1a" />
                            </TouchableOpacity>
                            
                            <Text style={{
                              color: "#1a1a1a",
                              fontWeight: "600",
                              fontSize: 16,
                              marginHorizontal: 12,
                            }}>
                              {getItemQuantity(item.id)}
                            </Text>
                            
                            <TouchableOpacity
                              onPress={() => handleQuantityChange(item.id, getItemQuantity(item.id) + 1)}
                              style={{
                                padding: 8,
                              }}
                            >
                              <Plus size={16} color="#1a1a1a" />
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            onPress={() => handleAddToCart(item)}
                            style={{
                              backgroundColor: hasPendingOrder ? "#6b7280" : "#d4af37",
                              borderRadius: 8,
                              paddingHorizontal: 16,
                              paddingVertical: 8,
                              flexDirection: "row",
                              alignItems: "center",
                              opacity: hasPendingOrder ? 0.8 : 1,
                            }}
                          >
                            {hasPendingOrder ? (
                              <>
                                <Lock size={16} color="#ffffff" />
                                <Text style={{
                                  color: "#ffffff",
                                  fontWeight: "600",
                                  marginLeft: 4,
                                }}>
                                  Bloqueado
                                </Text>
                              </>
                            ) : (
                              <>
                                <Plus size={16} color="#1a1a1a" />
                                <Text style={{
                                  color: "#1a1a1a",
                                  fontWeight: "600",
                                  marginLeft: 4,
                                }}>
                                  Agregar
                                </Text>
                              </>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Floating Cart Component */}
      <FloatingCart onPress={() => setCartModalVisible(true)} />

      {/* Cart Modal Component */}
      <CartModal
        visible={cartModalVisible}
        onClose={() => setCartModalVisible(false)}
      />
    </LinearGradient>
  );
}