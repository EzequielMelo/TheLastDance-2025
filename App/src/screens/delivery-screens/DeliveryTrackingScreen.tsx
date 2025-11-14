import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  Animated,
  PanResponder,
  Dimensions,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import {
  MapPin,
  Phone,
  ChevronLeft,
  RefreshCcw,
  User,
  Navigation2,
  MessageCircle,
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import type {
  RootStackNavigationProp,
  RootStackParamList,
} from "../../navigation/RootStackParamList";
import api from "../../api/axios";
import type { DeliveryWithOrder } from "../../types/Delivery";
import { useAuth } from "../../auth/useAuth";
import DeliveryPaymentModal from "./DeliveryPaymentModal";
import {
  setDeliveryPaymentMethod,
  updateDriverLocation,
} from "../../api/deliveries";
import { io, Socket } from "socket.io-client";
import { SERVER_BASE_URL } from "../../api/config";

type DeliveryTrackingRouteProp = RouteProp<
  RootStackParamList,
  "DeliveryTracking"
>;

/**
 * Pantalla de seguimiento en tiempo real del delivery
 */
const DeliveryTrackingScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const route = useRoute<DeliveryTrackingRouteProp>();
  const { deliveryId } = route.params;
  const { user } = useAuth();
  const mapRef = useRef<MapView>(null);

  const [delivery, setDelivery] = useState<DeliveryWithOrder | null>(null);
  const deliveryRef = useRef<DeliveryWithOrder | null>(null); // 📌 Ref para mantener valor actualizado
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);

  // Estado para el botón deslizable
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [isDelivering, setIsDelivering] = useState(false);
  const screenWidth = Dimensions.get("window").width;
  const SLIDE_THRESHOLD = screenWidth * 0.7;

  // Estado para el modal de pago
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Socket.IO ref para actualizaciones en tiempo real
  const socketRef = useRef<Socket | null>(null);

  // Debug: Monitorear cambios en delivery y actualizar ref
  useEffect(() => {
    deliveryRef.current = delivery; // 📌 Actualizar ref
    console.log("📦 Estado delivery cambió:", {
      existe: !!delivery,
      id: delivery?.id,
      status: delivery?.status,
      hasOrder: !!delivery?.delivery_order,
      totalAmount: delivery?.delivery_order?.total_amount,
    });
  }, [delivery]);

  // Obtener permisos de ubicación
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          setLocationPermission(true);

          // Obtener ubicación actual
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          setDriverLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });

          // Actualizar ubicación cada 10 segundos
          const watchId = await Location.watchPositionAsync(
            {
              accuracy: Location.Accuracy.High,
              timeInterval: 10000,
              distanceInterval: 10,
            },
            newLocation => {
              setDriverLocation({
                latitude: newLocation.coords.latitude,
                longitude: newLocation.coords.longitude,
              });
            },
          );

          return () => {
            watchId.remove();
          };
        } else {
          Alert.alert(
            "Permisos necesarios",
            "Se necesitan permisos de ubicación para mostrar tu posición en el mapa",
          );
        }
      } catch (error) {
        console.error("Error obteniendo ubicación:", error);
      }
    })();
  }, []);

  // PanResponder para el botón deslizable
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx >= 0 && gestureState.dx <= SLIDE_THRESHOLD) {
          slideAnim.setValue(gestureState.dx);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx >= SLIDE_THRESHOLD) {
          // Completar el deslizamiento
          Animated.spring(slideAnim, {
            toValue: SLIDE_THRESHOLD,
            useNativeDriver: false,
          }).start(() => {
            handleCompleteDelivery();
          });
        } else {
          // Regresar a la posición inicial
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 5,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  const handleCompleteDelivery = async () => {
    console.log("🎯 handleCompleteDelivery llamado");
    console.log("🎯 isDelivering:", isDelivering);
    console.log("🎯 delivery desde state:", !!delivery);
    console.log("🎯 delivery desde ref:", !!deliveryRef.current);

    // Usar deliveryRef.current en lugar de delivery para evitar stale closure
    const currentDelivery = deliveryRef.current;

    if (isDelivering || !currentDelivery) {
      console.log("⚠️ Bloqueado: isDelivering o no hay delivery");
      return;
    }

    console.log("✅ Abriendo modal de pago...");
    console.log("✅ Delivery ID:", currentDelivery.id);
    console.log(
      "✅ Total Amount:",
      currentDelivery.delivery_order?.total_amount,
    );

    // En lugar de completar directamente, abrir modal de pago
    setShowPaymentModal(true);

    // Resetear el slider
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: false,
    }).start();
  };
  const handleSelectPaymentMethod = async (
    method: "qr" | "cash",
    tipAmount: number,
    tipPercentage: number,
    satisfactionLevel: string,
  ) => {
    try {
      setShowPaymentModal(false);
      setIsDelivering(true);

      // Establecer método de pago en el backend
      await setDeliveryPaymentMethod(deliveryId, {
        payment_method: method,
        tip_percentage: tipPercentage,
        satisfaction_level: satisfactionLevel,
      });

      const paymentData = {
        totalAmount: delivery?.delivery_order?.total_amount || 0,
        tipAmount,
        tipPercentage,
        satisfactionLevel,
      };

      // Navegar a la pantalla correspondiente según el método
      if (method === "qr") {
        navigation.navigate("DeliveryPaymentQR", {
          deliveryId,
          paymentData,
        });
      } else {
        navigation.navigate("DeliveryCashConfirm", {
          deliveryId,
          paymentData,
        });
      }
    } catch (error: any) {
      console.error("Error al establecer método de pago:", error);
      Alert.alert(
        "Error",
        error.response?.data?.error ||
          "No se pudo establecer el método de pago. Intenta de nuevo.",
      );
      setIsDelivering(false);
    }
  };

  // Obtener ruta usando Google Directions API a través del backend
  const fetchRoute = async (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
  ) => {
    try {
      console.log("🗺️ === INICIO FETCH ROUTE ===");
      console.log("📍 Origen:", JSON.stringify(origin));
      console.log("📍 Destino:", JSON.stringify(destination));

      // Llamar al backend que tiene la API key
      const response = await api.get("/deliveries/route", {
        params: {
          originLat: origin.latitude,
          originLng: origin.longitude,
          destLat: destination.latitude,
          destLng: destination.longitude,
        },
      });

      console.log("📦 Respuesta del backend:", JSON.stringify(response.data));

      if (response.data.success && response.data.polyline) {
        const points = decodePolyline(response.data.polyline);
        console.log(`✅ Ruta calculada: ${points.length} puntos`);
        console.log(`📏 Distancia: ${response.data.distance}`);
        console.log(`⏱️ Duración: ${response.data.duration}`);
        console.log(
          "🎯 Primeros 3 puntos:",
          JSON.stringify(points.slice(0, 3)),
        );
        setRouteCoordinates(points);
        console.log(
          "✅ routeCoordinates actualizado con",
          points.length,
          "puntos",
        );
      } else {
        console.warn("⚠️ No se pudo calcular ruta, usando línea recta");
        console.warn("Response data:", JSON.stringify(response.data));
        setRouteCoordinates([origin, destination]);
      }
    } catch (error: any) {
      console.error("❌ Error obteniendo ruta:");
      console.error(
        "Error completo:",
        JSON.stringify(error.response?.data || error.message),
      );
      // Fallback a línea directa
      setRouteCoordinates([origin, destination]);
    }
  };

  // Decodificar polyline de Google (formato encoded)
  const decodePolyline = (encoded: string) => {
    const points: Array<{ latitude: number; longitude: number }> = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  const fetchDeliveryDetails = async () => {
    try {
      console.log("🔄 fetchDeliveryDetails iniciado");
      console.log("🔄 deliveryId buscado:", deliveryId);
      console.log("🔄 user profile_code:", user?.profile_code);

      // Si es repartidor, obtener deliveries del driver, si no, obtener delivery activo del cliente
      const endpoint =
        user?.profile_code === "empleado"
          ? "/deliveries/driver"
          : "/deliveries/active";

      console.log("🔄 Endpoint:", endpoint);
      const response = await api.get(endpoint);
      console.log("✅ Response recibida:", response.data.success);

      if (response.data.success) {
        let activeDelivery = null;

        // Si es repartidor, buscar el delivery específico en el array
        if (user?.profile_code === "empleado" && response.data.deliveries) {
          console.log(
            "👤 Soy repartidor. Buscando en array de",
            response.data.deliveries.length,
            "deliveries",
          );
          activeDelivery = response.data.deliveries.find(
            (d: any) => d.id === deliveryId,
          );
          console.log("👤 Delivery encontrado:", !!activeDelivery);
        } else if (response.data.delivery) {
          console.log("👤 Soy cliente. Verificando delivery");
          // Si es cliente, verificar que sea el delivery correcto
          activeDelivery =
            response.data.delivery.id === deliveryId
              ? response.data.delivery
              : null;
          console.log("👤 Delivery correcto:", !!activeDelivery);
        }

        if (activeDelivery) {
          console.log(
            "✅ Seteando delivery:",
            activeDelivery.id,
            "Status:",
            activeDelivery.status,
          );
          setDelivery(activeDelivery);

          // La ruta se calcula automáticamente en el useEffect cuando driverLocation está disponible

          // Ajustar el mapa para mostrar todos los marcadores
          if (mapRef.current && driverLocation) {
            setTimeout(() => {
              const coordinates = [
                driverLocation,
                {
                  latitude: activeDelivery.delivery_latitude,
                  longitude: activeDelivery.delivery_longitude,
                },
              ];

              if (activeDelivery.origin_latitude) {
                coordinates.unshift({
                  latitude: activeDelivery.origin_latitude,
                  longitude: activeDelivery.origin_longitude!,
                });
              }

              mapRef.current?.fitToCoordinates(coordinates, {
                edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
                animated: true,
              });
            }, 500);
          }
        } else {
          Alert.alert("Error", "Este delivery ya no está activo", [
            { text: "OK", onPress: () => navigation.goBack() },
          ]);
        }
      }
    } catch (error) {
      console.error("Error fetching delivery:", error);
      Alert.alert("Error", "No se pudo cargar la información del delivery");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDeliveryDetails();

    // Auto-refresh cada 30 segundos (reducido porque Socket.IO actualiza en tiempo real)
    const interval = setInterval(fetchDeliveryDetails, 30000);
    return () => clearInterval(interval);
  }, [deliveryId]);

  // 📍 Enviar ubicación al backend si es el repartidor
  useEffect(() => {
    if (!delivery || !driverLocation || !user) return;

    // Solo enviar si soy el repartidor y el delivery está en camino
    const isDriver = delivery.driver_id === user.id;
    const isOnTheWay = delivery.status === "on_the_way";

    if (isDriver && isOnTheWay) {
      console.log("📍 Enviando ubicación del repartidor al backend...");

      const sendLocation = async () => {
        try {
          await updateDriverLocation(deliveryId, driverLocation);
          console.log("✅ Ubicación del repartidor actualizada");
        } catch (error) {
          console.error("❌ Error actualizando ubicación:", error);
        }
      };

      // Enviar inmediatamente
      sendLocation();

      // Enviar cada 10 segundos
      const interval = setInterval(sendLocation, 10000);
      return () => clearInterval(interval);
    }
  }, [
    driverLocation,
    delivery?.id,
    delivery?.status,
    delivery?.driver_id,
    user?.id,
  ]);

  // 🔌 Socket.IO: Escuchar actualizaciones de ubicación del repartidor (para clientes)
  useEffect(() => {
    if (!user || !delivery) return;

    // Solo conectar Socket.IO si soy el cliente
    const isClient = delivery.user_id === user.id;
    if (!isClient) return;

    console.log("🔌 Conectando Socket.IO para actualizaciones de ubicación...");

    // Crear conexión Socket.IO
    const socket = io(SERVER_BASE_URL, {
      auth: { token: user.id }, // Usar el token real de autenticación
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("🔌 Socket conectado para tracking de delivery");
      socket.emit("join_user_room", user.id);
    });

    // Escuchar actualizaciones de ubicación del repartidor
    socket.on(
      "driver_location_updated",
      (data: {
        deliveryId: string;
        latitude: number;
        longitude: number;
        updatedAt: string;
      }) => {
        console.log(
          "📍 Ubicación del repartidor actualizada vía Socket.IO:",
          data,
        );

        if (data.deliveryId === deliveryId) {
          setDriverLocation({
            latitude: data.latitude,
            longitude: data.longitude,
          });
        }
      },
    );

    socket.on("disconnect", reason => {
      console.log("🔌 Socket desconectado:", reason);
    });

    return () => {
      socket.off("driver_location_updated");
      socket.disconnect();
    };
  }, [user?.id, delivery?.user_id, deliveryId]);

  // Calcular ruta cuando cambie la ubicación del driver o el delivery
  useEffect(() => {
    if (driverLocation && delivery && delivery.delivery_latitude) {
      console.log("🔄 Ubicación actualizada, recalculando ruta...");
      fetchRoute(driverLocation, {
        latitude: delivery.delivery_latitude,
        longitude: delivery.delivery_longitude,
      });
    }
  }, [driverLocation, delivery?.id]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDeliveryDetails();
  };

  // Abrir navegación externa (Google Maps o Apple Maps)
  const openExternalNavigation = () => {
    if (!delivery || !driverLocation) {
      Alert.alert("Error", "No se pudo obtener la ubicación actual");
      return;
    }

    const destLat = delivery.delivery_latitude;
    const destLng = delivery.delivery_longitude;
    const originLat = driverLocation.latitude;
    const originLng = driverLocation.longitude;

    const scheme = Platform.select({
      ios: "maps://",
      android: "google.navigation:q=",
    });

    const url = Platform.select({
      ios: `maps://?saddr=${originLat},${originLng}&daddr=${destLat},${destLng}&dirflg=d`,
      android: `google.navigation:q=${destLat},${destLng}&mode=d`,
    });

    Linking.canOpenURL(scheme!).then(supported => {
      if (supported) {
        Linking.openURL(url!);
      } else {
        // Fallback a navegador
        const webUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=driving`;
        Linking.openURL(webUrl);
      }
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a] items-center justify-center">
        <ActivityIndicator size="large" color="#d4af37" />
        <Text className="text-gray-400 mt-4">Cargando información...</Text>
      </SafeAreaView>
    );
  }

  if (!delivery) {
    return (
      <SafeAreaView className="flex-1 bg-[#1a1a1a]">
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-gray-400 text-center">
            No se encontró información del delivery
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="mt-4 bg-[#d4af37] px-6 py-3 rounded-xl"
          >
            <Text className="text-black font-semibold">Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#1a1a1a]">
      {/* Header compacto */}
      <View
        className="border-b border-gray-800 px-4 py-2"
        style={{ backgroundColor: "rgba(26, 26, 26, 0.05)" }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center flex-1">
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              className="mr-3"
            >
              <ChevronLeft size={24} color="#d4af37" />
            </TouchableOpacity>
            <View className="flex-1">
              <Text className="text-lg font-bold text-white">
                {delivery.status === "on_the_way" ? "En Camino" : "Seguimiento"}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleRefresh} disabled={isRefreshing}>
            <RefreshCcw size={20} color={isRefreshing ? "#666" : "#d4af37"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Mapa de tracking en tiempo real - PANTALLA COMPLETA */}
      <View className="flex-1">
        <View className="absolute top-0 left-0 right-0 bottom-0">
          <MapView
            ref={mapRef}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            style={{ flex: 1 }}
            initialRegion={{
              latitude: delivery.delivery_latitude,
              longitude: delivery.delivery_longitude,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          >
            {/* Marcador del restaurante (origen) */}
            {delivery.origin_latitude && delivery.origin_longitude && (
              <Marker
                coordinate={{
                  latitude: delivery.origin_latitude,
                  longitude: delivery.origin_longitude,
                }}
                title="The Last Dance Restaurant"
                description="Origen del pedido"
                pinColor="#ef4444"
              />
            )}

            {/* Marcador de destino (cliente) */}
            <Marker
              coordinate={{
                latitude: delivery.delivery_latitude,
                longitude: delivery.delivery_longitude,
              }}
              title="Tu ubicación"
              description={delivery.delivery_address}
              pinColor="#d4af37"
            />

            {/* Marcador del driver (si está en camino) */}
            {(() => {
              // Determinar ubicación del repartidor
              let repartidorLocation = null;

              // Si soy el repartidor, usar mi ubicación actual (GPS)
              if (delivery.driver_id === user?.id && driverLocation) {
                repartidorLocation = driverLocation;
              }
              // Si soy el cliente, usar la ubicación del backend o Socket.IO
              else if (delivery.user_id === user?.id) {
                // Prioridad: driverLocation de Socket.IO > ubicación del backend
                if (driverLocation) {
                  repartidorLocation = driverLocation;
                } else if (
                  delivery.driver_current_latitude &&
                  delivery.driver_current_longitude
                ) {
                  repartidorLocation = {
                    latitude: delivery.driver_current_latitude,
                    longitude: delivery.driver_current_longitude,
                  };
                }
              }

              if (!repartidorLocation || delivery.status !== "on_the_way") {
                return null;
              }

              return (
                <Marker
                  coordinate={repartidorLocation}
                  title={
                    delivery.driver
                      ? `${delivery.driver.first_name} - Repartidor`
                      : "Repartidor"
                  }
                  description="Ubicación en tiempo real"
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View className="bg-blue-500 rounded-full p-2">
                    <Navigation2 size={20} color="white" />
                  </View>
                </Marker>
              );
            })()}

            {/* Ruta calculada desde ubicación actual hasta destino */}
            {(() => {
              console.log(
                "🔍 RENDER - routeCoordinates.length:",
                routeCoordinates.length,
              );
              console.log("🔍 RENDER - delivery.status:", delivery.status);
              console.log(
                "🔍 RENDER - Mostrará polyline?",
                routeCoordinates.length > 0 && delivery.status === "on_the_way",
              );
              return null;
            })()}
            {routeCoordinates.length > 0 &&
              delivery.status === "on_the_way" && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#3b82f6"
                  strokeWidth={4}
                  lineJoin="round"
                  lineCap="round"
                />
              )}

            {/* Línea punteada desde restaurante hasta ubicación actual del driver (referencia) */}
            {(() => {
              let repartidorLocation = null;

              // Determinar ubicación del repartidor
              if (delivery.driver_id === user?.id && driverLocation) {
                repartidorLocation = driverLocation;
              } else if (delivery.user_id === user?.id) {
                if (driverLocation) {
                  repartidorLocation = driverLocation;
                } else if (
                  delivery.driver_current_latitude &&
                  delivery.driver_current_longitude
                ) {
                  repartidorLocation = {
                    latitude: delivery.driver_current_latitude,
                    longitude: delivery.driver_current_longitude,
                  };
                }
              }

              if (
                !repartidorLocation ||
                !delivery.origin_latitude ||
                delivery.status !== "on_the_way"
              ) {
                return null;
              }

              return (
                <Polyline
                  coordinates={[
                    {
                      latitude: delivery.origin_latitude,
                      longitude: delivery.origin_longitude!,
                    },
                    repartidorLocation,
                  ]}
                  strokeColor="#9ca3af"
                  strokeWidth={2}
                  lineDashPattern={[5, 5]}
                />
              );
            })()}
          </MapView>

          {/* Badge de tiempo estimado flotante */}
          {delivery.estimated_time_minutes &&
            delivery.status === "on_the_way" && (
              <View
                className="absolute top-3 left-3 px-4 py-2 rounded-xl shadow-lg"
                style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
              >
                <Text className="text-xs text-gray-400">Tiempo est.</Text>
                <Text className="text-lg font-bold text-[#d4af37]">
                  {delivery.estimated_time_minutes} min
                </Text>
              </View>
            )}

          {/* Info compacta del repartidor flotante */}
          {delivery.driver && (
            <View
              className="absolute top-3 right-3 px-3 py-2 rounded-xl shadow-lg"
              style={{ backgroundColor: "rgba(0, 0, 0, 0.8)" }}
            >
              <View className="flex-row items-center">
                <View className="w-8 h-8 bg-[#d4af37] rounded-full items-center justify-center">
                  <User size={16} color="#1a1a1a" />
                </View>
                <Text className="text-sm font-semibold text-white ml-2">
                  {delivery.driver.first_name}
                </Text>
              </View>
            </View>
          )}

          {/* Botón flotante para abrir navegación externa */}
          {user?.profile_code === "empleado" && driverLocation && (
            <TouchableOpacity
              onPress={openExternalNavigation}
              className="absolute top-16 right-3 bg-[#8b5cf6] rounded-full p-3 shadow-lg"
              style={{ elevation: 5 }}
            >
              <Navigation2 size={24} color="white" />
            </TouchableOpacity>
          )}

          {/* Botón flotante para abrir chat */}
          {delivery.driver_id && delivery.status !== "delivered" && (
            <TouchableOpacity
              onPress={() =>
                navigation.navigate("DeliveryChat", { deliveryId: delivery.id })
              }
              className="absolute bottom-36 right-3 bg-[#ef4444] rounded-full p-4 shadow-lg"
              style={{ elevation: 5 }}
            >
              <MessageCircle size={28} color="white" />
            </TouchableOpacity>
          )}

          {/* Card de información flotante en la parte inferior */}
          <View
            className="absolute bottom-0 left-0 right-0 rounded-t-3xl shadow-2xl"
            style={{ backgroundColor: "rgba(26, 26, 26, 0.95)", elevation: 10 }}
          >
            <View className="px-5 py-4">
              {/* Dirección de entrega */}
              <View className="mb-4">
                <View className="flex-row items-start">
                  <MapPin size={20} color="#d4af37" />
                  <View className="flex-1 ml-3">
                    <Text className="text-sm text-gray-400 mb-1">
                      Dirección de entrega
                    </Text>
                    <Text className="text-base font-semibold text-white">
                      {delivery.delivery_address}
                    </Text>
                    {delivery.delivery_notes && (
                      <Text className="text-xs text-gray-500 mt-1">
                        Nota: {delivery.delivery_notes}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Total del pedido */}
              {delivery.delivery_order && (
                <View className="flex-row justify-between items-center mb-4 pb-4 border-b border-gray-800">
                  <Text className="text-gray-400">Total del pedido</Text>
                  <Text className="text-xl font-bold text-[#d4af37]">
                    ${delivery.delivery_order.total_amount.toFixed(2)}
                  </Text>
                </View>
              )}

              {/* Botón para abrir chat (visible para cliente y repartidor) */}
              {delivery.driver_id && delivery.status !== "delivered" && (
                <TouchableOpacity
                  onPress={() =>
                    navigation.navigate("DeliveryChat", {
                      deliveryId: delivery.id,
                    })
                  }
                  className="bg-[#ef4444] rounded-xl p-4 mb-4 flex-row items-center justify-center"
                  style={{ elevation: 2 }}
                >
                  <MessageCircle size={24} color="white" />
                  <Text className="text-white font-bold text-base ml-3">
                    {user?.profile_code === "empleado"
                      ? "Chat con el Cliente"
                      : "Chat con el Repartidor"}
                  </Text>
                </TouchableOpacity>
              )}

              {/* Botón deslizable para completar entrega (solo para repartidores) */}
              {user?.profile_code === "empleado" &&
                delivery.status === "on_the_way" && (
                  <View className="mb-2">
                    <View
                      className="rounded-2xl h-16 justify-center overflow-hidden"
                      style={{
                        position: "relative",
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                      }}
                    >
                      {/* Fondo que se revela al deslizar */}
                      <View className="absolute left-0 right-0 top-0 bottom-0 bg-green-500 items-center justify-center">
                        <Text className="text-white font-bold text-lg">
                          ✓ Confirmar Entrega
                        </Text>
                      </View>

                      {/* Botón deslizable */}
                      <Animated.View
                        {...panResponder.panHandlers}
                        style={{
                          transform: [{ translateX: slideAnim }],
                          position: "absolute",
                          left: 4,
                          top: 4,
                          bottom: 4,
                          width: 150,
                        }}
                      >
                        <View
                          className="rounded-xl h-full items-center justify-center shadow-lg flex-row"
                          style={{
                            backgroundColor: "rgba(255, 255, 255, 0.9)",
                          }}
                        >
                          <Text className="text-gray-900 font-bold mr-2">
                            Desliza →
                          </Text>
                          <View className="bg-green-500 rounded-full p-2">
                            <ChevronLeft
                              size={20}
                              color="white"
                              style={{ transform: [{ rotate: "180deg" }] }}
                            />
                          </View>
                        </View>
                      </Animated.View>

                      {/* Texto de instrucción */}
                      <View
                        className="absolute right-4 top-0 bottom-0 justify-center"
                        pointerEvents="none"
                      ></View>
                    </View>
                  </View>
                )}
            </View>
          </View>
        </View>
      </View>

      {/* Modal de Selección de Pago */}
      {delivery && (
        <DeliveryPaymentModal
          visible={showPaymentModal}
          delivery={delivery}
          onClose={() => setShowPaymentModal(false)}
          onSelectPaymentMethod={handleSelectPaymentMethod}
        />
      )}
    </SafeAreaView>
  );
};

export default DeliveryTrackingScreen;
