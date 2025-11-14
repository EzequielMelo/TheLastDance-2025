/**
 * Utilidades para manejo de fechas
 * Estas funciones corrigen el problema de zona horaria cuando se parsean
 * fechas en formato YYYY-MM-DD desde la base de datos
 */

/**
 * Parsea una fecha en formato YYYY-MM-DD como fecha local (no UTC)
 * Evita el problema de retroceso de día por diferencia de zona horaria
 * 
 * @param dateString - Fecha en formato YYYY-MM-DD
 * @returns Objeto Date parseado como fecha local
 * 
 * @example
 * // ❌ Incorrecto (interpreta como UTC, retrocede 1 día en Argentina)
 * const date = new Date('2025-11-11'); // 2025-11-10 en Argentina (UTC-3)
 * 
 * // ✅ Correcto (interpreta como fecha local)
 * const date = parseLocalDate('2025-11-11'); // 2025-11-11 en Argentina
 */
export function parseLocalDate(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
}

/**
 * Parsea una fecha y hora en formato YYYY-MM-DD HH:MM:SS como local
 * 
 * @param dateString - Fecha en formato YYYY-MM-DD
 * @param timeString - Hora en formato HH:MM:SS o HH:MM
 * @returns Objeto Date parseado como fecha y hora local
 */
export function parseLocalDateTime(dateString: string, timeString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  const [hour, minute, second = 0] = timeString.split(':').map(Number);
  return new Date(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
    hour ?? 0,
    minute ?? 0,
    second ?? 0
  );
}

/**
 * Formatea una fecha en formato largo en español (Argentina)
 * 
 * @param dateString - Fecha en formato YYYY-MM-DD
 * @returns Fecha formateada (ej: "lunes, 11 de noviembre de 2025")
 */
export function formatDateLong(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('es-AR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Formatea una fecha en formato corto en español (Argentina)
 * 
 * @param dateString - Fecha en formato YYYY-MM-DD
 * @returns Fecha formateada (ej: "11/11/2025")
 */
export function formatDateShort(dateString: string): string {
  const date = parseLocalDate(dateString);
  return date.toLocaleDateString('es-AR');
}

/**
 * Formatea una hora en formato HH:MM
 * 
 * @param timeString - Hora en formato HH:MM:SS o HH:MM
 * @returns Hora formateada en HH:MM
 */
export function formatTime(timeString: string): string {
  return timeString.slice(0, 5); // HH:MM
}

/**
 * Calcula las horas que faltan hasta una fecha/hora específica
 * 
 * @param dateString - Fecha en formato YYYY-MM-DD
 * @param timeString - Hora en formato HH:MM:SS o HH:MM
 * @returns Horas hasta la fecha/hora (negativo si ya pasó)
 */
export function hoursUntil(dateString: string, timeString: string): number {
  const targetDateTime = parseLocalDateTime(dateString, timeString);
  const now = new Date();
  return (targetDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
}
