/**
 * Utilidades para calcular distancias geográficas y tiempos estimados
 */

/**
 * Calcula la distancia entre dos puntos geográficos usando la fórmula de Haversine
 * @param lat1 Latitud del punto 1
 * @param lon1 Longitud del punto 1
 * @param lat2 Latitud del punto 2
 * @param lon2 Longitud del punto 2
 * @returns Distancia en kilómetros
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radio de la Tierra en km

  // Convertir grados a radianes
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c; // Distancia en km

  return Math.round(distance * 100) / 100; // Redondear a 2 decimales
}

/**
 * Convierte grados a radianes
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Estima el tiempo de viaje en minutos basado en la distancia
 * @param distanceKm Distancia en kilómetros
 * @param avgSpeedKmh Velocidad promedio en km/h (por defecto 30 km/h para ciudad)
 * @returns Tiempo estimado de viaje en minutos
 */
export function estimateTravelTime(
  distanceKm: number,
  avgSpeedKmh: number = 30,
): number {
  const travelTimeMinutes = (distanceKm / avgSpeedKmh) * 60;
  return Math.ceil(travelTimeMinutes); // Redondear hacia arriba
}

/**
 * Calcula el tiempo total estimado de entrega
 * @param originLat Latitud del restaurante
 * @param originLon Longitud del restaurante
 * @param destLat Latitud del destino
 * @param destLon Longitud del destino
 * @param prepTimeMinutes Tiempo de preparación en minutos
 * @param avgSpeedKmh Velocidad promedio en km/h
 * @returns Objeto con distancia (km) y tiempo total estimado (minutos)
 */
export function calculateDeliveryEstimate(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  prepTimeMinutes: number,
  avgSpeedKmh: number = 30,
): { distanceKm: number; estimatedTimeMinutes: number } {
  const distanceKm = calculateDistance(originLat, originLon, destLat, destLon);
  const travelTimeMinutes = estimateTravelTime(distanceKm, avgSpeedKmh);
  const estimatedTimeMinutes = prepTimeMinutes + travelTimeMinutes;

  return {
    distanceKm,
    estimatedTimeMinutes,
  };
}
