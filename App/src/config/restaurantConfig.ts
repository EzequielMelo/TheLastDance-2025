/**
 * Configuración centralizada de la ubicación del restaurante
 *
 * IMPORTANTE: Esta es la única ubicación donde se debe definir
 * las coordenadas del restaurante. Todos los demás archivos deben
 * importar esta configuración.
 */

export const RESTAURANT_LOCATION = {
  latitude: -34.61814191816392,
  longitude: -58.4363956049853,
  name: "The Last Dance Restaurant",
  address: "Dirección del restaurante", // Actualizar con la dirección real
};
/**
 * Configuración del mapa
 */
export const MAP_CONFIG = {
  defaultZoom: {
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  },
  trackingZoom: {
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  },
};
