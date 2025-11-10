import { supabaseAdmin as supabase } from '../../config/supabase';
import type {
  Reservation,
  CreateReservationRequest,
  UpdateReservationRequest,
  ReservationWithDetails,
  AvailabilityRequest,
  AvailabilityResponse,
  AvailableSlot
} from './reservations.types';

export class ReservationsService {
  /**
   * Crear una nueva reserva
   */
  static async createReservation(
    userId: string,
    data: CreateReservationRequest
  ): Promise<Reservation> {
    // Verificar que la mesa existe y tiene capacidad suficiente
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, capacity')
      .eq('id', data.table_id)
      .single();

    if (tableError || !table) {
      throw new Error('Mesa no encontrada');
    }

    if (table.capacity < data.party_size) {
      throw new Error(`La mesa seleccionada solo tiene capacidad para ${table.capacity} personas`);
    }

    // Verificar que la fecha sea futura
    const reservationDate = new Date(data.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (reservationDate <= today) {
      throw new Error('No se pueden hacer reservas para fechas pasadas o el día de hoy');
    }

    // Verificar que no haya otra reserva para la misma mesa, fecha y hora
    const { data: existingReservation } = await supabase
      .from('reservations')
      .select('id')
      .eq('table_id', data.table_id)
      .eq('date', data.date)
      .eq('time', data.time + ':00') // Agregar segundos
      .in('status', ['pending', 'approved'])
      .single();

    if (existingReservation) {
      throw new Error('Ya existe una reserva para esta mesa en este horario');
    }

    // Crear la reserva
    const { data: reservation, error } = await supabase
      .from('reservations')
      .insert({
        user_id: userId,
        table_id: data.table_id,
        date: data.date,
        time: data.time + ':00', // Agregar segundos
        party_size: data.party_size,
        notes: data.notes || null,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating reservation:', error);
      throw new Error('Error al crear la reserva');
    }

    return reservation;
  }

  /**
   * Obtener reservas de un usuario
   */
  static async getUserReservations(userId: string): Promise<ReservationWithDetails[]> {
    // Primero obtener las reservas básicas
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (reservationsError) {
      console.error('Error fetching user reservations:', reservationsError);
      throw new Error('Error al obtener las reservas');
    }

    if (!reservations || reservations.length === 0) {
      return [];
    }

    // Obtener información de las mesas por separado
    const tableIds = [...new Set(reservations.map(r => r.table_id))];
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, number, capacity, type')
      .in('id', tableIds);

    if (tablesError) {
      console.warn('Error fetching tables:', tablesError);
    }

    // Combinar la información
    const result = reservations.map(reservation => ({
      ...reservation,
      table: tables?.find(t => t.id === reservation.table_id) || null,
      approved_by_user: null // Por ahora null, se puede agregar después si es necesario
    }));

    return result;
  }

  /**
   * Obtener todas las reservas (para admin)
   */
  static async getAllReservations(): Promise<ReservationWithDetails[]> {
    const { data, error } = await supabase
      .from('reservations')
      .select(`*`)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (error) {
      console.error('Error fetching all reservations:', error);
      throw new Error('Error al obtener las reservas');
    }

    return data || [];
  }

  /**
   * Actualizar el estado de ocupación de una mesa basándose en una reserva
   * La mesa se marca como ocupada desde 45 minutos antes hasta 45 minutos después
   */
  static async updateTableOccupiedStatus(
    tableId: string,
    reservationDate: string,
    reservationTime: string,
    isOccupied: boolean
  ): Promise<void> {
    // Para las reservas aprobadas, necesitamos verificar si la fecha/hora de la reserva está activa AHORA
    // Si la reserva es para el futuro, no hacemos nada con is_occupied (se manejará en tiempo real)
    // Este método es principalmente para registrar la información, pero el estado real de ocupación
    // se debe calcular en tiempo real cuando se consulta la mesa
    
    console.log(`Reserva ${isOccupied ? 'aprobada' : 'liberada'} para mesa ${tableId} el ${reservationDate} a las ${reservationTime}`);
    
    // Por ahora, solo registramos el log
    // El estado is_occupied se manejará mediante una consulta que verifique:
    // 1. Si la mesa está ocupada por un cliente sentado (tables.is_occupied = true)
    // 2. O si tiene una reserva activa en el rango de 45min antes/después
    
    // No modificamos is_occupied aquí porque eso representa si hay alguien FÍSICAMENTE sentado
    // La reserva bloquea la mesa solo durante su ventana de tiempo
  }

  /**
   * Actualizar estado de una reserva (aprobar/rechazar)
   */
  static async updateReservationStatus(
    reservationId: string,
    adminUserId: string,
    data: UpdateReservationRequest
  ): Promise<Reservation> {
    // Primero obtener los detalles completos de la reserva
    const reservationDetails = await this.getReservationById(reservationId);
    
    if (!reservationDetails) {
      throw new Error('Reserva no encontrada');
    }

    const updateData: any = {
      status: data.status,
      approved_by: adminUserId,
      approved_at: new Date().toISOString()
    };

    // Solo agregar rejection_reason si existe la columna y hay una razón
    // Por ahora omitimos este campo ya que no existe en la tabla
    // Si se necesita en el futuro, se debe agregar la columna a la tabla primero

    const { data: reservation, error } = await supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating reservation:', error);
      throw new Error('Error al actualizar la reserva');
    }

    // Si la reserva fue aprobada, marcar la mesa como ocupada durante el periodo de la reserva
    if (data.status === 'approved') {
      try {
        await this.updateTableOccupiedStatus(
          reservationDetails.table_id,
          reservationDetails.date,
          reservationDetails.time,
          true
        );
        console.log(`✅ Mesa ${reservationDetails.table_id} marcada como ocupada para ${reservationDetails.date} ${reservationDetails.time}`);
      } catch (occupiedError) {
        console.error('Error actualizando estado de ocupación de la mesa:', occupiedError);
        // No lanzamos el error para no interrumpir el flujo
      }
    }

    // Enviar email al cliente
    try {
      const { sendReservationApprovedEmail, sendReservationRejectedEmail } = await import('../../lib/emails');
      
      const userName = `${reservationDetails.user?.first_name || ''} ${reservationDetails.user?.last_name || ''}`.trim();
      const userEmail = reservationDetails.user?.email;

      if (!userEmail) {
        console.warn('No se pudo enviar email: email del usuario no encontrado');
        return reservation;
      }

      // Formatear fecha en español
      const dateObj = new Date(reservationDetails.date);
      const formattedDate = dateObj.toLocaleDateString('es-ES', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      // Formatear hora (HH:MM)
      const formattedTime = reservationDetails.time.substring(0, 5);

      if (data.status === 'approved') {
        const tableNumber = reservationDetails.table?.number?.toString() || 'N/A';
        
        await sendReservationApprovedEmail(
          userEmail,
          userName || 'Cliente',
          formattedDate,
          formattedTime,
          reservationDetails.party_size,
          tableNumber
        );
        
        console.log(`✅ Email de aprobación enviado a ${userEmail}`);
      } else if (data.status === 'rejected') {
        await sendReservationRejectedEmail(
          userEmail,
          userName || 'Cliente',
          formattedDate,
          formattedTime,
          reservationDetails.party_size,
          data.rejection_reason || 'La reserva no pudo ser procesada en este momento.'
        );
        
        console.log(`✅ Email de rechazo enviado a ${userEmail}`);
      }
    } catch (emailError) {
      console.error('Error enviando email de reserva:', emailError);
      // No lanzamos el error para no interrumpir el flujo
      // La reserva ya fue actualizada exitosamente
    }

    return reservation;
  }

  /**
   * Cancelar una reserva (por parte del cliente)
   */
  static async cancelReservation(
    reservationId: string,
    userId: string
  ): Promise<Reservation> {
    // Verificar que la reserva pertenece al usuario
    const { data: existingReservation, error: fetchError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !existingReservation) {
      throw new Error('Reserva no encontrada');
    }

    if (!['pending', 'approved'].includes(existingReservation.status)) {
      throw new Error('No se puede cancelar esta reserva');
    }

    const { data: reservation, error } = await supabase
      .from('reservations')
      .update({ status: 'cancelled' })
      .eq('id', reservationId)
      .select()
      .single();

    if (error) {
      console.error('Error cancelling reservation:', error);
      throw new Error('Error al cancelar la reserva');
    }

    return reservation;
  }

  /**
   * Obtener mesas disponibles por tipo y capacidad
   */
  static async getAvailableTablesByType(
    tableType: string,
    minCapacity: number
  ): Promise<any[]> {

    const { data: tables, error } = await supabase
      .from('tables')
      .select('*')
      .eq('type', tableType)
      .gte('capacity', minCapacity)
      .order('number', { ascending: true });

    if (error) {
      console.error('Error fetching tables by type:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      throw new Error('Error al obtener las mesas');
    }

    return tables || [];
  }

  /**
   * Verificar disponibilidad de horarios para una mesa específica
   */
  static async checkTableAvailability(
    tableId: string,
    date: string
  ): Promise<AvailabilityResponse> {
    console.log(`Checking availability for table ${tableId} on ${date}`);

    // Horarios disponibles (cada 30 minutos de 12:00 a 23:00)
    const timeSlots = [
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
      '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
      '21:00', '21:30', '22:00', '22:30', '23:00'
    ];

    // Obtener reservas existentes para esta mesa y fecha
    const { data: existingReservations, error } = await supabase
      .from('reservations')
      .select('time')
      .eq('table_id', tableId)
      .eq('date', date)
      .in('status', ['pending', 'approved']);

    if (error) {
      console.error('Error fetching reservations for table:', error);
      throw new Error('Error al verificar reservas de la mesa');
    }

    console.log(`Found ${existingReservations?.length || 0} existing reservations for table ${tableId} on ${date}`);

    // Crear set de horarios ocupados
    const occupiedTimes = new Set(
      existingReservations?.map(r => r.time.substring(0, 5)) || []
    );

    // Generar slots disponibles
    const slots: AvailableSlot[] = timeSlots.map(time => ({
      time,
      available: !occupiedTimes.has(time),
      table_id: tableId
    }));

    console.log(`Generated ${slots.length} slots, ${slots.filter(s => s.available).length} available`);

    return {
      date,
      slots
    };
  }

  /**
   * Verificar disponibilidad de mesas para una fecha
   */
  static async checkAvailability(
    data: AvailabilityRequest
  ): Promise<AvailabilityResponse> {
    console.log('Checking availability for:', data);

    // Horarios disponibles (cada 30 minutos de 12:00 a 23:00)
    const timeSlots = [
      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
      '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
      '18:00', '18:30', '19:00', '19:30', '20:00', '20:30',
      '21:00', '21:30', '22:00', '22:30', '23:00'
    ];

    // Obtener todas las mesas disponibles
    let tablesQuery = supabase
      .from('tables')
      .select('id, number, capacity, type');

    // Filtrar por capacidad si se especifica
    if (data.party_size) {
      tablesQuery = tablesQuery.gte('capacity', data.party_size);
    }

    const { data: tables, error: tablesError } = await tablesQuery;

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      throw new Error('Error al obtener las mesas');
    }

    console.log(`Found ${tables?.length || 0} tables suitable for ${data.party_size || 'any'} people`);
    console.log('Tables found:', tables);

    if (!tables || tables.length === 0) {
      // Si no hay mesas disponibles, devolver todos los slots como no disponibles
      const slots: AvailableSlot[] = timeSlots.map(time => ({
        time,
        available: false
      }));

      return {
        date: data.date,
        slots
      };
    }

    // Obtener reservas existentes para esta fecha
    const { data: existingReservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('table_id, time')
      .eq('date', data.date)
      .in('status', ['pending', 'approved']);

    if (reservationsError) {
      console.error('Error fetching existing reservations:', reservationsError);
      throw new Error('Error al verificar reservas existentes');
    }

    console.log(`Found ${existingReservations?.length || 0} existing reservations for ${data.date}`);

    // Crear mapa de reservas por mesa y hora
    const reservationMap = new Map<string, Set<string>>();
    existingReservations?.forEach(reservation => {
      const timeKey = reservation.time.substring(0, 5); // HH:MM
      if (!reservationMap.has(reservation.table_id)) {
        reservationMap.set(reservation.table_id, new Set());
      }
      reservationMap.get(reservation.table_id)!.add(timeKey);
    });

    // Generar slots disponibles
    const slots: AvailableSlot[] = [];

    for (const time of timeSlots) {
      // Buscar la primera mesa disponible para este horario
      const availableTable = tables.find(table => {
        const tableReservations = reservationMap.get(table.id);
        return !tableReservations || !tableReservations.has(time);
      });

      slots.push({
        time,
        available: !!availableTable,
        table_id: availableTable?.id,
        table_number: availableTable?.number,
        table_capacity: availableTable?.capacity
      });
    }

    console.log(`Generated ${slots.length} slots, ${slots.filter(s => s.available).length} available`);

    return {
      date: data.date,
      slots
    };
  }

  /**
   * Verificar si una mesa está reservada en un horario específico
   * Considera una ventana de 45 minutos antes y después de la reserva
   * (Función para el maitre al asignar mesas)
   */
  static async isTableReserved(
    tableId: string,
    date: string,
    time: string
  ): Promise<boolean> {
    try {
      // Primero verificar si la mesa está físicamente ocupada
      const { data: table, error: tableError } = await supabase
        .from('tables')
        .select('is_occupied')
        .eq('id', tableId)
        .single();

      if (tableError) {
        console.error('Error checking table occupation:', tableError);
      }

      // Si está físicamente ocupada, retornar true
      if (table && table.is_occupied) {
        console.log(`Mesa ${tableId} está físicamente ocupada`);
        return true;
      }

      // Convertir la hora a minutos desde medianoche para comparación
      const timeParts = time.split(':').map(Number);
      const hours = timeParts[0] ?? 0;
      const minutes = timeParts[1] ?? 0;
      const timeInMinutes = hours * 60 + minutes;

      // Calcular ventana de tiempo: 45 minutos antes y después
      const startTimeInMinutes = timeInMinutes - 45;
      const endTimeInMinutes = timeInMinutes + 45;

      // Convertir de vuelta a formato HH:MM
      const formatTime = (mins: number): string => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:00`;
      };

      const startTime = formatTime(Math.max(0, startTimeInMinutes));
      const endTime = formatTime(Math.min(1439, endTimeInMinutes)); // 23:59

      console.log(`Verificando reservas para mesa ${tableId} el ${date} entre ${startTime} y ${endTime}`);

      // Buscar reservas aprobadas en la ventana de tiempo
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('id, time')
        .eq('table_id', tableId)
        .eq('date', date)
        .eq('status', 'approved')
        .gte('time', startTime)
        .lte('time', endTime);

      if (error) {
        console.error('Error checking table reservations:', error);
        return false;
      }

      const hasReservation = reservations && reservations.length > 0;
      
      if (hasReservation) {
        console.log(`Mesa ${tableId} tiene ${reservations.length} reserva(s) en la ventana de tiempo`);
      }

      return hasReservation;
    } catch (error) {
      console.error('Error in isTableReserved:', error);
      return false;
    }
  }

  /**
   * Obtener detalles de una reserva específica
   */
  static async getReservationById(
    reservationId: string
  ): Promise<ReservationWithDetails | null> {
    // Primero obtener la reserva básica
    const { data: reservation, error: reservationError } = await supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (reservationError || !reservation) {
      console.error('Error fetching reservation details:', reservationError);
      return null;
    }

    // Obtener información del usuario desde la tabla users
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name')
      .eq('id', reservation.user_id)  // La columna es 'id', no 'user_id'
      .single();

    if (userError) {
      console.error('❌ Error fetching user details:', userError);
    }

    // Obtener el email desde Supabase Auth
    let userEmail = null;
    if (user) {
      try {
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(reservation.user_id);
        
        if (authError) {
          console.error('❌ Error en auth.admin.getUserById:', authError);
        } else if (!authUser?.user) {
          console.error('❌ No se encontró usuario en Auth');
        }
      } catch (authError) {
        console.error('❌ Exception en getUserById:', authError);
      }
    } else {
      console.error('❌ No se pudo obtener usuario de la tabla users, no se puede obtener email');
    }

    // Obtener información de la mesa
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('id, number, capacity, type')
      .eq('id', reservation.table_id)
      .single();

    if (tableError) {
      console.warn('Error fetching table details:', tableError);
    }

    // Obtener información del usuario que aprobó (si existe)
    let approvedByUser = null;
    if (reservation.approved_by) {
      const { data: approver, error: approverError } = await supabase
        .from('users')
        .select('id, first_name, last_name')
        .eq('id', reservation.approved_by)  // La columna es 'id', no 'user_id'
        .single();

      if (!approverError && approver) {
        // Obtener email del aprobador desde Auth
        try {
          const { data: authApprover } = await supabase.auth.admin.getUserById(reservation.approved_by);
          approvedByUser = {
            user_id: approver.id,
            first_name: approver.first_name,
            last_name: approver.last_name,
            email: authApprover?.user?.email || null
          };
        } catch (authError) {
          console.warn('Error fetching approver email from auth:', authError);
          approvedByUser = {
            user_id: approver.id,
            first_name: approver.first_name,
            last_name: approver.last_name,
            email: null
          };
        }
      }
    }

    // Combinar toda la información
    const result = {
      ...reservation,
      user: user ? {
        user_id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        email: userEmail
      } : null,
      table: table || null,
      approved_by_user: approvedByUser
    };

    return result;
  }
}