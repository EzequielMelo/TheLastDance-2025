import { supabaseAdmin as supabase } from '../../config/supabase';
import { notifyNewReservation } from '../../services/pushNotificationService';
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
   * Obtener próxima reserva del cliente (dentro de 45 minutos)
   */
  static async getClientUpcomingReservation(userId: string): Promise<{
    time: string;
    date: string;
    tableNumber: string;
    minutesUntil: number;
  } | null> {
    // Usar tiempo de Argentina (UTC-3)
    const now = new Date();
    const nowArgentina = new Date(
      now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
    );
    const in45Minutes = new Date(nowArgentina.getTime() + 45 * 60 * 1000);

    // Obtener fecha actual en Argentina
    const today = nowArgentina.toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

    const { data: reservations, error } = await supabase
    .from('reservations')
    .select(`
      id,
      date,
      time,
      tables:table_id (number)
    `)
    .eq('user_id', userId)
    .eq('status', 'approved')
    .eq('date', today)
    .order('time', { ascending: true });

    if (error) {
      console.error('❌ Error obteniendo reservas del cliente:', error);
      return null;
    }

    if (!reservations || reservations.length === 0) {
      return null;
    }

    // Verificar si hay alguna reserva dentro de los próximos 45 minutos
    // O si ya pasó la hora (seguir mostrando hasta que el maitre la cancele)
    for (const reservation of reservations) {
      const reservationDateTime = new Date(`${reservation.date}T${reservation.time}`);
      
      // Mostrar si la reserva es en los próximos 45 minutos O si ya pasó la hora
      // (hasta que el maitre la cancele manualmente)
      if (reservationDateTime <= in45Minutes) {
        const minutesUntil = Math.floor((reservationDateTime.getTime() - nowArgentina.getTime()) / (60 * 1000));
        
        return {
          time: reservation.time.substring(0, 5), // HH:MM (sin segundos)
          date: reservation.date,
          tableNumber: (reservation.tables as any)?.number || '',
          minutesUntil: Math.max(0, minutesUntil) // No mostrar negativos
        };
      }
    }

    console.log('❌ No hay reservas dentro de los próximos 45 minutos ni pasadas');
    return null;
  }

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

    // Verificar que la fecha y hora sean futuras o válidas para hoy
    const now = new Date();
    
    // Parsear la fecha de la reserva en formato YYYY-MM-DD
    const [year, month, day] = data.date.split('-').map(Number);
    const reservationDate = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1);
    reservationDate.setHours(0, 0, 0, 0);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Validar horario de operación: 19:00 a 02:30
    const timeParts = data.time.split(':').map(Number);
    const hours = timeParts[0] ?? 0;
    const minutes = timeParts[1] ?? 0;
    
    const isValidTime = 
      (hours >= 19) || // 19:00 en adelante
      (hours < 3) || // Hasta las 02:59
      (hours === 2 && minutes <= 30); // Última reserva a las 02:30

    if (!isValidTime) {
      throw new Error('El horario debe estar entre las 19:00 y las 02:30');
    }

    // Construir el datetime completo de la reserva
    const reservationDateTime = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, hours ?? 0, minutes ?? 0, 0);

    // Si la fecha es pasada, rechazar
    if (reservationDate < today) {
      throw new Error('No se pueden hacer reservas para fechas pasadas');
    }

    // Verificar que el datetime completo sea futuro (al menos 15 minutos de anticipación)
    const minReservationTime = new Date(now.getTime() + 15 * 60000);
    
    if (reservationDateTime < minReservationTime) {
      throw new Error('La reserva debe ser con al menos 15 minutos de anticipación');
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

    // Obtener datos del usuario y la mesa para la notificación
    const { data: user } = await supabase
      .from('users')
      .select('name')
      .eq('id', userId)
      .single();

    const { data: tableData } = await supabase
      .from('tables')
      .select('number, type')
      .eq('id', data.table_id)
      .single();

    // Enviar notificación a dueños y supervisores
    if (user && tableData) {
      try {
        await notifyNewReservation(
          user.name || 'Cliente',
          reservation.id,
          data.date,
          data.time,
          data.party_size,
          tableData.number,
          tableData.type
        );
      } catch (notificationError) {
        console.error('❌ Error enviando notificación de nueva reserva:', notificationError);
        // No lanzar error, la reserva ya se creó exitosamente
      }
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
        
      } else if (data.status === 'rejected') {
        await sendReservationRejectedEmail(
          userEmail,
          userName || 'Cliente',
          formattedDate,
          formattedTime,
          reservationDetails.party_size,
          data.rejection_reason || 'La reserva no pudo ser procesada en este momento.'
        );
        
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

    // Horarios disponibles (cada 45min + siguiente hora)
    // Patrón: hora + 45min = siguiente turno
    // 19:00 + 45min = 19:45, luego 20:30, 21:15, etc.
    const timeSlots = [
      '19:00', '19:45', '20:30', '21:15', '22:00', '22:45',
      '23:30', '00:15', '01:00', '01:45', '02:30'
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

    // Horarios disponibles (cada 45min + siguiente hora)
    // Patrón: hora + 45min = siguiente turno
    // 19:00 + 45min = 19:45, luego 20:30, 21:15, etc.
    const timeSlots = [
      '19:00', '19:45', '20:30', '21:15', '22:00', '22:45',
      '23:30', '00:15', '01:00', '01:45', '02:30'
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

      // Calcular ventana de tiempo: 45 minutos antes hasta 45 minutos después (ventana de llegada)
      // Después de que el cliente escanea el QR, is_occupied=true maneja la ocupación real
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
   * Obtener la reserva aprobada de una mesa para una fecha específica
   * Usado para validar cuando un cliente intenta escanear el QR
   */
  static async getTableReservationForDate(
    tableId: string,
    date: string
  ): Promise<{ id: string; time: string; date: string; user_id: string; user_name: string } | null> {
    try {
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('id, time, date, user_id')
        .eq('table_id', tableId)
        .eq('date', date)
        .eq('status', 'approved')
        .single();

      if (error || !reservation) {
        return null;
      }

      // Obtener nombre del usuario
      const { data: user } = await supabase
        .from('users')
        .select('first_name, last_name')
        .eq('id', reservation.user_id)
        .single();

      return {
        id: reservation.id,
        time: reservation.time,
        date: reservation.date,
        user_id: reservation.user_id,
        user_name: user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Usuario',
      };
    } catch (error) {
      console.error('Error in getTableReservationForDate:', error);
      return null;
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
        } else {
          userEmail = authUser.user.email || null;
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

  /**
   * Obtener mesas disponibles para una fecha, hora, tipo y capacidad específica
   * Nuevo flujo: el usuario selecciona todo primero, luego ve qué mesas están libres
   */
  static async getAvailableTablesForReservation(
    date: string,
    time: string,
    tableType: string,
    partySize: number
  ) {
    console.log('Getting available tables for:', { date, time, tableType, partySize });

    // Obtener mesas que coincidan con tipo y capacidad
    const { data: tables, error: tablesError } = await supabase
      .from('tables')
      .select('id, number, capacity, type, photo_url')
      .eq('type', tableType)
      .gte('capacity', partySize)
      .order('number', { ascending: true });

    if (tablesError) {
      console.error('Error fetching tables:', tablesError);
      throw new Error('Error al obtener las mesas');
    }

    if (!tables || tables.length === 0) {
      return [];
    }

    console.log(`Found ${tables.length} tables of type ${tableType} with capacity >= ${partySize}`);

    // Verificar cuáles están disponibles en esa fecha y hora
    const availableTables = [];
    
    for (const table of tables) {
      const isAvailable = await this.isTableAvailableAtTime(table.id, date, time);
      if (isAvailable) {
        availableTables.push(table);
      }
    }

    console.log(`${availableTables.length} tables are available at ${time} on ${date}`);
    
    return availableTables;
  }

  /**
   * Sugerir horarios alternativos cuando no hay mesas disponibles en el horario solicitado
   * Busca slots de ±45 minutos que tengan disponibilidad
   */
  static async suggestAlternativeTimes(
    date: string,
    time: string,
    tableType: string,
    partySize: number
  ): Promise<string[]> {
    console.log('🕐 Buscando horarios alternativos para:', { date, time, tableType, partySize });

    const [hours, minutes] = time.split(':').map(Number);
    const requestedTimeInMinutes = (hours ?? 0) * 60 + (minutes ?? 0);
    
    const suggestions: string[] = [];
    const timeSlots: number[] = [];

    // Generar slots: -90, -45, +45, +90 minutos (para dar más opciones)
    const offsets = [-90, -45, 45, 90];
    
    offsets.forEach(offset => {
      let newTimeInMinutes = requestedTimeInMinutes + offset;
      
      // Manejar transición de día (wrap around)
      if (newTimeInMinutes < 0) {
        newTimeInMinutes += 24 * 60;
      } else if (newTimeInMinutes >= 24 * 60) {
        newTimeInMinutes -= 24 * 60;
      }
      
      // Verificar que esté en horario de operación (19:00-02:30)
      const isInOperatingHours = 
        (newTimeInMinutes >= 19 * 60 && newTimeInMinutes <= 23 * 60 + 59) ||
        (newTimeInMinutes >= 0 && newTimeInMinutes <= 2 * 60 + 30);
      
      if (isInOperatingHours) {
        timeSlots.push(newTimeInMinutes);
      }
    });

    // Verificar disponibilidad para cada slot
    for (const slot of timeSlots) {
      const slotHours = Math.floor(slot / 60);
      const slotMinutes = slot % 60;
      const slotTime = `${String(slotHours).padStart(2, '0')}:${String(slotMinutes).padStart(2, '0')}`;
      
      const availableTables = await this.getAvailableTablesForReservation(
        date,
        slotTime,
        tableType,
        partySize
      );
      
      if (availableTables.length > 0) {
        suggestions.push(slotTime);
      }
    }

    console.log(`✅ Encontrados ${suggestions.length} horarios alternativos:`, suggestions);
    
    return suggestions.sort(); // Ordenar cronológicamente
  }

  /**
   * Verificar si una mesa está disponible en una fecha y hora específica
   * Considera el bloqueo de 45 minutos antes y después
   */
  private static async isTableAvailableAtTime(
    tableId: string,
    date: string,
    time: string
  ): Promise<boolean> {
    // Verificar si la mesa está físicamente ocupada
    const { data: table, error: tableError } = await supabase
      .from('tables')
      .select('is_occupied')
      .eq('id', tableId)
      .single();

    if (tableError || !table) {
      return false;
    }

    // Si la mesa está físicamente ocupada, no está disponible
    if (table.is_occupied) {
      return false;
    }

    // Convertir hora a minutos para cálculos
    const [hours, minutes] = time.split(':').map(Number);
    const requestedTimeInMinutes = (hours ?? 0) * 60 + (minutes ?? 0);

    // Obtener todas las reservas aprobadas o pendientes para esta mesa en esta fecha
    const { data: reservations, error: reservationsError } = await supabase
      .from('reservations')
      .select('time')
      .eq('table_id', tableId)
      .eq('date', date)
      .in('status', ['pending', 'approved']);

    if (reservationsError) {
      console.error('Error checking reservations:', reservationsError);
      return false;
    }

    if (!reservations || reservations.length === 0) {
      return true; // No hay reservas, está disponible
    }

    // Verificar conflictos con reservas existentes
    for (const reservation of reservations) {
      const [resHours, resMinutes] = reservation.time.split(':').map(Number);
      let resTimeInMinutes = (resHours ?? 0) * 60 + (resMinutes ?? 0);

      // Ajustar para horarios de madrugada (00:00-02:30)
      // Si el horario solicitado es de madrugada y la reserva es de noche, o viceversa
      const isRequestedTimeMidnight = (hours ?? 0) < 3;
      const isReservationTimeMidnight = (resHours ?? 0) < 3;

      if (isRequestedTimeMidnight && !isReservationTimeMidnight) {
        // El horario solicitado es de madrugada, la reserva es de noche
        // No hay conflicto (diferentes "días de operación")
        continue;
      }

      if (!isRequestedTimeMidnight && isReservationTimeMidnight) {
        // El horario solicitado es de noche, la reserva es de madrugada
        // No hay conflicto
        continue;
      }

      // Calcular ventana de bloqueo: 45 minutos antes y 45 minutos después
      const blockStart = resTimeInMinutes - 45;
      const blockEnd = resTimeInMinutes + 45;

      // Verificar si el horario solicitado cae dentro de la ventana de bloqueo
      if (requestedTimeInMinutes >= blockStart && requestedTimeInMinutes <= blockEnd) {
        return false; // Conflicto encontrado
      }
    }

    return true; // No hay conflictos, está disponible
  }

  /**
   * Verificar y activar reservas que están en ventana de llegada (-45min)
   * Crea entrada en waiting_list (status=waiting) y asigna mesa (table_status=pending)
   */
  static async checkAndActivateReservation(userId: string): Promise<{
    activated: boolean;
    message?: string;
    tableNumber?: string;
    reservationTime?: string;
  }> {
    try {
      // Obtener fecha y hora actual en Argentina (UTC-3)
      const now = new Date();
      const dateString = now.toLocaleDateString('es-AR', { 
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).split('/').reverse().join('-'); // YYYY-MM-DD
      
      const currentHour = parseInt(now.toLocaleString('es-AR', { 
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit', 
        hour12: false 
      }));
      const currentMinute = parseInt(now.toLocaleString('es-AR', { 
        timeZone: 'America/Argentina/Buenos_Aires',
        minute: '2-digit' 
      }));
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      console.log(`🔍 [checkAndActivateReservation] Usuario: ${userId}, Fecha: ${dateString}, Hora: ${currentHour}:${String(currentMinute).padStart(2, '0')}`);

      // Verificar rápidamente si el usuario ya está seated (salida temprana)
      const { data: quickCheck } = await supabase
        .from('waiting_list')
        .select('status')
        .eq('client_id', userId)
        .in('status', ['seated', 'completed'])
        .limit(1)
        .maybeSingle();

      if (quickCheck) {
        console.log(`⚡ Usuario ya tiene waiting_list en estado ${quickCheck.status} - skip`);
        return { activated: false };
      }

      // Primero limpiar reservas expiradas de todos los usuarios (solo si es necesario)
      await this.cleanExpiredReservations();

      // Buscar reservas aprobadas del usuario para hoy
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, table_id, time, date, party_size')
        .eq('user_id', userId)
        .eq('date', dateString)
        .eq('status', 'approved');

      if (reservationsError) {
        console.error('❌ Error buscando reservas:', reservationsError);
        return { activated: false };
      }

      if (!reservations || reservations.length === 0) {
        return { activated: false };
      }

      // Verificar cada reserva
      for (const reservation of reservations) {
        const [resHours, resMinutes] = reservation.time.split(':').map(Number);
        const reservationTimeInMinutes = (resHours ?? 0) * 60 + (resMinutes ?? 0);

        // Ventana de activación: -45min de la hora de reserva
        const activationTime = reservationTimeInMinutes - 45;

        console.log(`📅 Reserva ${reservation.id} - Hora: ${reservation.time}, Activación: ${Math.floor(activationTime/60)}:${(activationTime%60).toString().padStart(2,'0')}`);

        // Verificar si es momento de activar (desde -45min hasta el final del día)
        if (currentTimeInMinutes >= activationTime) {
          console.log(`✅ Momento de activar reserva ${reservation.id}`);

          // Verificar si ya existe entrada en waiting_list para este usuario
          // (La relación con la reserva se hace implícitamente por client_id y fecha)
          const { data: existingWaiting, error: waitingCheckError } = await supabase
            .from('waiting_list')
            .select('id, status')
            .eq('client_id', userId);

          if (waitingCheckError) {
            console.error('❌ Error verificando waiting_list:', waitingCheckError);
            continue;
          }

          // Si ya existe y está seated o completed, skip
          if (existingWaiting && existingWaiting.length > 0 && existingWaiting[0]) {
            const status = existingWaiting[0].status;
            if (status === 'seated' || status === 'completed') {
              console.log(`ℹ️  Reserva ya procesada (${status})`);
              continue;
            }
            if (status === 'waiting') {
              console.log(`ℹ️  Entrada waiting_list ya existe`);
              
              // Verificar que la mesa esté asignada
              const { data: table } = await supabase
                .from('tables')
                .select('number, id_client, table_status')
                .eq('id', reservation.table_id)
                .single();

              if (table && table.id_client === userId && table.table_status === 'pending') {
                return {
                  activated: true,
                  message: 'Tu reserva ya está activa',
                  tableNumber: table.number?.toString(),
                  reservationTime: reservation.time.substring(0, 5)
                };
              }
              continue;
            }
          }

          // Obtener info de la mesa
          const { data: table, error: tableError } = await supabase
            .from('tables')
            .select('id, number, capacity, type, is_occupied, id_client, table_status')
            .eq('id', reservation.table_id)
            .single();

          if (tableError || !table) {
            console.error('❌ Error obteniendo mesa:', tableError);
            continue;
          }

          // Si la mesa está ocupada o asignada a otro usuario, no activar
          if (table.is_occupied || (table.id_client && table.id_client !== userId)) {
            console.log(`⚠️  Mesa no disponible (occupied: ${table.is_occupied}, client: ${table.id_client})`);
            continue;
          }

          console.log(`🎯 Activando reserva para mesa ${table.number}`);

          // 1. Crear entrada en waiting_list con el tipo de mesa de la reserva
          // No usamos reservation_id porque no existe en el schema
          // La conexión se hace por client_id
          const { data: waitingEntry, error: waitingInsertError } = await supabase
            .from('waiting_list')
            .insert({
              client_id: userId,
              party_size: reservation.party_size,
              preferred_table_type: table.type, // Tipo de mesa desde la reserva
              status: 'waiting',
              priority: 10, // Alta prioridad por ser reserva
              joined_at: new Date().toISOString()
            })
            .select()
            .single();

          if (waitingInsertError) {
            console.error('❌ Error creando waiting_list:', waitingInsertError);
            continue;
          }

          console.log(`✅ waiting_list creada: ${waitingEntry.id}`);

          // 2. NO asignar id_client todavía - solo avisar que la reserva está activa
          // El id_client se asignará cuando el usuario escanee el QR y la mesa esté libre
          // Esto evita pisar el id_client de un cliente que esté ocupando la mesa actualmente
          console.log(`✅ Reserva activada - waiting_list creado (NO se asigna id_client para no pisar cliente actual)`);

          return {
            activated: true,
            message: `Tu reserva para las ${reservation.time.substring(0, 5)}hs está activa. Escanea el QR de tu mesa a partir de esa hora para confirmar tu llegada.`,
            tableNumber: table.number.toString(),
            reservationTime: reservation.time.substring(0, 5)
          };
        } else {
          const minutesUntil = activationTime - currentTimeInMinutes;
          console.log(`⏰ Falta ${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m para activar`);
        }
      }

      return { activated: false };
    } catch (error) {
      console.error('❌ Error en checkAndActivateReservation:', error);
      return { activated: false };
    }
  }

  /**
   * Limpiar reservas expiradas (que pasaron la ventana de +45min sin confirmar)
   * Elimina waiting_list y libera mesa
   */
  static async cleanExpiredReservations(): Promise<void> {
    try {
      // Obtener fecha y hora actual en Argentina (UTC-3)
      const now = new Date();
      const dateString = now.toLocaleDateString('es-AR', { 
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit' 
      }).split('/').reverse().join('-'); // YYYY-MM-DD
      
      const currentHour = parseInt(now.toLocaleString('es-AR', { 
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit', 
        hour12: false 
      }));
      const currentMinute = parseInt(now.toLocaleString('es-AR', { 
        timeZone: 'America/Argentina/Buenos_Aires',
        minute: '2-digit' 
      }));
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      // Buscar reservas aprobadas de hoy
      const { data: reservations, error: reservationsError } = await supabase
        .from('reservations')
        .select('id, table_id, time, user_id')
        .eq('date', dateString)
        .eq('status', 'approved');

      if (reservationsError || !reservations || reservations.length === 0) {
        return;
      }

      for (const reservation of reservations) {
        const [resHours, resMinutes] = reservation.time.split(':').map(Number);
        const reservationTimeInMinutes = (resHours ?? 0) * 60 + (resMinutes ?? 0);
        const expirationTime = reservationTimeInMinutes + 45; // +45min de la hora de reserva

        // Si ya pasó la ventana de llegada
        if (currentTimeInMinutes > expirationTime) {
          // Buscar waiting_list asociado por client_id (user_id de la reserva)
          // que NO esté seated (solo waiting)
          const { data: waitingEntries, error: waitingError } = await supabase
            .from('waiting_list')
            .select('id, status')
            .eq('client_id', reservation.user_id)
            .eq('status', 'waiting');

          if (waitingError) {
            console.error('❌ Error buscando waiting_list:', waitingError);
            continue;
          }

          if (waitingEntries && waitingEntries.length > 0) {
            const waitingEntry = waitingEntries[0];
            
            // Eliminar entrada de waiting_list
            const { error: deleteWaitingError } = await supabase
              .from('waiting_list')
              .delete()
              .eq('id', waitingEntry?.id);

            if (deleteWaitingError) {
              console.error('❌ Error eliminando waiting_list:', deleteWaitingError);
            } else {
              console.log(`✅ waiting_list ${waitingEntry?.id} eliminado (llegó temprano pero nunca confirmó)`);
            }

            // Liberar mesa (quitar id_client, mantener table_status='pending')
            const { error: freeTableError } = await supabase
              .from('tables')
              .update({
                id_client: null
              })
              .eq('id', reservation.table_id)
              .eq('table_status', 'pending') // Solo si está pending (no confirmada)
              .not('is_occupied', 'eq', true); // Y no está ocupada físicamente

            if (freeTableError) {
              console.error('❌ Error liberando mesa:', freeTableError);
            } else {
              console.log(`✅ Mesa ${reservation.table_id} liberada (llegó temprano pero nunca confirmó)`);
            }

            // Cancelar la reserva
            const { error: cancelReservationError } = await supabase
              .from('reservations')
              .update({ status: 'cancelled' })
              .eq('id', reservation.id);

            if (cancelReservationError) {
              console.error('❌ Error cancelando reserva:', cancelReservationError);
            } else {
              console.log(`✅ Reserva ${reservation.id} cancelada por no confirmación`);
            }
          } else {
            // No hay waiting_list en 'waiting', verificar si nunca llegó (no hay waiting_list en absoluto)
            const { data: anyWaitingList } = await supabase
              .from('waiting_list')
              .select('status')
              .eq('client_id', reservation.user_id)
              .limit(1)
              .maybeSingle();

            // Si no tiene waiting_list o está en estado que no sea 'seated'/'completed', cancelar la reserva
            if (!anyWaitingList || (!['seated', 'completed'].includes(anyWaitingList.status))) {
              console.log(`⏰ Usuario nunca confirmó su llegada - cancelando reserva ${reservation.id}`);
              
              const { error: cancelReservationError } = await supabase
                .from('reservations')
                .update({ status: 'cancelled' })
                .eq('id', reservation.id);

              if (cancelReservationError) {
                console.error('❌ Error cancelando reserva:', cancelReservationError);
              } else {
                console.log(`✅ Reserva ${reservation.id} cancelada por ausencia (nunca llegó)`);
              }
            } else {
              console.log(`ℹ️  Reserva ${reservation.id} ya fue completada (status: ${anyWaitingList.status})`);
            }
          }
        }
      }

      console.log('✅ Limpieza de reservas expiradas completada');
    } catch (error) {
      console.error('❌ Error en cleanExpiredReservations:', error);
    }
  }
}