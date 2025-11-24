import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import CustomAlert from "../../components/common/CustomAlert";
import {
  MapPin,
  Navigation,
  ChevronLeft,
  Crosshair,
  Search,
  X,
} from "lucide-react-native";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import { useCart } from "../../context/CartContext";
import { createDeliveryOrder } from "../../api/deliveries";
import { createDelivery } from "../../api/deliveries";
import { RESTAURANT_LOCATION, MAP_CONFIG } from "../../config/restaurantConfig";
import api from "../../api/axios";

interface Coordinates {
  latitude: number;
  longitude: number;
}

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

/**
 * Pantalla para seleccionar ubicación de entrega con mapa interactivo
 */
const DeliveryLocationScreen: React.FC = () => {
  const navigation = useNavigation<RootStackNavigationProp>();
  const mapRef = useRef<MapView>(null);
  const scrollRef = useRef<ScrollView>(null);
  const [isKeyboardVisible, setKeyboardVisible] = useState(false);

  // 🚚 Obtener items del carrito para crear la orden
  const { cartItems, cartAmount, cartTime, submitOrder, setIsDeliveryOrder } =
    useCart();

  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Estados para CustomAlert
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as "success" | "error" | "warning" | "info",
    buttons: [] as Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  });

  const showCustomAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" | "info",
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  ) => {
    setAlertConfig({ title, message, type, buttons: buttons || [] });
    setAlertVisible(true);
  };

  // Ubicación del restaurante (origen) - Importada desde configuración centralizada
  const restaurantLocation: Coordinates = {
    latitude: RESTAURANT_LOCATION.latitude,
    longitude: RESTAURANT_LOCATION.longitude,
  };

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      (e) => {
        console.log("🎹 Teclado abierto, altura:", e.endCoordinates.height);
        setKeyboardVisible(true);
        // Forzar scroll hacia abajo cuando se abre el teclado
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        console.log("🎹 Teclado cerrado");
        setKeyboardVisible(false);
      },
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  const [selectedLocation, setSelectedLocation] =
    useState<Coordinates>(restaurantLocation);
  const [region, setRegion] = useState({
    latitude: restaurantLocation.latitude,
    longitude: restaurantLocation.longitude,
    ...MAP_CONFIG.defaultZoom,
  });

  // Buscar direcciones con Google Places Autocomplete
  const searchAddresses = async (input: string) => {
    if (input.length < 3) {
      setPredictions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setIsSearching(true);
      const response = await api.get("/deliveries/places-autocomplete", {
        params: {
          input,
          location: `${selectedLocation.latitude},${selectedLocation.longitude}`,
        },
      });

      if (response.data.success && response.data.predictions) {
        setPredictions(response.data.predictions);
        setShowSuggestions(true);
      }
    } catch (error: any) {
      console.error("Error buscando direcciones:", error);
      console.error("Error response:", error.response?.data);

      // Mostrar mensaje de error específico
      if (error.response?.data?.error) {
        console.warn("⚠️ Google Places Error:", error.response.data.error);
      }
    } finally {
      setIsSearching(false);
    }
  };

  // Debounce para búsqueda
  const handleAddressChange = (text: string) => {
    setAddress(text);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      searchAddresses(text);
    }, 500);
  };

  // Seleccionar una dirección de las sugerencias
  const selectAddress = async (prediction: PlacePrediction) => {
    try {
      setAddress(prediction.description);
      setShowSuggestions(false);
      setPredictions([]);

      // Obtener detalles del lugar y coordenadas
      const response = await api.get("/deliveries/place-details", {
        params: { placeId: prediction.place_id },
      });

      if (response.data.success && response.data.location) {
        const { lat, lng } = response.data.location;
        const newLocation = { latitude: lat, longitude: lng };

        setSelectedLocation(newLocation);
        setRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });

        // Animar el mapa a la nueva ubicación
        mapRef.current?.animateToRegion({
          latitude: lat,
          longitude: lng,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        });
      }
    } catch (error) {
      console.error("Error obteniendo detalles del lugar:", error);
    }
  };

  // Obtener ubicación actual del usuario
  const getCurrentLocation = async () => {
    try {
      setIsLoadingLocation(true);

      // Solicitar permisos
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        showCustomAlert(
          "Permiso denegado",
          "Necesitamos acceso a tu ubicación para mostrarla en el mapa",
          "warning",
          [{ text: "OK" }],
        );
        return;
      }

      // Obtener ubicación actual
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const currentLocation: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setSelectedLocation(currentLocation);
      setRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // Animar el mapa a la ubicación actual
      mapRef.current?.animateToRegion({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      // Geocoding inverso (coordenadas → dirección)
      try {
        const addressResult =
          await Location.reverseGeocodeAsync(currentLocation);
        if (addressResult.length > 0) {
          const addr = addressResult[0];
          const formattedAddress =
            `${addr.street || ""} ${addr.streetNumber || ""}, ${addr.city || ""}, ${addr.region || ""}`.trim();
          setAddress(formattedAddress);
        }
      } catch (error) {
        console.error("Error en geocoding inverso:", error);
      }
    } catch (error) {
      console.error("Error obteniendo ubicación:", error);
      showCustomAlert(
        "Error",
        "No se pudo obtener tu ubicación actual",
        "error",
        [{ text: "OK" }],
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  // Manejar selección en el mapa
  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });

    // Geocoding inverso para obtener la dirección
    try {
      const addressResult = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });
      if (addressResult.length > 0) {
        const addr = addressResult[0];
        const formattedAddress =
          `${addr.street || ""} ${addr.streetNumber || ""}, ${addr.city || ""}, ${addr.region || ""}`.trim();
        setAddress(formattedAddress);
      }
    } catch (error) {
      console.error("Error en geocoding inverso:", error);
    }
  };

  const handleConfirmLocation = async () => {
    // Limpiar timeout si existe
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!address.trim()) {
      showCustomAlert(
        "Error",
        "Por favor ingresa o selecciona una dirección de entrega",
        "error",
        [{ text: "OK" }],
      );
      return;
    }

    if (cartItems.length === 0) {
      showCustomAlert(
        "Error",
        "No hay productos en el carrito para realizar el pedido",
        "error",
        [{ text: "OK" }],
      );
      return;
    }

    setIsLoading(true);

    try {
      // 1️⃣ Crear la orden de delivery primero
      const orderData = {
        items: cartItems.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          price: item.price,
          prepMinutes: item.prepMinutes,
          quantity: item.quantity,
          image_url: item.image_url,
        })),
        totalAmount: cartAmount,
        estimatedTime: cartTime,
      };

      console.log("📦 Creando orden de delivery...", orderData);
      const deliveryOrder = await createDeliveryOrder(orderData);
      console.log("✅ Orden de delivery creada:", deliveryOrder);

      // 2️⃣ Crear el delivery con la orden recién creada
      const deliveryData = {
        delivery_order_id: deliveryOrder.id, // 🔄 Cambiado de order_id
        delivery_address: address,
        delivery_latitude: selectedLocation.latitude,
        delivery_longitude: selectedLocation.longitude,
        delivery_notes: notes || undefined,
        origin_latitude: restaurantLocation.latitude,
        origin_longitude: restaurantLocation.longitude,
      };

      console.log("🚚 Creando delivery...", deliveryData);
      const delivery = await createDelivery(deliveryData);
      console.log("✅ Delivery creado:", delivery);

      // 3️⃣ Limpiar carrito y resetear modo delivery
      await submitOrder();
      setIsDeliveryOrder(false);

      // 4️⃣ Navegar a Home para ver el tracking
      showCustomAlert(
        "¡Pedido Realizado!",
        `Tu pedido de delivery ha sido creado exitosamente.\n\nDirección: ${address}\n\nTu pedido está siendo procesado y pronto estará en camino.`,
        "success",
        [
          {
            text: "Ver Estado",
            onPress: () => navigation.navigate("Home"),
          },
        ],
      );
    } catch (error: any) {
      console.error("Error creando delivery:", error);
      showCustomAlert(
        "Error",
        error.response?.data?.error ||
          error.message ||
          "No se pudo crear el pedido de delivery. Intenta nuevamente.",
        "error",
        [{ text: "OK" }],
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#1a1a1a]">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1"
        keyboardVerticalOffset={0}
      >
        <ScrollView 
          ref={scrollRef}
          contentContainerStyle={{
            flexGrow: 1,
            paddingBottom: isKeyboardVisible ? 100 : 50,
            justifyContent: "flex-start",
          }}
          className="px-8 py-12"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets={false}
          scrollEventThrottle={16}
          nestedScrollEnabled={true}
        >
          {/* Header */}
          <View className="border-b border-gray-800 px-4 py-3 mb-4">
            <View className="flex-row items-center">
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                className="mr-3"
              >
                <ChevronLeft size={24} color="#d4af37" />
              </TouchableOpacity>
              <View className="flex-1">
                <Text className="text-xl font-bold text-white">
                  Dirección de Entrega
                </Text>
                <Text className="text-sm text-gray-400">
                  Ingresa tu dirección para delivery
                </Text>
              </View>
            </View>
          </View>

          <View className="w-full">
          {/* Mapa interactivo */}
          <View className="rounded-2xl overflow-hidden h-64 mb-4 border border-gray-800">
            <MapView
              ref={mapRef}
              provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
              style={{ flex: 1 }}
              initialRegion={region}
              onPress={handleMapPress}
              showsUserLocation
              showsMyLocationButton={false}
            >
              {/* Marcador de ubicación seleccionada */}
              <Marker
                coordinate={selectedLocation}
                title="Ubicación de entrega"
                description={address || "Selecciona tu ubicación"}
                pinColor="#d4af37"
              />

              {/* Marcador del restaurante */}
              <Marker
                coordinate={restaurantLocation}
                title={RESTAURANT_LOCATION.name}
                description="Punto de origen"
                pinColor="#ef4444"
              />
            </MapView>

            {/* Botón de ubicación actual flotante */}
            <TouchableOpacity
              onPress={getCurrentLocation}
              disabled={isLoadingLocation}
              className="absolute bottom-3 right-3 rounded-full p-3 shadow-lg"
              style={{
                backgroundColor: "rgba(212, 175, 55, 0.9)",
                elevation: 5,
              }}
            >
              {isLoadingLocation ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Crosshair size={24} color="#ffffff" />
              )}
            </TouchableOpacity>
          </View>

          {/* Instrucción */}
          <View
            className="rounded-xl p-3 mb-4 border-l-4"
            style={{
              backgroundColor: "rgba(212, 175, 55, 0.1)",
              borderLeftColor: "#d4af37",
            }}
          >
            <Text className="text-sm text-gray-300 text-center">
              📍 Toca en el mapa para seleccionar tu ubicación de entrega
            </Text>
          </View>

          {/* Formulario de dirección */}
          <View
            className="rounded-2xl p-5 mb-4"
            style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
          >
            <Text className="text-sm font-semibold text-gray-300 mb-2">
              Dirección completa *
            </Text>
            <View className="relative">
              <View
                className="flex-row items-center rounded-xl px-4 py-3 border border-gray-700"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
              >
                <Search size={20} color="#6b7280" />
                <TextInput
                  value={address}
                  onChangeText={handleAddressChange}
                  placeholder="Busca tu dirección..."
                  placeholderTextColor="#6b7280"
                  className="flex-1 text-white ml-2"
                  multiline={!showSuggestions}
                  numberOfLines={showSuggestions ? 1 : 2}
                  onFocus={() => {
                    if (predictions.length > 0) setShowSuggestions(true);
                  }}
                />
                {address.length > 0 && (
                  <TouchableOpacity
                    onPress={() => {
                      setAddress("");
                      setPredictions([]);
                      setShowSuggestions(false);
                    }}
                  >
                    <X size={20} color="#6b7280" />
                  </TouchableOpacity>
                )}
                {isSearching && (
                  <ActivityIndicator
                    size="small"
                    color="#d4af37"
                    className="ml-2"
                  />
                )}
              </View>

              {/* Dropdown de sugerencias */}
              {showSuggestions && predictions.length > 0 && (
                <View
                  className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-gray-700 overflow-hidden"
                  style={{
                    backgroundColor: "rgba(26, 26, 26, 0.98)",
                    maxHeight: 250,
                    zIndex: 1000,
                    elevation: 5,
                  }}
                >
                  <ScrollView
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={false}
                  >
                    {predictions.map(item => (
                      <TouchableOpacity
                        key={item.place_id}
                        onPress={() => selectAddress(item)}
                        className="p-4 border-b border-gray-800"
                        style={{ backgroundColor: "rgba(255, 255, 255, 0.03)" }}
                      >
                        <View className="flex-row items-start">
                          <MapPin size={16} color="#d4af37" className="mt-1" />
                          <View className="flex-1 ml-3">
                            <Text className="text-white font-semibold text-sm">
                              {item.structured_formatting.main_text}
                            </Text>
                            <Text className="text-gray-400 text-xs mt-1">
                              {item.structured_formatting.secondary_text}
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            <View>
              <Text className="text-sm font-semibold text-gray-300 mt-4 mb-2">
                Indicaciones adicionales (opcional)
              </Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Ej: Casa de esquina, portón azul, 2do piso"
                placeholderTextColor="#6b7280"
                className="rounded-xl px-4 py-3 text-white border border-gray-700"
                style={{ backgroundColor: "rgba(255, 255, 255, 0.05)" }}
                multiline
                numberOfLines={3}
              />
            </View>
          </View>

          {/* Botón para usar ubicación actual */}
          <TouchableOpacity
            onPress={getCurrentLocation}
            disabled={isLoadingLocation}
            className="rounded-xl p-4 flex-row items-center justify-center mb-6"
            style={{
              backgroundColor: isLoadingLocation
                ? "rgba(255, 255, 255, 0.05)"
                : "rgba(212, 175, 55, 0.1)",
            }}
          >
            {isLoadingLocation ? (
              <ActivityIndicator size="small" color="#d4af37" />
            ) : (
              <Navigation size={20} color="#d4af37" />
            )}
            <Text className="text-[#d4af37] font-semibold ml-2">
              Usar mi ubicación actual
            </Text>
          </TouchableOpacity>

          {/* Información */}
          <View
            className="rounded-xl p-4 mb-6 border-l-4"
            style={{
              backgroundColor: "rgba(251, 191, 36, 0.1)",
              borderLeftColor: "#fbbf24",
            }}
          >
            <Text className="text-sm text-gray-300">
              <Text className="font-semibold text-[#fbbf24]">Nota:</Text> El
              restaurante confirmará tu pedido antes de comenzar la preparación.
              Recibirás una notificación cuando sea aceptado.
            </Text>
          </View>

          {/* Botón de confirmación */}
          <TouchableOpacity
            onPress={handleConfirmLocation}
            disabled={isLoading || !address.trim()}
            className={`rounded-2xl py-4 flex-row items-center justify-center shadow-lg ${
              isLoading || !address.trim() ? "opacity-50" : ""
            }`}
            style={{ backgroundColor: "#d4af37" }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <MapPin size={20} color="white" />
                <Text className="text-white font-bold text-lg ml-2">
                  Confirmar Dirección
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CustomAlert */}
      <CustomAlert
        visible={alertVisible}
        onClose={() => setAlertVisible(false)}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
      />
      </KeyboardAvoidingView>
    </View>
  );
};

export default DeliveryLocationScreen;
