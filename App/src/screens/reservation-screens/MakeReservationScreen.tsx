import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, ChevronDown, Clock, ChevronLeft } from "lucide-react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../../auth/useAuth";
import CustomAlert from "../../components/common/CustomAlert";
import TableCard from "../../components/reservation/TableCard";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";
import type { CreateReservationRequest } from "../../types/Reservation";
import { ReservationsService } from "../../services/reservations/reservationsService";

interface MakeReservationScreenProps {
  navigation: RootStackNavigationProp;
}

export default function MakeReservationScreen({
  navigation,
}: MakeReservationScreenProps) {
  const { user } = useAuth();

  // Estados principales del flujo: Fecha -> Hora -> Tipo Mesa -> Capacidad -> Mesas disponibles
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTime, setSelectedTime] = useState("");
  const [tableType, setTableType] = useState<"estandar" | "vip" | "accesible">(
    "estandar",
  );
  const [partySize, setPartySize] = useState(2);
  const [notes, setNotes] = useState("");
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Estados de UI
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [timeInputFocused, setTimeInputFocused] = useState(false);

  // Estados para mesas disponibles
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestedTimes, setSuggestedTimes] = useState<string[]>([]);

  // Estados para CustomAlert
  const [showAlert, setShowAlert] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"success" | "error" | "warning">(
    "error",
  );
  const [alertOnClose, setAlertOnClose] = useState<(() => void) | undefined>(
    undefined,
  );
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as "success" | "error" | "warning" | "info",
    buttons: [] as Array<{
      text: string;
      onPress?: () => void;
      style?: "cancel" | "destructive";
    }>,
  });

  // Función para mostrar alertas customizadas
  const showCustomAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" = "error",
    onClose?: () => void,
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertOnClose(() => onClose);
    setShowAlert(true);
  };

  // Validar formato de hora (HH:MM en formato 24h)
  const isValidTimeFormat = (time: string): boolean => {
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  };

  // Validar que la hora esté en el rango de operación (19:00-02:30)
  const isTimeInOperatingHours = (time: string): boolean => {
    if (!isValidTimeFormat(time)) return false;

    const [hours, minutes] = time.split(":").map(Number);
    const timeInMinutes = (hours ?? 0) * 60 + (minutes ?? 0);

    // 19:00 a 23:59
    if (timeInMinutes >= 19 * 60 && timeInMinutes <= 23 * 60 + 59) {
      return true;
    }

    // 00:00 a 02:30
    if (timeInMinutes >= 0 && timeInMinutes <= 2 * 60 + 30) {
      return true;
    }

    return false;
  };

  const formatDateForDisplay = (date: Date) => {
    const dias = [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ];
    const meses = [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];

    const diaSemana = dias[date.getDay()];
    const dia = date.getDate();
    const mes = meses[date.getMonth()];
    const año = date.getFullYear();

    return `${diaSemana}, ${dia} de ${mes} de ${año}`;
  };

  const formatDateForAPI = (date: Date) => {
    // Formatear en zona horaria local, sin conversión a UTC
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`; // YYYY-MM-DD
  };

  // Generar lista de fechas disponibles (desde hoy, próximos 30 días)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }

    return dates;
  };

  // Buscar mesas disponibles cuando se completan fecha, hora, tipo y capacidad
  const searchAvailableTables = async () => {
    // Validaciones silenciosas (no mostrar alertas, solo no buscar)
    if (
      !selectedDate ||
      !selectedTime ||
      !isValidTimeFormat(selectedTime) ||
      !isTimeInOperatingHours(selectedTime)
    ) {
      return;
    }

    try {
      setLoadingTables(true);
      setSelectedTable(null); // Reset mesa seleccionada
      setSuggestedTimes([]); // Reset sugerencias

      const dateStr = formatDateForAPI(selectedDate);

      // Llamar al endpoint que devuelve mesas disponibles para esa fecha/hora/tipo/capacidad
      const response =
        await ReservationsService.getAvailableTablesForReservation(
          dateStr,
          selectedTime,
          tableType,
          partySize,
        );

      setAvailableTables(response.tables || response);

      // Si hay sugerencias de horarios alternativos, guardarlas
      if (response.suggestedTimes && response.suggestedTimes.length > 0) {
        setSuggestedTimes(response.suggestedTimes);
      }
    } catch (error: any) {
      console.error("Error buscando mesas:", error);
      setAvailableTables([]);
      setSuggestedTimes([]);
    } finally {
      setLoadingTables(false);
    }
  };

  // Buscar automáticamente cuando cambian los parámetros y la hora es válida
  useEffect(() => {
    if (
      selectedDate &&
      selectedTime &&
      isValidTimeFormat(selectedTime) &&
      isTimeInOperatingHours(selectedTime)
    ) {
      // Pequeño delay para evitar búsquedas mientras el usuario está escribiendo
      const timer = setTimeout(() => {
        searchAvailableTables();
      }, 500);

      return () => clearTimeout(timer);
    } else {
      // Si los parámetros no son válidos, limpiar las mesas y sugerencias
      setAvailableTables([]);
      setSelectedTable(null);
      setSuggestedTimes([]);
    }
  }, [selectedDate, selectedTime, tableType, partySize]);

  const validateStep1 = (): boolean => {
    if (!selectedDate) {
      showCustomAlert("Error", "Por favor selecciona una fecha");
      return false;
    }
    if (!selectedTime) {
      showCustomAlert("Error", "Por favor ingresa una hora");
      return false;
    }
    if (!isValidTimeFormat(selectedTime)) {
      showCustomAlert("Error", "Formato de hora inválido (usa HH:MM)");
      return false;
    }
    if (!isTimeInOperatingHours(selectedTime)) {
      showCustomAlert("Error", "La hora debe estar entre 19:00 y 02:30");
      return false;
    }

    // Validar que la reserva sea con al menos 15 minutos de anticipación
    const [hours, minutes] = selectedTime.split(":").map(Number);
    const reservationDateTime = new Date(selectedDate);
    reservationDateTime.setHours(hours ?? 0, minutes ?? 0, 0, 0);

    const now = new Date();
    const diffInMinutes =
      (reservationDateTime.getTime() - now.getTime()) / (1000 * 60);

    if (diffInMinutes < 15) {
      setAlertConfig({
        title: "Tiempo de anticipación",
        message:
          "La reserva debe ser con al menos 15 minutos de anticipación. Por favor selecciona otro horario.",
        type: "info",
        buttons: [
          {
            text: "Entendido",
            onPress: () => setShowAlert(false),
          },
        ],
      });
      setShowAlert(true);
      return false;
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleConfirmReservation = () => {
    if (!selectedTable) {
      showCustomAlert("Error", "Por favor selecciona una mesa disponible");
      return;
    }

    // Mostrar alert de confirmación con los detalles
    const tableTypeLabel =
      tableType === "estandar"
        ? "Estándar"
        : tableType === "vip"
          ? "VIP"
          : "Accesible";

    // Solo usar setAlertConfig con botones personalizados
    setAlertConfig({
      title: "Confirmar Reserva",
      message:
        `Por favor confirma los detalles de tu reserva:\n\n` +
        `📅 Fecha: ${formatDateForDisplay(selectedDate)}\n` +
        `🕐 Hora: ${selectedTime}\n` +
        `🪑 Tipo de mesa: ${tableTypeLabel}\n` +
        `👥 Cantidad de personas: ${partySize}\n` +
        `🏷️ Mesa: ${selectedTable.number}`,
      type: "warning",
      buttons: [
        {
          text: "Cancelar",
          style: "cancel",
          onPress: () => setShowAlert(false),
        },
        {
          text: "Reservar",
          onPress: () => {
            setShowAlert(false);
            // Pequeño delay para asegurar que el alert anterior se cierre completamente
            setTimeout(() => {
              handleSubmit();
            }, 300);
          },
        },
      ],
    });
    setShowAlert(true);
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!selectedTable) {
      showCustomAlert("Error", "Por favor selecciona una mesa disponible");
      return;
    }

    if (!selectedDate || !selectedTime) {
      showCustomAlert("Error", "Por favor completa fecha y hora");
      return;
    }

    if (partySize < 1 || partySize > 12) {
      showCustomAlert("Error", "El número de personas debe estar entre 1 y 12");
      return;
    }

    const reservationData: CreateReservationRequest = {
      table_id: selectedTable.id,
      date: formatDateForAPI(selectedDate),
      time: selectedTime,
      party_size: partySize,
      notes: notes.trim() || undefined,
    };

    try {
      setLoading(true);

      await ReservationsService.createReservation(reservationData);

      // Navegar directamente a MyReservations después de crear la reserva
      navigation.navigate("MyReservations");
    } catch (error: any) {
      console.error("Error creating reservation:", error);

      // Extraer el mensaje de error correcto de Axios
      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        "No se pudo crear la reserva. Intenta nuevamente.";

      // Determinar el tipo de alerta según el mensaje de error
      const isTimeValidationError = errorMessage.includes(
        "15 minutos de anticipación",
      );

      showCustomAlert(
        isTimeValidationError ? "Tiempo insuficiente" : "Error",
        errorMessage,
        isTimeValidationError ? "warning" : "error",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral-900" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior="height"
        style={{ flex: 1 }}
        keyboardVerticalOffset={50}
      >
        <ScrollView
          className="flex-1 px-6"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="py-6">
            <View className="flex-row items-center mb-2">
              <TouchableOpacity
                onPress={() => {
                  if (currentStep === 2) {
                    // Si estamos en paso 2, volver al paso 1
                    setCurrentStep(1);
                    setSelectedTable(null);
                  } else {
                    // Si estamos en paso 1, volver al home
                    navigation.goBack();
                  }
                }}
                className="mr-3"
              >
                <ChevronLeft size={24} color="#d4af37" />
              </TouchableOpacity>
              <Text className="text-3xl font-semibold text-white">
                Reservá tu mesa
              </Text>
            </View>
            <Text className="text-sm text-gray-400 mb-6">
              {currentStep === 1
                ? "Paso 1 de 2: Selecciona fecha, hora y preferencias"
                : "Paso 2 de 2: Elige tu mesa y confirma"}
            </Text>

            {currentStep === 1 ? (
              <>
                {/* PASO 1: Fecha, Hora, Tipo y Capacidad */}
                {/* Fecha de la reserva */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <Text className="text-base font-semibold text-gray-200">
                      Fecha de la reserva
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(!showDatePicker)}
                    className="flex-row items-center p-4 border border-golden/30 rounded-lg bg-neutral-800"
                  >
                    <Calendar size={20} color="#D4AF37" />
                    <Text
                      className="ml-3 text-gray-200 flex-1"
                      numberOfLines={2}
                      style={{ flexShrink: 1 }}
                    >
                      {formatDateForDisplay(selectedDate)}
                    </Text>
                    <ChevronDown size={20} color="#D4AF37" />
                  </TouchableOpacity>

                  {/* Date Picker Dropdown */}
                  {showDatePicker && (
                    <View
                      className="mt-2 border border-golden/30 rounded-lg bg-neutral-800"
                      style={{ maxHeight: 200 }}
                    >
                      <ScrollView
                        style={{ maxHeight: 200 }}
                        showsVerticalScrollIndicator={true}
                        nestedScrollEnabled={true}
                      >
                        {getAvailableDates().map((date, index) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => {
                              setSelectedDate(date);
                              setShowDatePicker(false);
                              setAvailableTables([]);
                              setSelectedTable(null);
                            }}
                            style={{
                              padding: 12,
                              borderBottomWidth:
                                index < getAvailableDates().length - 1 ? 1 : 0,
                              borderBottomColor: "rgba(212, 175, 55, 0.2)",
                              backgroundColor:
                                formatDateForAPI(date) ===
                                formatDateForAPI(selectedDate)
                                  ? "rgba(212, 175, 55, 0.2)"
                                  : "transparent",
                            }}
                          >
                            <Text
                              style={{
                                color:
                                  formatDateForAPI(date) ===
                                  formatDateForAPI(selectedDate)
                                    ? "#D4AF37"
                                    : "#E5E7EB",
                                fontWeight:
                                  formatDateForAPI(date) ===
                                  formatDateForAPI(selectedDate)
                                    ? "600"
                                    : "normal",
                              }}
                            >
                              {formatDateForDisplay(date)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Hora de la reserva */}
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <Text className="text-base font-semibold text-gray-200">
                      Hora de la reserva
                    </Text>
                  </View>
                  <View className="flex-row items-center p-4 border border-golden/30 rounded-lg bg-neutral-800">
                    <Clock size={22} color="#D4AF37" />
                    <TextInput
                      placeholder="Ej: 20:30 o 01:45"
                      placeholderTextColor="#6B7280"
                      value={selectedTime}
                      onChangeText={text => {
                        setSelectedTime(text);
                        setAvailableTables([]);
                        setSelectedTable(null);
                      }}
                      onFocus={() => setTimeInputFocused(true)}
                      onBlur={() => setTimeInputFocused(false)}
                      className="ml-3 text-gray-200 flex-1 text-base"
                      keyboardType="numbers-and-punctuation"
                      maxLength={5}
                    />
                  </View>
                  <Text className="text-sm text-gray-500 mt-1">
                    Horario de atención: 19:00 a 02:30
                  </Text>
                  {selectedTime &&
                    isValidTimeFormat(selectedTime) &&
                    isTimeInOperatingHours(selectedTime) && (
                      <Text className="text-sm text-green-500 mt-1">
                        ✓ Hora válida
                      </Text>
                    )}
                  {selectedTime &&
                    isValidTimeFormat(selectedTime) &&
                    !isTimeInOperatingHours(selectedTime) && (
                      <Text className="text-sm text-red-500 mt-1">
                        ✗ La hora debe estar entre 19:00 y 02:30
                      </Text>
                    )}
                  {selectedTime && !isValidTimeFormat(selectedTime) && (
                    <Text className="text-sm text-red-500 mt-1">
                      ✗ Formato inválido (usa HH:MM)
                    </Text>
                  )}
                </View>

                {/* Tipo de mesa y Número de personas en la misma fila */}
                <View className="flex-row gap-3 mb-6">
                  {/* Tipo de mesa */}
                  <View className="flex-1">
                    <View className="flex-row items-center mb-3">
                      <Text className="text-base font-semibold text-gray-200">
                        Tipo de mesa
                      </Text>
                    </View>
                    <View className="border border-golden/30 rounded-lg bg-neutral-800">
                      <Picker
                        selectedValue={tableType}
                        onValueChange={value => {
                          setTableType(
                            value as "estandar" | "vip" | "accesible",
                          );
                          setAvailableTables([]);
                          setSelectedTable(null);
                        }}
                        style={{ height: 50, color: "#E5E7EB" }}
                      >
                        <Picker.Item label="Estándar" value="estandar" />
                        <Picker.Item label="VIP" value="vip" />
                        <Picker.Item label="Accesible" value="accesible" />
                      </Picker>
                    </View>
                  </View>

                  {/* Número de personas */}
                  <View className="flex-1">
                    <View className="flex-row items-center mb-3">
                      <Text className="text-base font-semibold text-gray-200">
                        Personas
                      </Text>
                    </View>
                    <View className="border border-golden/30 rounded-lg bg-neutral-800">
                      <Picker
                        selectedValue={partySize}
                        onValueChange={value => {
                          setPartySize(value);
                          setAvailableTables([]);
                          setSelectedTable(null);
                        }}
                        style={{ height: 50, color: "#E5E7EB" }}
                      >
                        {[...Array(12)].map((_, i) => (
                          <Picker.Item
                            key={i + 1}
                            label={`${i + 1}`}
                            value={i + 1}
                          />
                        ))}
                      </Picker>
                    </View>
                  </View>
                </View>

                {/* Botón Siguiente */}
                <TouchableOpacity
                  onPress={handleNextStep}
                  style={{
                    backgroundColor: "#D4AF37",
                    paddingVertical: 16,
                    borderRadius: 8,
                    marginBottom: 24,
                    shadowColor: "#D4AF37",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 5,
                  }}
                >
                  <Text className="text-center font-bold text-base text-neutral-900">
                    Siguiente
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* PASO 2: Selección de Mesa y Confirmación */}

                {/* Mesas disponibles */}
                {loadingTables ? (
                  <View className="p-6 bg-neutral-800 rounded-lg border border-golden/30 mb-6">
                    <Text className="text-gray-400 text-center text-base">
                      Buscando mesas disponibles...
                    </Text>
                  </View>
                ) : availableTables.length > 0 ? (
                  <View className="mb-6">
                    <View className="flex-row items-center mb-4">
                      <Text className="text-base font-semibold text-gray-200">
                        Seleccioná tu mesa ({availableTables.length} disponible
                        {availableTables.length !== 1 ? "s" : ""})
                      </Text>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                    >
                      <View className="flex-row gap-4">
                        {availableTables.map(table => (
                          <TableCard
                            key={table.id}
                            table={table}
                            isSelected={selectedTable?.id === table.id}
                            onSelect={() => setSelectedTable(table)}
                          />
                        ))}
                      </View>
                    </ScrollView>
                  </View>
                ) : (
                  <View className="p-6 bg-neutral-800 rounded-lg border border-golden/30 mb-6">
                    <Text className="text-gray-400 text-center text-base">
                      No hay mesas disponibles para estos parámetros
                    </Text>
                  </View>
                )}

                {/* Sugerencias de horarios alternativos */}
                {suggestedTimes.length > 0 &&
                  availableTables.length === 0 &&
                  !loadingTables && (
                    <View className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                      <Text className="text-blue-400 font-semibold mb-2 text-base">
                        💡 Horarios alternativos disponibles
                      </Text>
                      <Text className="text-gray-300 text-base mb-3">
                        No hay mesas disponibles a las {selectedTime}, pero hay
                        disponibilidad en estos horarios:
                      </Text>
                      <View className="flex-row flex-wrap gap-2">
                        {suggestedTimes.map((time, index) => (
                          <TouchableOpacity
                            key={index}
                            onPress={() => {
                              setSelectedTime(time);
                              setSuggestedTimes([]);
                              setCurrentStep(1);
                            }}
                            className="bg-blue-500/20 border border-blue-500/40 rounded-lg px-4 py-2"
                          >
                            <Text className="text-blue-300 font-medium text-base">
                              {time}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  )}

                {/* Notas adicionales */}
                {selectedTable && (
                  <View className="mb-6">
                    <Text className="text-base font-semibold text-gray-200 mb-3">
                      Notas adicionales (opcional)
                    </Text>
                    <TextInput
                      placeholder="Ej: Celebración de cumpleaños, preferencia de ubicación..."
                      placeholderTextColor="#6B7280"
                      value={notes}
                      onChangeText={setNotes}
                      multiline
                      numberOfLines={3}
                      maxLength={200}
                      className="p-4 border border-golden/30 rounded-lg bg-neutral-800 text-gray-200 text-base"
                      textAlignVertical="top"
                    />
                    <Text className="text-sm text-gray-500 mt-1">
                      {notes.length}/200 caracteres
                    </Text>
                  </View>
                )}

                {/* Botón de confirmar reserva */}
                {selectedTable && (
                  <TouchableOpacity
                    onPress={handleConfirmReservation}
                    disabled={loading}
                    style={{
                      backgroundColor: loading ? "#404040" : "#D4AF37",
                      paddingVertical: 16,
                      borderRadius: 8,
                      marginBottom: 24,
                      shadowColor: "#D4AF37",
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: loading ? 0 : 0.3,
                      shadowRadius: 8,
                      elevation: loading ? 0 : 5,
                    }}
                  >
                    <Text
                      className={`text-center font-bold text-base ${
                        loading ? "text-gray-500" : "text-neutral-900"
                      }`}
                    >
                      {loading ? "Enviando..." : "Confirmar Reserva"}
                    </Text>
                  </TouchableOpacity>
                )}

                {/* Información adicional */}
                {selectedTable && (
                  <View
                    style={{
                      marginTop: 8,
                      padding: 16,
                      backgroundColor: "rgba(212, 175, 55, 0.1)",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "rgba(212, 175, 55, 0.3)",
                    }}
                  >
                    <Text className="text-base text-white font-semibold mb-2">
                      💡 Información importante:
                    </Text>
                    <Text className="text-base text-gray-300 leading-6">
                      • Las reservas deben ser aprobadas por el restaurante
                      {"\n"}• Te notificaremos por email cuando sea confirmada
                      {"\n"}• Horario: 19:00 a 03:00 (última reserva 02:30)
                      {"\n"}• Las mesas se bloquean 45 min antes y después de tu
                      horario
                    </Text>
                  </View>
                )}
              </>
            )}
          </View>
        </ScrollView>

        {/* CustomAlert */}
        <CustomAlert
          visible={showAlert}
          title={alertConfig.title || alertTitle}
          message={alertConfig.message || alertMessage}
          type={alertConfig.type || alertType}
          buttons={
            alertConfig.buttons.length > 0 ? alertConfig.buttons : undefined
          }
          onClose={() => {
            setShowAlert(false);
            if (alertOnClose) {
              alertOnClose();
            }
          }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
