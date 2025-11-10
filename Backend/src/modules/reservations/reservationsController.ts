import { Request, Response } from 'express';
import { ReservationsService } from './reservationsService';
import type {
  CreateReservationRequest,
  UpdateReservationRequest,
  AvailabilityRequest
} from './reservations.types';

export class ReservationsController {
  /**
   * Crear una nueva reserva
   * POST /api/reservations
   */
  static async createReservation(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.appUserId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      const data: CreateReservationRequest = req.body;

      // Validaciones básicas
      if (!data.table_id || !data.date || !data.time || !data.party_size) {
        res.status(400).json({
          success: false,
          error: 'Faltan campos requeridos: table_id, date, time, party_size'
        });
        return;
      }

      if (data.party_size < 1 || data.party_size > 12) {
        res.status(400).json({
          success: false,
          error: 'El número de personas debe estar entre 1 y 12'
        });
        return;
      }

      // Validar formato de fecha (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(data.date)) {
        res.status(400).json({
          success: false,
          error: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
        return;
      }

      // Validar formato de hora (HH:MM)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(data.time)) {
        res.status(400).json({
          success: false,
          error: 'Formato de hora inválido. Use HH:MM'
        });
        return;
      }

      const reservation = await ReservationsService.createReservation(userId, data);

      res.status(201).json({
        success: true,
        data: reservation,
        message: 'Reserva creada exitosamente. Está pendiente de aprobación.'
      });
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error al crear la reserva'
      });
    }
  }

  /**
   * Obtener reservas del usuario actual
   * GET /api/reservations/my-reservations
   */
  static async getUserReservations(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user?.appUserId;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      const reservations = await ReservationsService.getUserReservations(userId);

      res.status(200).json({
        success: true,
        data: reservations
      });
    } catch (error: any) {
      console.error('Error fetching user reservations:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al obtener las reservas'
      });
    }
  }

  /**
   * Obtener todas las reservas (solo admin)
   * GET /api/reservations/all
   */
  static async getAllReservations(_req: Request, res: Response): Promise<void> {
    try {
      const reservations = await ReservationsService.getAllReservations();

      res.status(200).json({
        success: true,
        data: reservations
      });
    } catch (error: any) {
      console.error('Error fetching all reservations:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al obtener las reservas'
      });
    }
  }

  /**
   * Actualizar estado de una reserva (aprobar/rechazar)
   * PUT /api/reservations/:id/status
   */
  static async updateReservationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.appUserId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de reserva requerido'
        });
        return;
      }

      const data: UpdateReservationRequest = req.body;

      // Validaciones
      if (!data.status || !['approved', 'rejected'].includes(data.status)) {
        res.status(400).json({
          success: false,
          error: 'Estado inválido. Use "approved" o "rejected"'
        });
        return;
      }

      if (data.status === 'rejected' && !data.rejection_reason) {
        res.status(400).json({
          success: false,
          error: 'La razón del rechazo es requerida'
        });
        return;
      }

      const reservation = await ReservationsService.updateReservationStatus(
        id,
        userId,
        data
      );

      res.status(200).json({
        success: true,
        data: reservation,
        message: `Reserva ${data.status === 'approved' ? 'aprobada' : 'rechazada'} exitosamente`
      });
    } catch (error: any) {
      console.error('Error updating reservation status:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error al actualizar la reserva'
      });
    }
  }

  /**
   * Cancelar una reserva (por parte del cliente)
   * PUT /api/reservations/:id/cancel
   */
  static async cancelReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user?.appUserId;
      
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Usuario no autenticado'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de reserva requerido'
        });
        return;
      }

      const reservation = await ReservationsService.cancelReservation(id, userId);

      res.status(200).json({
        success: true,
        data: reservation,
        message: 'Reserva cancelada exitosamente'
      });
    } catch (error: any) {
      console.error('Error cancelling reservation:', error);
      res.status(400).json({
        success: false,
        error: error.message || 'Error al cancelar la reserva'
      });
    }
  }

  /**
   * Obtener mesas disponibles por tipo y capacidad
   * GET /api/reservations/tables?type=TYPE&capacity=N
   */
  static async getTablesByType(req: Request, res: Response): Promise<void> {
    try {
      const { type, capacity } = req.query;

      if (!type || !capacity) {
        res.status(400).json({
          success: false,
          error: 'Parámetros requeridos: type, capacity'
        });
        return;
      }

      const tableType = type as string;
      const minCapacity = parseInt(capacity as string);

      if (!['estandar', 'vip', 'accesible'].includes(tableType)) {
        res.status(400).json({
          success: false,
          error: 'Tipo de mesa inválido. Use: estandar, vip, accesible'
        });
        return;
      }

      if (isNaN(minCapacity) || minCapacity < 1) {
        res.status(400).json({
          success: false,
          error: 'Capacidad debe ser un número mayor a 0'
        });
        return;
      }

      const tables = await ReservationsService.getAvailableTablesByType(tableType, minCapacity);

      res.status(200).json({
        success: true,
        data: tables
      });
    } catch (error: any) {
      console.error('Error fetching tables by type:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al obtener las mesas'
      });
    }
  }

  /**
   * Verificar disponibilidad de horarios para una mesa específica
   * GET /api/reservations/table-availability?table_id=ID&date=YYYY-MM-DD
   */
  static async checkTableAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { table_id, date } = req.query;

      if (!table_id || !date) {
        res.status(400).json({
          success: false,
          error: 'Parámetros requeridos: table_id, date'
        });
        return;
      }

      // Validar formato de fecha
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date as string)) {
        res.status(400).json({
          success: false,
          error: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
        return;
      }

      const availability = await ReservationsService.checkTableAvailability(
        table_id as string,
        date as string
      );

      res.status(200).json({
        success: true,
        data: availability
      });
    } catch (error: any) {
      console.error('Error checking table availability:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al verificar disponibilidad de la mesa'
      });
    }
  }

  /**
   * Verificar disponibilidad de mesas
   * GET /api/reservations/availability?date=YYYY-MM-DD&party_size=N
   */
  static async checkAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { date, party_size } = req.query;

      if (!date || typeof date !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Parámetro date es requerido (YYYY-MM-DD)'
        });
        return;
      }

      // Validar formato de fecha
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        res.status(400).json({
          success: false,
          error: 'Formato de fecha inválido. Use YYYY-MM-DD'
        });
        return;
      }

      const availabilityRequest: AvailabilityRequest = {
        date
      };

      if (party_size) {
        availabilityRequest.party_size = parseInt(party_size as string);
      }

      const availability = await ReservationsService.checkAvailability(availabilityRequest);

      res.status(200).json({
        success: true,
        data: availability
      });
    } catch (error: any) {
      console.error('Error checking availability:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al verificar disponibilidad'
      });
    }
  }

  /**
   * Verificar si una mesa está reservada (para maitre)
   * GET /api/reservations/check-table-reserved?table_id=X&date=YYYY-MM-DD&time=HH:MM
   */
  static async checkTableReserved(req: Request, res: Response): Promise<void> {
    try {
      const { table_id, date, time } = req.query;

      if (!table_id || !date || !time) {
        res.status(400).json({
          success: false,
          error: 'Parámetros requeridos: table_id, date, time'
        });
        return;
      }

      const isReserved = await ReservationsService.isTableReserved(
        table_id as string,
        date as string,
        time as string
      );

      res.status(200).json({
        success: true,
        data: {
          table_id,
          date,
          time,
          is_reserved: isReserved
        }
      });
    } catch (error: any) {
      console.error('Error checking table reservation:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al verificar reserva de mesa'
      });
    }
  }

  /**
   * Obtener detalles de una reserva específica
   * GET /api/reservations/:id
   */
  static async getReservationDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'ID de reserva requerido'
        });
        return;
      }

      const reservation = await ReservationsService.getReservationById(id);

      if (!reservation) {
        res.status(404).json({
          success: false,
          error: 'Reserva no encontrada'
        });
        return;
      }

      // Verificar permisos: solo el dueño de la reserva o admin pueden ver los detalles
      const userId = req.user?.appUserId;
      const userProfile = req.user?.profile_code;
      
      if (
        reservation.user_id !== userId && 
        !['dueno', 'supervisor'].includes(userProfile || '')
      ) {
        res.status(403).json({
          success: false,
          error: 'No tienes permisos para ver esta reserva'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: reservation
      });
    } catch (error: any) {
      console.error('Error fetching reservation details:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Error al obtener los detalles de la reserva'
      });
    }
  }
}