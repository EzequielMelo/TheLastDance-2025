import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Calendar, ArrowLeft, ChevronDown } from "lucide-react-native";
import { Picker } from "@react-native-picker/picker";
import { useAuth } from "../../auth/useAuth";
import CustomAlert from "../../components/common/CustomAlert";
import TableCard from "../../components/reservation/TableCard";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";
import type { CreateReservationRequest, AvailableTablesResponse } from "../../types/Reservation";
import { ReservationsService } from "../../services/reservations/reservationsService";

interface MakeReservationScreenProps {
  navigation: RootStackNavigationProp;
}

export default function MakeReservationScreen({ navigation }: MakeReservationScreenProps) {
  const { user } = useAuth();
  
  // Función para obtener la fecha mínima (mañana)
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };
  
  // Estados para el formulario
  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
  const [selectedTime, setSelectedTime] = useState("20:00");
  const [partySize, setPartySize] = useState(2);
  const [tableType, setTableType] = useState<"estandar" | "vip" | "accesible">("estandar");
  const [notes, setNotes] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Estados para selección de mesa
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any>(null);
  const [loadingTables, setLoadingTables] = useState(false);
  
  // Estados para disponibilidad de horarios
  const [availableSlots, setAvailableSlots] = useState<AvailableTablesResponse | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Estados para CustomAlert
  const [showAlert, setShowAlert] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [alertType, setAlertType] = useState<"success" | "error" | "warning">("error");
  const [alertOnClose, setAlertOnClose] = useState<(() => void) | undefined>(undefined);

  // Función para mostrar alertas customizadas
  const showCustomAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "warning" = "error",
    onClose?: () => void
  ) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertType(type);
    setAlertOnClose(() => onClose);
    setShowAlert(true);
  };

  // Horarios disponibles (de 12:00 a 23:00)
  const timeSlots = [
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
    "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
    "21:00", "21:30", "22:00", "22:30", "23:00"
  ];

  // Verificar que solo se puedan hacer reservas para fechas futuras
  const getMinimumDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow;
  };

  const formatDateForDisplay = (date: Date) => {
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = [
      'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
    ];
    
    const diaSemana = dias[date.getDay()];
    const dia = date.getDate();
    const mes = meses[date.getMonth()];
    const año = date.getFullYear();
    
    return `${diaSemana}, ${dia} de ${mes} de ${año}`;
  };

  const formatDateForAPI = (date: Date) => {
    return date.toISOString().split('T')[0]; // YYYY-MM-DD
  };

  // Verificar disponibilidad usando la API
  const checkAvailability = async (date: string) => {
    try {
      setLoading(true);
      console.log("Verificando disponibilidad para:", date);
      
      const availability = await ReservationsService.checkAvailability(date, partySize);
      console.log("Availability response:", JSON.stringify(availability, null, 2));
      console.log("Date requested:", date, "Party size:", partySize);
      setAvailableSlots(availability);
    } catch (error: any) {
      console.error("Error checking availability:", error);
      showCustomAlert("Error", error.message || "No se pudo verificar la disponibilidad");
    } finally {
      setLoading(false);
    }
  };

  // Cargar mesas cuando cambia el tipo o capacidad
  useEffect(() => {
    loadAvailableTables();
  }, [tableType, partySize]);

  // Cargar horarios disponibles cuando se selecciona una mesa y fecha
  useEffect(() => {
    if (selectedTable) {
      const dateStr = formatDateForAPI(selectedDate);
      checkTableAvailability(dateStr);
    }
  }, [selectedTable, selectedDate]);

  const loadAvailableTables = async () => {
    try {
      setLoadingTables(true);
      console.log("Loading tables for:", tableType, partySize);
      
      const tables = await ReservationsService.getTablesByType(tableType, partySize);
      setAvailableTables(tables);
      
      // Reset selecciones
      setSelectedTable(null);
      setSelectedTime("20:00");
      setAvailableSlots(null);
    } catch (error: any) {
      console.error("Error loading tables:", error);
      showCustomAlert("Error", error.message || "No se pudieron cargar las mesas");
    } finally {
      setLoadingTables(false);
    }
  };

  const checkTableAvailability = async (date: string) => {
    if (!selectedTable) return;
    
    try {
      setLoadingSlots(true);
      
      const availability = await ReservationsService.checkTableAvailability(selectedTable.id, date);
      setAvailableSlots(availability);
    } catch (error: any) {
      console.error("Error checking table availability:", error);
      showCustomAlert("Error", error.message || "No se pudo verificar la disponibilidad");
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
    }
  };

  // Generar lista de fechas disponibles (próximos 30 días)
  const getAvailableDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = 1; i <= 30; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };

  const handleSubmit = async () => {
    // Validaciones
    if (!selectedTable || !selectedTime) {
      showCustomAlert("Error", "Por favor selecciona una mesa y un horario disponible");
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
      
      console.log("Creando reserva:", reservationData);
      
      await ReservationsService.createReservation(reservationData);
      
      showCustomAlert(
        "Reserva Solicitada", 
        "Tu reserva ha sido enviada y está pendiente de aprobación. Te notificaremos cuando sea confirmada.",
        "success",
        () => navigation.goBack()
      );
      
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      showCustomAlert("Error", error.message || "No se pudo crear la reserva. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const isTimeAvailable = (time: string) => {
    if (!availableSlots || !availableSlots.slots) return false;
    const slot = availableSlots.slots.find(s => s.time === time);
    return slot?.available === true;
  };

  const getTableForTime = (time: string) => {
    if (!availableSlots || !availableSlots.slots) return null;
    const slot = availableSlots.slots.find(s => s.time === time);
    return slot?.available ? slot : null;
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center px-4 pt-2 pb-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#374151" />
        </TouchableOpacity>
        <Text className="ml-4 text-lg font-semibold text-gray-800">
          Reservar Mesa
        </Text>
      </View>

      <ScrollView className="flex-1 px-6">
        <View className="py-6">
          <Text className="text-lg font-semibold text-gray-800 mb-6">
            Solicita una reserva para una fecha y horario específico
          </Text>

          {/* Selección de fecha */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Fecha de la reserva
            </Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(!showDatePicker)}
              className="flex-row items-center p-4 border border-gray-300 rounded-lg bg-white"
            >
              <Calendar size={20} color="#374151" />
              <Text className="ml-3 text-gray-800 flex-1" numberOfLines={2} style={{ flexShrink: 1 }}>
                {formatDateForDisplay(selectedDate)}
              </Text>
              <ChevronDown size={20} color="#374151" />
            </TouchableOpacity>
            
            {/* Date Picker Dropdown */}
            {showDatePicker && (
              <View 
                className="mt-2 border border-gray-300 rounded-lg bg-white"
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
                        setSelectedTime("20:00"); // Reset time selection
                        setSelectedTable(null); // Reset table selection
                      }}
                      style={{
                        padding: 12,
                        borderBottomWidth: index < getAvailableDates().length - 1 ? 1 : 0,
                        borderBottomColor: '#f3f4f6',
                        backgroundColor: formatDateForAPI(date) === formatDateForAPI(selectedDate) 
                          ? '#eff6ff' : 'white'
                      }}
                    >
                      <Text style={{
                        color: formatDateForAPI(date) === formatDateForAPI(selectedDate)
                          ? '#2563eb' : '#374151',
                        fontWeight: formatDateForAPI(date) === formatDateForAPI(selectedDate)
                          ? '600' : 'normal'
                      }}>
                        {formatDateForDisplay(date)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Tipo de mesa */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Tipo de mesa
            </Text>
            <View className="border border-gray-300 rounded-lg bg-white">
              <Picker
                selectedValue={tableType}
                onValueChange={(value) => setTableType(value as "estandar" | "vip" | "accesible")}
                style={{ height: 50 }}
              >
                <Picker.Item label="Mesa Estándar" value="estandar" />
                <Picker.Item label="Mesa VIP" value="vip" />
                <Picker.Item label="Mesa Accesible" value="accesible" />
              </Picker>
            </View>
          </View>

          {/* Número de personas */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Número de personas (mínimo)
            </Text>
            <View className="border border-gray-300 rounded-lg bg-white">
              <Picker
                selectedValue={partySize}
                onValueChange={setPartySize}
                style={{ height: 50 }}
              >
                {[...Array(12)].map((_, i) => (
                  <Picker.Item
                    key={i + 1}
                    label={`${i + 1} ${i === 0 ? 'persona' : 'personas'}`}
                    value={i + 1}
                  />
                ))}
              </Picker>
            </View>
          </View>

          {/* Mesas disponibles */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Seleccionar mesa
            </Text>
            {loadingTables ? (
              <Text className="text-gray-500 text-center py-4">
                Cargando mesas disponibles...
              </Text>
            ) : availableTables.length === 0 ? (
              <Text className="text-gray-500 text-center py-4">
                No hay mesas disponibles con estas características
              </Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-4">
                  {availableTables.map((table) => (
                    <TableCard
                      key={table.id}
                      table={table}
                      isSelected={selectedTable?.id === table.id}
                      onSelect={() => {
                        setSelectedTable(table);
                        setSelectedTime("20:00");
                      }}
                    />
                  ))}
                </View>
              </ScrollView>
            )}
          </View>

            {/* Horarios disponibles */}
            {selectedTable && (
              <View className="mb-6">
                <Text className="text-sm font-medium text-gray-700 mb-2">
                  Horarios disponibles para Mesa #{selectedTable.number}
                </Text>
                {loadingSlots ? (
                <Text className="text-gray-500 text-center py-4">
                  Cargando horarios disponibles...
                </Text>
              ) : !availableSlots ? (
                <Text className="text-gray-500 text-center py-4">
                  Error al cargar disponibilidad
                </Text>
              ) : (
                <>
                  <View className="flex-row flex-wrap gap-2">
                    {timeSlots.map((time) => {
                      const available = isTimeAvailable(time);
                      const table = getTableForTime(time);
                      const isSelected = selectedTime === time && available;
                      
                      return (
                        <TouchableOpacity
                          key={time}
                          onPress={() => {
                            console.log(`Clicked time: ${time}, available: ${available}, table:`, table);
                            if (available) {
                              setSelectedTime(time);
                            }
                          }}
                          disabled={!available}
                          className={`px-4 py-2 rounded-lg border ${
                            isSelected
                              ? 'bg-blue-500 border-blue-500'
                              : available
                              ? 'bg-white border-gray-300'
                              : 'bg-gray-100 border-gray-200'
                          }`}
                        >
                          <Text className={`text-sm ${
                            isSelected
                              ? 'text-white font-medium'
                              : available
                              ? 'text-gray-700'
                              : 'text-gray-400'
                          }`}>
                            {time}
                          </Text>
                          {available && table && (
                            <Text className={`text-xs ${
                              isSelected ? 'text-blue-100' : 'text-gray-500'
                            }`}>
                              Mesa {table.table_number}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  
                  {/* Debug info */}
                  <Text className="text-xs text-gray-400 mt-2">
                    Debug: {availableSlots?.slots?.filter(s => s.available).length || 0} de {timeSlots.length} horarios disponibles
                  </Text>
                </>
              )}            {selectedTime && selectedTable && (
              <Text className="text-sm text-green-600 mt-2">
                ✓ Horario seleccionado: {selectedTime}
              </Text>
            )}
              </View>
            )}

          {/* Notas adicionales */}
          <View className="mb-6">
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Notas adicionales (opcional)
            </Text>
            <TextInput
              placeholder="Ej: Celebración de cumpleaños, preferencia de mesa..."
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              maxLength={200}
              className="p-4 border border-gray-300 rounded-lg bg-white text-gray-800"
              textAlignVertical="top"
            />
            <Text className="text-xs text-gray-500 mt-1">
              {notes.length}/200 caracteres
            </Text>
          </View>

          {/* Botón de enviar */}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading || !selectedTable || !selectedTime}
            className={`py-4 rounded-lg ${
              loading || !selectedTable || !selectedTime
                ? 'bg-gray-300'
                : 'bg-blue-500'
            }`}
          >
            <Text className={`text-center font-semibold ${
              loading || !selectedTable || !selectedTime
                ? 'text-gray-500'
                : 'text-white'
            }`}>
              {loading ? 'Enviando...' : 'Solicitar Reserva'}
            </Text>
          </TouchableOpacity>

          {/* Información adicional */}
          <View className="mt-6 p-4 bg-blue-50 rounded-lg">
            <Text className="text-sm text-blue-800 font-medium mb-2">
              Información importante:
            </Text>
            <Text className="text-sm text-blue-700">
              • Las reservas deben ser aprobadas por el restaurante{'\n'}
              • Te notificaremos por email cuando sea confirmada{'\n'}
              • Puedes hacer múltiples reservas para diferentes fechas{'\n'}
              • Las reservas solo se pueden hacer para fechas futuras
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* CustomAlert */}
      <CustomAlert
        visible={showAlert}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => {
          setShowAlert(false);
          if (alertOnClose) {
            alertOnClose();
          }
        }}
      />
    </SafeAreaView>
  );
}