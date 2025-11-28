import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle, 
  XCircle,
  AlertCircle,
  MessageSquare
} from "lucide-react-native";
import { useAuth } from "../../auth/useAuth";
import CustomAlert from "../../components/common/CustomAlert";
import type { RootStackNavigationProp } from "../../navigation/RootStackParamList";
import { ReservationsService } from "../../services/reservations/reservationsService";
import type { Reservation } from "../../types/Reservation";
import { formatDateLong, formatTime } from "../../utils/dateUtils";

interface ManageReservationsScreenProps {
  navigation: RootStackNavigationProp;
}

export default function ManageReservationsScreen({ navigation }: ManageReservationsScreenProps) {
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

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

  const loadReservations = async () => {
    try {
      setLoading(true);
      // TODO: Crear método getAllReservations en el servicio
      const allReservations = await ReservationsService.getAllReservations();
      setReservations(allReservations);
    } catch (error: any) {
      console.error("Error loading reservations:", error);
      showCustomAlert("Error", "No se pudieron cargar las reservas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReservations();
  };

  const handleApproveReservation = async (reservationId: string) => {
    // Mostrar alerta de confirmación con botón de cancelar
    setAlertTitle("Aprobar Reserva");
    setAlertMessage("¿Estás seguro de que quieres aprobar esta reserva?");
    setAlertType("warning");
    setAlertOnClose(() => async () => {
      try {
        await ReservationsService.updateReservationStatus(reservationId, 'approved');
        // Mostrar mensaje de éxito
        setAlertTitle("Éxito");
        setAlertMessage("Reserva aprobada exitosamente");
        setAlertType("success");
        setAlertOnClose(() => () => {
          setShowAlert(false);
          loadReservations();
        });
        setShowAlert(true);
      } catch (error: any) {
        setAlertTitle("Error");
        setAlertMessage(error.message || "Error al aprobar la reserva");
        setAlertType("error");
        setAlertOnClose(undefined);
        setShowAlert(true);
      }
    });
    setShowAlert(true);
  };

  const handleRejectReservation = async (reservationId: string) => {
    // Mostrar alerta de confirmación con botón de cancelar
    setAlertTitle("Rechazar Reserva");
    setAlertMessage("¿Estás seguro de que quieres rechazar esta reserva?");
    setAlertType("warning");
    setAlertOnClose(() => async () => {
      try {
        await ReservationsService.updateReservationStatus(reservationId, 'rejected', "Reserva rechazada por el restaurante");
        // Mostrar mensaje de éxito
        setAlertTitle("Reserva Rechazada");
        setAlertMessage("La reserva ha sido rechazada y el cliente será notificado");
        setAlertType("success");
        setAlertOnClose(() => () => {
          setShowAlert(false);
          loadReservations();
        });
        setShowAlert(true);
      } catch (error: any) {
        setAlertTitle("Error");
        setAlertMessage(error.message || "Error al rechazar la reserva");
        setAlertType("error");
        setAlertOnClose(undefined);
        setShowAlert(true);
      }
    });
    setShowAlert(true);
  };

  const filteredReservations = reservations.filter(reservation => {
    if (filter === 'all') return true;
    return reservation.status === filter;
  });

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'pending': return 'rgba(245, 158, 11, 0.2)';
      case 'approved': return 'rgba(16, 185, 129, 0.2)';
      case 'rejected': return 'rgba(239, 68, 68, 0.2)';
      case 'cancelled': return 'rgba(107, 114, 128, 0.2)';
      default: return 'rgba(107, 114, 128, 0.2)';
    }
  };

  const getStatusTextColor = (status: string) => {
    switch (status) {
      case 'pending': return '#fbbf24';
      case 'approved': return '#10b981';
      case 'rejected': return '#ef4444';
      case 'cancelled': return '#9ca3af';
      default: return '#9ca3af';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pendiente';
      case 'approved': return 'Aprobada';
      case 'rejected': return 'Rechazada';
      case 'cancelled': return 'Cancelada';
      case 'completed': return 'Completada';
      default: return status;
    }
  };

  // Funciones de formateo importadas desde dateUtils

  if (loading) {
    return (
      <LinearGradient colors={['#1a1a1a', '#2d1810', '#1a1a1a']} style={{ flex: 1 }}>
        <SafeAreaView style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <ArrowLeft size={24} color="white" />
            </TouchableOpacity>
            <Text style={{ marginLeft: 16, fontSize: 20, fontWeight: 'bold', color: 'white' }}>
              Gestionar Reservas
            </Text>
          </View>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: '#9ca3af', fontSize: 16 }}>Cargando reservas...</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#1a1a1a', '#2d1810', '#1a1a1a']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ marginLeft: 16, fontSize: 20, fontWeight: 'bold', color: 'white' }}>
            Gestionar Reservas
          </Text>
        </View>

        {/* Filtros */}
        <View style={{ flexDirection: 'row', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.1)' }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {[
              { key: 'pending', label: 'Pendientes', count: reservations.filter(r => r.status === 'pending').length },
              { key: 'approved', label: 'Aprobadas', count: reservations.filter(r => r.status === 'approved').length },
              { key: 'rejected', label: 'Rechazadas', count: reservations.filter(r => r.status === 'rejected').length },
              { key: 'all', label: 'Todas', count: reservations.length }
            ].map((filterOption) => (
              <TouchableOpacity
                key={filterOption.key}
                onPress={() => setFilter(filterOption.key as any)}
                style={{
                  marginRight: 12,
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: filter === filterOption.key ? '#d4af37' : 'rgba(255, 255, 255, 0.2)',
                  backgroundColor: filter === filterOption.key ? '#d4af37' : 'rgba(255, 255, 255, 0.05)',
                }}
              >
                <Text style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: filter === filterOption.key ? '#000' : '#fff',
                }}>
                  {filterOption.label} ({filterOption.count})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

      {/* Lista de Reservas */}
      <ScrollView 
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={{ padding: 16 }}>
          {filteredReservations.length === 0 ? (
            <View style={{ paddingVertical: 48, alignItems: 'center' }}>
              <AlertCircle size={56} color="#6b7280" />
              <Text style={{ marginTop: 16, fontSize: 18, fontWeight: '600', color: '#9ca3af' }}>
                No hay reservas{filter !== 'all' ? ` ${getStatusText(filter).toLowerCase()}s` : ''}
              </Text>
            </View>
          ) : (
            filteredReservations.map((reservation) => (
              <View 
                key={reservation.id} 
                style={{
                  marginBottom: 16,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                  padding: 16,
                }}
              >
                {/* Header de la reserva */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <View style={{ 
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: getStatusBgColor(reservation.status),
                    marginRight: 12,
                  }}>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: getStatusTextColor(reservation.status) }}>
                      {getStatusText(reservation.status)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 19, fontWeight: '700', color: 'white' }}>
                      {reservation.user?.first_name}{' '}{reservation.user?.last_name}
                    </Text>
                    <Text style={{ fontSize: 14, color: '#9ca3af', marginTop: 2 }}>
                      {reservation.user?.email}
                    </Text>
                  </View>
                </View>

                {/* Detalles de la reserva */}
                <View style={{ gap: 10 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Calendar size={18} color="#d4af37" />
                    <Text style={{ marginLeft: 10, fontSize: 16, color: 'white', fontWeight: '500' }}>
                      {formatDateLong(reservation.date)}
                    </Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={18} color="#d4af37" />
                    <Text style={{ marginLeft: 10, fontSize: 16, color: '#d1d5db' }}>
                      {formatTime(reservation.time)}
                    </Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Users size={18} color="#d4af37" />
                    <Text style={{ marginLeft: 10, fontSize: 16, color: '#d1d5db' }}>
                      {reservation.party_size}{' '}persona{reservation.party_size !== 1 ? 's' : ''}
                    </Text>
                  </View>

                  {reservation.table && (
                    <View style={{ 
                      backgroundColor: 'rgba(212, 175, 55, 0.1)',
                      borderRadius: 8,
                      padding: 12,
                      marginTop: 4,
                    }}>
                      <Text style={{ fontSize: 16, color: '#d4af37', fontWeight: '700', marginBottom: 4 }}>
                        Mesa {reservation.table.number}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <Text style={{ fontSize: 14, color: '#d4af37' }}>
                          Tipo: {reservation.table.type || 'N/A'}
                        </Text>
                      </View>
                    </View>
                  )}

                  {reservation.notes && (
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>
                      <MessageSquare size={18} color="#9ca3af" />
                      <Text style={{ marginLeft: 10, fontSize: 14, color: '#9ca3af', flex: 1 }}>
                        {reservation.notes}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Acciones */}
                {reservation.status === 'pending' && (
                  <View style={{ flexDirection: 'row', marginTop: 16, gap: 12 }}>
                    <TouchableOpacity
                      onPress={() => handleApproveReservation(reservation.id)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: '#10b981',
                        borderRadius: 10,
                      }}
                    >
                      <CheckCircle size={18} color="white" />
                      <Text style={{ marginLeft: 8, color: 'white', fontWeight: '700', fontSize: 15 }}>Aprobar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      onPress={() => handleRejectReservation(reservation.id)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        paddingVertical: 12,
                        paddingHorizontal: 16,
                        backgroundColor: '#ef4444',
                        borderRadius: 10,
                      }}
                    >
                      <XCircle size={18} color="white" />
                      <Text style={{ marginLeft: 8, color: 'white', fontWeight: '700', fontSize: 15 }}>Rechazar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {reservation.status === 'rejected' && reservation.rejection_reason && (
                  <View style={{
                    marginTop: 12,
                    padding: 12,
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                  }}>
                    <Text style={{ fontSize: 14, color: '#ef4444' }}>
                      <Text style={{ fontWeight: '700' }}>Razón del rechazo:{' '}</Text>
                      {reservation.rejection_reason}
                    </Text>
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* CustomAlert único para mensajes y confirmaciones */}
      <CustomAlert
        visible={showAlert}
        title={alertTitle}
        message={alertMessage}
        type={alertType}
        onClose={() => {
          setShowAlert(false);
        }}
        buttons={
          alertType === "warning" && alertOnClose
            ? [
                {
                  text: "Cancelar",
                  style: "cancel",
                  onPress: () => setShowAlert(false)
                },
                {
                  text: "Confirmar",
                  style: "default",
                  onPress: alertOnClose
                }
              ]
            : [
                {
                  text: "OK",
                  style: "default",
                  onPress: () => {
                    setShowAlert(false);
                    if (alertOnClose) {
                      alertOnClose();
                    }
                  }
                }
              ]
        }
      />
      </SafeAreaView>
    </LinearGradient>
  );
}