import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Calendar, Clock, Users, CheckCircle, XCircle, AlertCircle, Trash2 } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../auth/useAuth';
import CustomAlert from '../components/common/CustomAlert';
import { ReservationsService } from '../services/reservations/reservationsService';
import { Reservation } from '../types/Reservation';

const { width } = Dimensions.get('window');

interface MyReservationsScreenProps {}

export default function MyReservationsScreen({}: MyReservationsScreenProps) {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => {
    loadReservations();
  }, []);

  const loadReservations = async () => {
    try {
      setLoading(true);
      const reservations = await ReservationsService.getMyReservations();
      setReservations(reservations || []);
    } catch (error) {
      console.error('Error loading reservations:', error);
      showCustomAlert('Error', 'No se pudieron cargar las reservas');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadReservations();
    setRefreshing(false);
  };

  const handleCancelReservation = async (reservationId: string) => {
    showCustomAlert(
      'Cancelar Reserva',
      '¿Estás seguro que deseas cancelar esta reserva?',
      'warning'
    );
    
    // We'll handle the confirmation in a different way since CustomAlert doesn't support buttons
    // For now, let's create a separate confirmation function
  };

  const confirmCancelReservation = async (reservationId: string) => {
    try {
      await ReservationsService.cancelReservation(reservationId);
      showCustomAlert('Éxito', 'Reserva cancelada correctamente', 'success');
      await loadReservations(); // Recargar la lista
    } catch (error) {
      console.error('Error canceling reservation:', error);
      showCustomAlert('Error', 'No se pudo cancelar la reserva');
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          icon: <AlertCircle size={16} color="#f59e0b" />,
          label: 'Pendiente',
          color: '#f59e0b',
          bgColor: 'rgba(245, 158, 11, 0.1)',
        };
      case 'approved':
        return {
          icon: <CheckCircle size={16} color="#10b981" />,
          label: 'Aprobada',
          color: '#10b981',
          bgColor: 'rgba(16, 185, 129, 0.1)',
        };
      case 'rejected':
        return {
          icon: <XCircle size={16} color="#ef4444" />,
          label: 'Rechazada',
          color: '#ef4444',
          bgColor: 'rgba(239, 68, 68, 0.1)',
        };
      default:
        return {
          icon: <AlertCircle size={16} color="#6b7280" />,
          label: 'Desconocido',
          color: '#6b7280',
          bgColor: 'rgba(107, 114, 128, 0.1)',
        };
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string) => {
    return timeString.slice(0, 5); // HH:MM format
  };

  const isReservationCancellable = (reservation: Reservation) => {
    const reservationDateTime = new Date(`${reservation.date}T${reservation.time}`);
    const now = new Date();
    const hoursUntilReservation = (reservationDateTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    // Solo se puede cancelar si está pendiente o aprobada, y faltan más de 2 horas
    return (reservation.status === 'pending' || reservation.status === 'approved') && hoursUntilReservation > 2;
  };

  const groupReservationsByStatus = (reservations: Reservation[]) => {
    const pending = reservations.filter(r => r.status === 'pending');
    const approved = reservations.filter(r => r.status === 'approved');
    const rejected = reservations.filter(r => r.status === 'rejected');
    
    return { pending, approved, rejected };
  };

  const renderReservationCard = (reservation: Reservation) => {
    const statusInfo = getStatusInfo(reservation.status);
    const canCancel = isReservationCancellable(reservation);

    return (
      <View
        key={reservation.id}
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
        }}
      >
        {/* Status Badge */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: statusInfo.bgColor,
            borderRadius: 8,
            paddingHorizontal: 8,
            paddingVertical: 4,
            alignSelf: 'flex-start',
            marginBottom: 12,
          }}
        >
          {statusInfo.icon}
          <Text
            style={{
              color: statusInfo.color,
              fontSize: 12,
              fontWeight: '600',
              marginLeft: 4,
            }}
          >
            {statusInfo.label}
          </Text>
        </View>

        {/* Reservation Details */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Calendar size={16} color="#d4af37" />
          <Text style={{ color: 'white', fontSize: 16, fontWeight: '600', marginLeft: 8 }}>
            {formatDate(reservation.date)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          <Clock size={16} color="#d4af37" />
          <Text style={{ color: '#9ca3af', fontSize: 14, marginLeft: 8 }}>
            {formatTime(reservation.time)}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <Users size={16} color="#d4af37" />
          <Text style={{ color: '#9ca3af', fontSize: 14, marginLeft: 8 }}>
            {reservation.party_size}{' '}{reservation.party_size === 1 ? 'persona' : 'personas'}
          </Text>
        </View>

        {/* Table Info (if approved) */}
        {reservation.status === 'approved' && reservation.table && (
          <View
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#10b981', fontSize: 14, fontWeight: '600' }}>
              Mesa #{reservation.table.number} asignada
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
              Capacidad: {reservation.table.capacity} personas
            </Text>
          </View>
        )}

        {/* Rejection Reason (if rejected) */}
        {reservation.status === 'rejected' && reservation.rejection_reason && (
          <View
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>
              Razón del rechazo:
            </Text>
            <Text style={{ color: '#9ca3af', fontSize: 12, marginTop: 2 }}>
              {reservation.rejection_reason}
            </Text>
          </View>
        )}

        {/* Notes */}
        {reservation.notes && (
          <View style={{ marginBottom: 12 }}>
            <Text style={{ color: '#9ca3af', fontSize: 12 }}>
              Notas: {reservation.notes}
            </Text>
          </View>
        )}

        {/* Actions */}
        {canCancel && (
          <TouchableOpacity
            onPress={() => confirmCancelReservation(reservation.id)}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              borderRadius: 8,
              padding: 12,
              borderWidth: 1,
              borderColor: 'rgba(239, 68, 68, 0.3)',
            }}
          >
            <Trash2 size={16} color="#ef4444" />
            <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600', marginLeft: 8 }}>
              Cancelar Reserva
            </Text>
          </TouchableOpacity>
        )}

        {reservation.status === 'pending' && !canCancel && (
          <View
            style={{
              backgroundColor: 'rgba(107, 114, 128, 0.1)',
              borderRadius: 8,
              padding: 12,
            }}
          >
            <Text style={{ color: '#9ca3af', fontSize: 12, textAlign: 'center' }}>
              No se puede cancelar (menos de 2 horas para la reserva)
            </Text>
          </View>
        )}
      </View>
    );
  };

  const { pending, approved, rejected } = groupReservationsByStatus(reservations);

  return (
    <LinearGradient colors={['#1a1a1a', '#2d1810', '#1a1a1a']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.1)',
          }}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 16 }}>
            <ArrowLeft size={24} color="white" />
          </TouchableOpacity>
          <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', flex: 1 }}>
            Mis Reservas
          </Text>
        </View>

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 20 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {loading ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Text style={{ color: '#9ca3af', fontSize: 16 }}>Cargando reservas...</Text>
            </View>
          ) : reservations.length === 0 ? (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Calendar size={64} color="#6b7280" />
              <Text style={{ color: 'white', fontSize: 18, fontWeight: '600', marginTop: 16 }}>
                Sin reservas
              </Text>
              <Text style={{ color: '#9ca3af', fontSize: 14, marginTop: 8, textAlign: 'center' }}>
                No tienes reservas registradas.{'\n'}¡Haz tu primera reserva!
              </Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('MakeReservation' as never)}
                style={{
                  backgroundColor: '#d4af37',
                  borderRadius: 12,
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  marginTop: 20,
                }}
              >
                <Text style={{ color: 'black', fontSize: 16, fontWeight: '600' }}>
                  Hacer Reserva
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Pending Reservations */}
              {pending.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      color: '#f59e0b',
                      fontSize: 18,
                      fontWeight: '600',
                      marginBottom: 12,
                    }}
                  >
                    Pendientes ({pending.length})
                  </Text>
                  {pending.map(renderReservationCard)}
                </View>
              )}

              {/* Approved Reservations */}
              {approved.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      color: '#10b981',
                      fontSize: 18,
                      fontWeight: '600',
                      marginBottom: 12,
                    }}
                  >
                    Aprobadas ({approved.length})
                  </Text>
                  {approved.map(renderReservationCard)}
                </View>
              )}

              {/* Rejected Reservations */}
              {rejected.length > 0 && (
                <View style={{ marginBottom: 24 }}>
                  <Text
                    style={{
                      color: '#ef4444',
                      fontSize: 18,
                      fontWeight: '600',
                      marginBottom: 12,
                    }}
                  >
                    Rechazadas ({rejected.length})
                  </Text>
                  {rejected.map(renderReservationCard)}
                </View>
              )}
            </>
          )}
        </ScrollView>

        {/* Floating Action Button */}
        {reservations.length > 0 && (
          <TouchableOpacity
            onPress={() => navigation.navigate('MakeReservation' as never)}
            style={{
              position: 'absolute',
              bottom: 20,
              right: 20,
              backgroundColor: '#d4af37',
              borderRadius: 30,
              width: 60,
              height: 60,
              alignItems: 'center',
              justifyContent: 'center',
              elevation: 5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
            }}
          >
            <Calendar size={24} color="black" />
          </TouchableOpacity>
        )}

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
    </LinearGradient>
  );
}