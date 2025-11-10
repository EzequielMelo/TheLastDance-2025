import api from '../../api/axios';
import type { 
  CreateReservationRequest, 
  AvailableTablesResponse,
  Reservation 
} from '../../types/Reservation';

export class ReservationsService {
  /**
   * Crear una nueva reserva
   */
  static async createReservation(data: CreateReservationRequest): Promise<Reservation> {
    try {
      const response = await api.post('/reservations', data);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al crear la reserva');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al crear la reserva'
      );
    }
  }

  /**
   * Obtener mis reservas
   */
  static async getMyReservations(): Promise<Reservation[]> {
    try {
      const response = await api.get('/reservations/my-reservations');
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al obtener las reservas');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching reservations:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al obtener las reservas'
      );
    }
  }

  /**
   * Obtener mesas disponibles por tipo y capacidad
   */
  static async getTablesByType(
    tableType: string,
    capacity: number
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        type: tableType,
        capacity: capacity.toString()
      });

      const response = await api.get(`/reservations/tables?${params.toString()}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al obtener las mesas');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching tables by type:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al obtener las mesas'
      );
    }
  }

  /**
   * Verificar disponibilidad de horarios para una mesa específica
   */
  static async checkTableAvailability(
    tableId: string,
    date: string
  ): Promise<AvailableTablesResponse> {
    try {
      const params = new URLSearchParams({
        table_id: tableId,
        date: date
      });

      const response = await api.get(`/reservations/table-availability?${params.toString()}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al verificar disponibilidad');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error checking table availability:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al verificar disponibilidad'
      );
    }
  }

  /**
   * Verificar disponibilidad de mesas para una fecha
   */
  static async checkAvailability(
    date: string, 
    partySize?: number
  ): Promise<AvailableTablesResponse> {
    try {
      const params = new URLSearchParams({ date });
      if (partySize) {
        params.append('party_size', partySize.toString());
      }

      const response = await api.get(`/reservations/availability?${params.toString()}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al verificar disponibilidad');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error checking availability:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al verificar disponibilidad'
      );
    }
  }

  /**
   * Cancelar una reserva
   */
  static async cancelReservation(reservationId: string): Promise<Reservation> {
    try {
      const response = await api.put(`/reservations/${reservationId}/cancel`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al cancelar la reserva');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error cancelling reservation:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al cancelar la reserva'
      );
    }
  }

  /**
   * Obtener detalles de una reserva específica
   */
  static async getReservationDetails(reservationId: string): Promise<Reservation> {
    try {
      const response = await api.get(`/reservations/${reservationId}`);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al obtener los detalles de la reserva');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching reservation details:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al obtener los detalles de la reserva'
      );
    }
  }

  /**
   * Obtener todas las reservas (solo admin)
   */
  static async getAllReservations(): Promise<Reservation[]> {
    try {
      const response = await api.get('/reservations/all');
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al obtener las reservas');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching all reservations:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al obtener las reservas'
      );
    }
  }

  /**
   * Actualizar estado de una reserva (aprobar/rechazar)
   */
  static async updateReservationStatus(
    reservationId: string, 
    status: 'approved' | 'rejected',
    rejectionReason?: string
  ): Promise<Reservation> {
    try {
      const data: any = { status };
      if (status === 'rejected' && rejectionReason) {
        data.rejection_reason = rejectionReason;
      }

      const response = await api.put(`/reservations/${reservationId}/status`, data);
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Error al actualizar la reserva');
      }
      
      return response.data.data;
    } catch (error: any) {
      console.error('Error updating reservation status:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Error al actualizar la reserva'
      );
    }
  }
}