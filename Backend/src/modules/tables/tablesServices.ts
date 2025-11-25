import { supabaseAdmin } from "../../config/supabase";
import type {
  WaitingListEntry,
  WaitingListWithUser,
  CreateWaitingListEntry,
  AssignTableRequest,
  TableWithClient,
  WaitingListResponse,
  TablesStatusResponse,
} from "./tables.types";
import { ReservationsService } from "../reservations/reservationsService";

// ========== SERVICIOS PARA LISTA DE ESPERA ==========

// Obtener lista de espera completa para el maitre
export async function getWaitingList(): Promise<WaitingListResponse> {
  // Primero obtenemos las entradas de waiting_list
  const { data: waitingEntries, error: waitingError } = await supabaseAdmin
    .from("waiting_list")
    .select("*")
    .eq("status", "waiting")
    .order("priority", { ascending: false })
    .order("joined_at", { ascending: true });

  console.log("📋 getWaitingList - Entradas waiting_list:", {
    dataLength: waitingEntries?.length,
    error: waitingError?.message,
  });

  if (waitingError) {
    console.error("📋 getWaitingList - Error en waiting_list:", waitingError);
    throw new Error(
      `Error obteniendo lista de espera: ${waitingError.message}`,
    );
  }

  if (!waitingEntries || waitingEntries.length === 0) {
    return {
      waiting_list: [],
      total_waiting: 0,
    };
  }

  // Obtener IDs de clientes únicos
  const clientIds = [...new Set(waitingEntries.map(entry => entry.client_id))];

  // Consultar usuarios por separado
  const { data: users, error: usersError } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, profile_image, profile_code")
    .in("id", clientIds);

  console.log("📋 getWaitingList - Usuarios obtenidos:", {
    usersLength: users?.length,
    error: usersError?.message,
    users: users?.map(u => ({
      id: u.id,
      name: `${u.first_name} ${u.last_name}`,
      profile_code: u.profile_code,
    })),
  });

  if (usersError) {
    console.error("📋 getWaitingList - Error obteniendo usuarios:", usersError);
    throw new Error(`Error obteniendo usuarios: ${usersError.message}`);
  }

  // Combinar los datos
  const waitingList: WaitingListWithUser[] = waitingEntries.map(entry => {
    const user = users?.find(u => u.id === entry.client_id);
    return {
      ...entry,
      users: user
        ? {
            first_name: user.first_name,
            last_name: user.last_name,
            profile_image: user.profile_image,
            profile_code: user.profile_code,
          }
        : {
            first_name: "Usuario",
            last_name: "Desconocido",
            profile_code: "cliente_registrado",
          },
    };
  });

  // Calcular tiempo promedio de espera para los que ya fueron asignados hoy
  const { data: seatedToday } = await supabaseAdmin
    .from("waiting_list")
    .select("joined_at, seated_at")
    .eq("status", "seated")
    .gte("joined_at", new Date().toISOString().split("T")[0]);

  let averageWaitTime: number | undefined;
  if (seatedToday && seatedToday.length > 0) {
    const totalWaitTime = seatedToday.reduce((sum, entry) => {
      if (entry.seated_at && entry.joined_at) {
        const waitTime =
          new Date(entry.seated_at).getTime() -
          new Date(entry.joined_at).getTime();
        return sum + waitTime;
      }
      return sum;
    }, 0);
    averageWaitTime = Math.round(
      totalWaitTime / seatedToday.length / (1000 * 60),
    ); // en minutos
  }

  return {
    waiting_list: waitingList,
    total_waiting: waitingList.length,
    ...(averageWaitTime !== undefined && {
      average_wait_time: averageWaitTime,
    }),
  };
}

// Agregar cliente a la lista de espera
export async function addToWaitingList(
  entry: CreateWaitingListEntry,
): Promise<WaitingListEntry> {
  // Verificar que el cliente no esté ya en la lista
  const { data: existing } = await supabaseAdmin
    .from("waiting_list")
    .select("id")
    .eq("client_id", entry.client_id)
    .eq("status", "waiting")
    .single();

  if (existing) {
    throw new Error("El cliente ya está en la lista de espera");
  }

  const { data, error } = await supabaseAdmin
    .from("waiting_list")
    .insert({
      client_id: entry.client_id,
      party_size: entry.party_size,
      preferred_table_type: entry.preferred_table_type,
      special_requests: entry.special_requests,
      priority: entry.priority || 0,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Error agregando a lista de espera: ${error.message}`);
  }

  return data as WaitingListEntry;
}

// Obtener posición en la cola para un cliente específico
export async function getClientPosition(clientId: string): Promise<{
  position: number;
  estimatedWait?: number;
  entry: WaitingListEntry;
}> {
  const { data: clientEntry } = await supabaseAdmin
    .from("waiting_list")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "waiting")
    .single();

  if (!clientEntry) {
    throw new Error("Cliente no encontrado en la lista de espera");
  }

  const { count } = await supabaseAdmin
    .from("waiting_list")
    .select("*", { count: "exact", head: true })
    .eq("status", "waiting")
    .or(
      `priority.gt.${clientEntry.priority},and(priority.eq.${clientEntry.priority},joined_at.lt.${clientEntry.joined_at})`,
    );

  const position = (count || 0) + 1;

  // Estimar tiempo de espera basado en promedio del día
  const { data: avgData } = await supabaseAdmin
    .from("waiting_list")
    .select("joined_at, seated_at")
    .eq("status", "seated")
    .gte("joined_at", new Date().toISOString().split("T")[0])
    .limit(10);

  let estimatedWait: number | undefined;
  if (avgData && avgData.length > 0) {
    const avgWaitTime =
      avgData.reduce((sum, entry) => {
        if (entry.seated_at && entry.joined_at) {
          const waitTime =
            new Date(entry.seated_at).getTime() -
            new Date(entry.joined_at).getTime();
          return sum + waitTime;
        }
        return sum;
      }, 0) / avgData.length;

    estimatedWait = Math.round((avgWaitTime / (1000 * 60)) * position); // minutos * posición
  }

  return {
    position,
    entry: clientEntry,
    ...(estimatedWait !== undefined && { estimatedWait }),
  };
}

// ========== SERVICIOS PARA MESAS ==========

// Obtener estado de todas las mesas
export async function getTablesStatus(): Promise<TablesStatusResponse> {
  // Obtener todas las mesas
  const { data: tablesData, error: tablesError } = await supabaseAdmin
    .from("tables")
    .select("*")
    .order("number", { ascending: true });

  if (tablesError) {
    throw new Error(`Error obteniendo estado de mesas: ${tablesError.message}`);
  }

  // Obtener información de clientes para mesas ocupadas O asignadas
  const tablesWithClients = tablesData.filter(table => table.id_client);
  const clientIds = tablesWithClients.map(table => table.id_client);

  let clientsData: any[] = [];
  if (clientIds.length > 0) {
    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, profile_image, profile_code")
      .in("id", clientIds);

    if (clientsError) {
      console.warn("Error obteniendo datos de clientes:", clientsError.message);
    } else {
      clientsData = clients || [];
    }
  }

  // Obtener reservas approved para el día de hoy
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
  });
  
  const { data: reservationsData, error: reservationsError } = await supabaseAdmin
    .from("reservations")
    .select("id, user_id, table_id, date, time, party_size, status")
    .eq("date", today)
    .eq("status", "approved");

  if (reservationsError) {
    console.warn("Error obteniendo reservas:", reservationsError.message);
  }

  // Obtener nombres de usuarios para las reservas
  const reservationUserIds = reservationsData?.map(r => r.user_id).filter(Boolean) || [];
  let reservationUsersData: any[] = [];
  if (reservationUserIds.length > 0) {
    const { data: users } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name")
      .in("id", reservationUserIds);
    reservationUsersData = users || [];
  }

  // Calcular tiempo actual y ventana de 45 minutos
  const now = new Date();
  const nowArgentina = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" })
  );
  const in45Minutes = new Date(nowArgentina.getTime() + 45 * 60 * 1000);
  
  const allApprovedReservations = reservationsData || [];

  console.log("🔍 Reservas approved encontradas:", {
    total: reservationsData?.length || 0,
    approved_today: allApprovedReservations.length,
    time: nowArgentina.toLocaleTimeString("es-AR"),
    in45Min: in45Minutes.toLocaleTimeString("es-AR"),
  });

  // Para cada mesa, encontrar la próxima reserva dentro de los próximos 45 minutos
  // Esto mostrará al maitre qué mesas NO puede asignar porque tienen reserva próxima
  const tableReservationsMap = new Map<string, any>();
  
  allApprovedReservations.forEach(reservation => {
    const reservationDateTime = new Date(`${reservation.date}T${reservation.time}`);
    
    // FILTRO CRÍTICO: Solo mostrar reservas dentro de los próximos 45 minutos
    // Esto previene que el maitre asigne una mesa que pronto estará reservada
    if (reservationDateTime > nowArgentina && reservationDateTime <= in45Minutes) {
      const existing = tableReservationsMap.get(reservation.table_id);
      
      // Si no hay reserva para esta mesa, o esta es más temprana, guardarla
      if (!existing || reservation.time < existing.time) {
        tableReservationsMap.set(reservation.table_id, reservation);
      }
    }
  });

  console.log("📋 Mesas con reservas próximas (<45 min):", {
    count: tableReservationsMap.size,
    tables: Array.from(tableReservationsMap.entries()).map(([tableId, res]) => {
      const user = reservationUsersData.find(u => u.id === res.user_id);
      return {
        tableId,
        time: res.time,
        userName: user ? `${user.first_name} ${user.last_name}` : 'Usuario desconocido'
      };
    })
  });

  // Mapear los datos para incluir información del cliente y reserva próxima
  const tables: TableWithClient[] = tablesData.map(table => {
    const client = table.id_client
      ? clientsData.find(c => c.id === table.id_client)
      : undefined;

    // Mostrar reserva próxima (<45 min) SOLO si la mesa NO está ocupada ni asignada
    // Esto permite que el maitre vea qué mesas pronto no estarán disponibles
    let reservation = undefined;
    if (!table.is_occupied && !table.id_client) {
      reservation = tableReservationsMap.get(table.id);
    }

    return {
      ...table,
      client,
      reservation,
    };
  });
  
  // Calcular contadores considerando también las reservas próximas
  const occupiedCount = tables.filter(t => t.is_occupied).length;
  const assignedCount = tables.filter(
    t => t.id_client && !t.is_occupied,
  ).length;
  const reservedCount = tables.filter(
    t => !t.is_occupied && !t.id_client && t.reservation
  ).length;
  
  // Mesas NO disponibles = ocupadas + asignadas + con reserva próxima (<45 min)
  const unavailableCount = tables.filter(
    t => t.is_occupied || t.id_client || t.reservation,
  ).length;
  
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const occupiedCapacity = tables
    .filter(t => t.is_occupied)
    .reduce((sum, t) => sum + t.capacity, 0);
  const assignedCapacity = tables
    .filter(t => t.id_client && !t.is_occupied)
    .reduce((sum, t) => sum + t.capacity, 0);

  console.log("📊 Estadísticas de mesas:", {
    total: tables.length,
    occupied: occupiedCount,
    assigned: assignedCount,
    reserved: reservedCount,
    available: tables.length - unavailableCount
  });

  return {
    tables,
    occupied_count: occupiedCount,
    assigned_count: assignedCount,
    available_count: tables.length - unavailableCount,
    total_capacity: totalCapacity,
    occupied_capacity: occupiedCapacity,
    assigned_capacity: assignedCapacity,
  };
}

// Asignar cliente de la lista de espera a una mesa
export async function assignClientToTable({
  waiting_list_id,
  table_id,
}: AssignTableRequest): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Verificar que el cliente esté en la lista de espera (waiting o displaced)
    const { data: waitingEntry, error: waitingError } = await supabaseAdmin
      .from("waiting_list")
      .select("client_id, party_size, status")
      .eq("id", waiting_list_id)
      .in("status", ["waiting", "displaced"])
      .single();

    if (waitingError || !waitingEntry) {
      return {
        success: false,
        message: "Cliente no encontrado en la lista de espera",
      };
    }

    // 2. Verificar que la mesa esté disponible (no ocupada Y sin cliente asignado)
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id, capacity, is_occupied, id_client")
      .eq("id", table_id)
      .eq("is_occupied", false)
      .is("id_client", null)
      .single();

    if (tableError || !table) {
      return {
        success: false,
        message: "Mesa no disponible o ya asignada a otro cliente",
      };
    }

    // 2.5. Verificar si hay una reserva próxima (dentro de 45 minutos) para esta mesa
    const now = new Date();
    const in45Minutes = new Date(now.getTime() + 45 * 60 * 1000);
    
    const { data: upcomingReservation } = await supabaseAdmin
      .from("reservations")
      .select(`
        id,
        time,
        date,
        users!inner(first_name, last_name)
      `)
      .eq("table_id", table_id)
      .eq("status", "approved")
      .gte("date", now.toISOString().split("T")[0])
      .limit(1)
      .single();

    if (upcomingReservation) {
      // Combinar fecha y hora de la reserva
      const reservationDateTime = new Date(`${upcomingReservation.date}T${upcomingReservation.time}`);
      
      // Si la reserva es dentro de los próximos 45 minutos
      if (reservationDateTime <= in45Minutes && reservationDateTime > now) {
        const userData = upcomingReservation.users as any;
        const clientName = userData 
          ? `${userData.first_name} ${userData.last_name}`
          : "un cliente";
        
        return {
          success: false,
          message: `Esta mesa tiene una reserva confirmada a las ${upcomingReservation.time} para ${clientName}. No se puede asignar en este momento.`,
        };
      }
    }

    // 3. Verificar capacidad
    if (waitingEntry.party_size > table.capacity) {
      console.log("❌ [assignClientToTable] Mesa muy pequeña", {
        party_size: waitingEntry.party_size,
        capacity: table.capacity,
      });
      return {
        success: false,
        message: `Mesa muy pequeña. Capacidad: ${table.capacity}, Grupo: ${waitingEntry.party_size}`,
      };
    }

    const { error: updateWaitingError } = await supabaseAdmin
      .from("waiting_list")
      .update({
        status: "seated",
        seated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", waiting_list_id);

    if (updateWaitingError) {
      throw new Error(
        `Error actualizando lista de espera: ${updateWaitingError.message}`,
      );
    }

    const { error: updateTableError } = await supabaseAdmin
      .from("tables")
      .update({
        id_client: waitingEntry.client_id,
        // is_occupied sigue siendo false - se activará cuando el cliente escanee el QR de la mesa
      })
      .eq("id", table_id);

    if (updateTableError) {
      // Revertir cambio en waiting_list si falla
      await supabaseAdmin
        .from("waiting_list")
        .update({
          status: "waiting",
          seated_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", waiting_list_id);

      throw new Error(`Error asignando mesa: ${updateTableError.message}`);
    }

    return {
      success: true,
      message:
        "Cliente asignado a la mesa exitosamente. El cliente debe escanear el QR de la mesa para activarla.",
    };
  } catch (error: any) {
    console.log("💥 [assignClientToTable] Error en asignación:", {
      error: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      message: error.message || "Error interno del servidor",
    };
  }
}

// Activar mesa cuando el cliente escanea el QR
export async function activateTableByClient(
  tableIdOrNumber: string,
  clientId: string,
): Promise<{ success: boolean; message: string; table?: any; earlyArrival?: boolean; reservationTime?: string; userName?: string }> {
  try {
    console.log("🔍 [activateTableByClient] Iniciando...");
    console.log("📋 tableIdOrNumber:", tableIdOrNumber);
    console.log("👤 clientId:", clientId);

    // 1. Verificar si el cliente ya tiene una mesa ocupada
    const { data: existingOccupiedTable, error: existingError } =
      await supabaseAdmin
        .from("tables")
        .select("id, number, is_occupied")
        .eq("id_client", clientId)
        .eq("is_occupied", true)
        .limit(1);

    console.log(
      "🔍 Verificando mesas ocupadas existentes:",
      existingOccupiedTable,
    );

    if (existingError) {
      console.error("❌ Error verificando mesas ocupadas:", existingError);
      throw new Error(
        `Error verificando mesas ocupadas: ${existingError.message}`,
      );
    }

    if (existingOccupiedTable && existingOccupiedTable.length > 0) {
      const occupiedTable = existingOccupiedTable[0];
      console.log("⚠️ Cliente ya tiene mesa ocupada:", occupiedTable);
      return {
        success: false,
        message: `Ya tienes la mesa ${occupiedTable?.number || "una mesa"} ocupada. Solo puedes tener una mesa activa a la vez.`,
      };
    }

    // 2. Verificar que la mesa esté asignada al cliente pero no ocupada
    // Intentar buscar por ID primero, luego por número si falla
    let table: any = null;
    let tableError: any = null;

    console.log("🔍 Buscando mesa por ID/número...");

    // Intentar como ID numérico
    if (!isNaN(Number(tableIdOrNumber))) {
      console.log("🔢 Intentando como ID numérico:", Number(tableIdOrNumber));
      const { data: tableById, error: errorById } = await supabaseAdmin
        .from("tables")
        .select("id, number, id_client, is_occupied")
        .eq("id", Number(tableIdOrNumber))
        .single();

      console.log("📋 Resultado búsqueda por ID:", tableById);
      console.log("❌ Error búsqueda por ID:", errorById);

      if (!errorById && tableById) {
        table = tableById;
        console.log("✅ Mesa encontrada por ID:", table);
      } else {
        // Si falló como ID, intentar como número de mesa
        console.log(
          "🔢 Intentando como número de mesa:",
          Number(tableIdOrNumber),
        );
        const { data: tableByNumber, error: errorByNumber } =
          await supabaseAdmin
            .from("tables")
            .select("id, number, id_client, is_occupied")
            .eq("number", Number(tableIdOrNumber))
            .single();

        console.log("📋 Resultado búsqueda por número:", tableByNumber);
        console.log("❌ Error búsqueda por número:", errorByNumber);

        table = tableByNumber;
        tableError = errorByNumber;
      }
    } else {
      // Si no es numérico, solo intentar como número
      console.log("🔤 No es numérico, intentando como número de mesa");
      const { data: tableByNumber, error: errorByNumber } = await supabaseAdmin
        .from("tables")
        .select("id, number, id_client, is_occupied")
        .eq("number", Number(tableIdOrNumber))
        .single();

      console.log("📋 Resultado búsqueda por número:", tableByNumber);
      console.log("❌ Error búsqueda por número:", errorByNumber);

      table = tableByNumber;
      tableError = errorByNumber;
    }

    if (tableError || !table) {
      console.error("❌ Mesa no encontrada");
      return { success: false, message: "Mesa no encontrada" };
    }

    console.log("✅ Mesa encontrada:", table);
    console.log("🔍 Comparando id_client:");
    console.log("   Mesa id_client:", table.id_client);
    console.log("   Usuario clientId:", clientId);
    console.log("   ¿Son iguales?:", table.id_client === clientId);

    // 3. Verificar que la mesa esté asignada al cliente correcto O que tenga una reserva válida
    if (table.id_client !== clientId) {
      console.log("⚠️ Mesa no asignada directamente, verificando reservas...");
      
      // Verificar si el usuario tiene una reserva para esta mesa hoy
      const today = new Date();
      const localDate = new Date(today.getTime() - (3 * 60 * 60 * 1000)); // UTC-3
      const dateString = localDate.toISOString().split('T')[0] || '';
      
      const reservation = await ReservationsService.getTableReservationForDate(
        table.id.toString(),
        dateString
      );

      // Si tiene una reserva válida, permitir el escaneo (no asignar todavía)
      if (reservation && reservation.user_id === clientId) {
        console.log("✅ Usuario tiene reserva válida para esta mesa");
        
        // NO asignar id_client aquí - solo marcar que tiene reserva
        // La asignación se hará más adelante en las validaciones de tiempo
        // si la mesa está libre
        table.id_client = null; // Mantener como null para que las validaciones de tiempo continúen
        console.log("✅ Reserva válida - continuando con validaciones de tiempo");
      } else {
        console.error("❌ Mesa no asignada y sin reserva válida");
        return {
          success: false,
          message:
            "Esta mesa no está asignada a tu usuario. Solo puedes activar mesas que te hayan sido asignadas por el maitre o que tengas reservadas.",
        };
      }
    }

    // 4. Verificar si hay una reserva para esta mesa y validar el horario
    // (Movemos esto ANTES de verificar is_occupied porque los usuarios con reserva
    // deben poder escanear el QR para recibir mensajes de llegada temprana/tardía)
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
    
    const reservation = await ReservationsService.getTableReservationForDate(
      table.id.toString(),
      dateString
    );

    if (reservation) {
      console.log("📅 Mesa tiene reserva:", reservation);
      
      // Verificar que el cliente que escanea sea el dueño de la reserva
      if (reservation.user_id !== clientId) {
        console.log("⚠️ Cliente no es dueño de la reserva");
        throw {
          status: 403,
          message: `Esta mesa está reservada a nombre de ${reservation.user_name}. No puedes ocuparla.`,
          reservedFor: reservation.user_name
        };
      }

      // Obtener hora de reserva
      const [resHours, resMinutes] = reservation.time.split(':').map(Number);
      const reservationTimeInMinutes = (resHours ?? 0) * 60 + (resMinutes ?? 0);

      // Ventanas de tiempo:
      // - Activación temprana: -45min antes de la hora de reserva
      // - Ventana de confirmación: desde la hora de reserva hasta +45min
      const earlyActivationTime = reservationTimeInMinutes - 45; // 19:15 para reserva de 20:00
      const confirmationStartTime = reservationTimeInMinutes; // 20:00
      const latestValidTime = reservationTimeInMinutes + 45; // 20:45

      console.log(`⏰ Hora actual: ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')} (${currentTimeInMinutes} mins)`);
      console.log(`📋 Hora reserva: ${reservation.time} (${reservationTimeInMinutes} mins)`);
      console.log(`🕐 Activación temprana desde: ${Math.floor(earlyActivationTime/60)}:${(earlyActivationTime%60).toString().padStart(2,'0')}`);
      console.log(`🕐 Ventana confirmación: ${Math.floor(confirmationStartTime/60)}:${(confirmationStartTime%60).toString().padStart(2,'0')} - ${Math.floor(latestValidTime/60)}:${(latestValidTime%60).toString().padStart(2,'0')}`);

      // CASO 1: Llega temprano (19:15-19:59 para reserva de 20:00)
      if (currentTimeInMinutes >= earlyActivationTime && currentTimeInMinutes < confirmationStartTime) {
        console.log("⏰ Cliente llegó en ventana temprana (antes de hora de reserva)");
        
        // Solo informarle, NO crear waiting_list todavía
        // La waiting_list se creará cuando llegue en el horario correcto
        return {
          success: false,
          earlyArrival: true,
          reservationTime: reservation.time.substring(0, 5),
          userName: reservation.user_name,
          message: `¡Bienvenido/a ${reservation.user_name}! Tu mesa está reservada para las ${reservation.time.substring(0, 5)}hs. Por favor, vuelve a escanear el QR a partir de esa hora para confirmar tu llegada.`,
        };
      }

      // CASO 2: Llega en la ventana correcta (hora reserva hasta +45min)
      if (currentTimeInMinutes >= confirmationStartTime && currentTimeInMinutes <= latestValidTime) {
        console.log("✅ Cliente llegó en el horario correcto de su reserva");
        
        // Crear waiting_list con status='seated' directamente
        // Verificar si ya existe una entrada
        const { data: existingWaiting } = await supabaseAdmin
          .from('waiting_list')
          .select('id, status')
          .eq('client_id', clientId)
          .single();

        if (!existingWaiting) {
          // Crear waiting_list con status 'seated'
          const { data: fullReservation } = await supabaseAdmin
            .from('reservations')
            .select('party_size')
            .eq('id', reservation.id)
            .single();

          await supabaseAdmin
            .from('waiting_list')
            .insert({
              client_id: clientId,
              party_size: fullReservation?.party_size || 2,
              status: 'seated',
              priority: 10,
              joined_at: new Date().toISOString(),
              seated_at: new Date().toISOString()
            });
          
          console.log("✅ Waiting_list creado con status='seated' para cliente con reserva");
        } else if (existingWaiting.status !== 'seated') {
          // Si existe pero no está como seated, actualizarlo
          await supabaseAdmin
            .from('waiting_list')
            .update({
              status: 'seated',
              seated_at: new Date().toISOString()
            })
            .eq('id', existingWaiting.id);
          
          console.log("✅ Waiting_list actualizado a status='seated'");
        }
        
        // Continuar con la activación normal (se hace más abajo)
      } else if (currentTimeInMinutes < earlyActivationTime) {
        // CASO 3: Intenta confirmar MUY temprano (antes de -45min)
        console.log("❌ Cliente intentó confirmar demasiado temprano");
        return {
          success: false,
          message: `Tu reserva es para las ${reservation.time.substring(0, 5)}hs. Podrás escanear el QR a partir de las ${Math.floor(earlyActivationTime/60)}:${(earlyActivationTime%60).toString().padStart(2,'0')}hs.`,
        };
      }
    } else {
      // Si NO tiene reserva, verificar que la mesa no esté ocupada
      if (table.is_occupied) {
        console.log("⚠️ Mesa ya está ocupada (sin reserva)");
        return { success: false, message: "La mesa ya está activa" };
      }
    }

    console.log("✅ Validaciones pasadas, verificando disponibilidad de mesa...");

    // 4.9. Verificar que la mesa esté libre antes de activar
    if (table.is_occupied) {
      console.log("⚠️ Mesa ocupada por otro cliente");
      
      // Si tiene reserva, dar mensaje específico
      if (reservation) {
        return {
          success: false,
          message: `Tu mesa está actualmente ocupada por otro cliente. Por favor, espera a que se libere o contacta al personal.`,
        };
      }
      
      return { success: false, message: "La mesa ya está activa" };
    }

    // 5. Asignar id_client si no estaba asignado (para reservas)
    if (!table.id_client || table.id_client !== clientId) {
      console.log("📝 Asignando id_client antes de activar...");
      const { error: assignError } = await supabaseAdmin
        .from("tables")
        .update({
          id_client: clientId
        })
        .eq("id", table.id);

      if (assignError) {
        console.error("❌ Error asignando id_client:", assignError);
        return {
          success: false,
          message: "Error al asignar la mesa"
        };
      }
      console.log("✅ id_client asignado");
    }

    // 6. Activar la mesa: is_occupied=true y table_status='pending'
    const { error: updateError } = await supabaseAdmin
      .from("tables")
      .update({
        is_occupied: true,
        table_status: 'pending'
      })
      .eq("id", table.id);

    if (updateError) {
      console.error("❌ Error activando mesa:", updateError);
      throw new Error(`Error activando mesa: ${updateError.message}`);
    }

    console.log("✅ Mesa activada exitosamente");

    // 6.5. Si había una reserva, marcarla como 'completed'
    if (reservation) {
      try {
        const { error: updateReservationError } = await supabaseAdmin
          .from("reservations")
          .update({ status: "completed" })
          .eq("id", reservation.id);

        if (updateReservationError) {
          console.error("❌ Error actualizando reserva a completed:", updateReservationError);
        } else {
          console.log(`✅ Reserva ${reservation.id} marcada como completed`);
        }
      } catch (reservationUpdateError) {
        console.error("❌ Error actualizando reserva:", reservationUpdateError);
      }
    }

    // 7. Actualizar el client_id en la tabla chats si existe un chat activo para esta mesa
    try {
      const { data: existingChat, error: chatError } = await supabaseAdmin
        .from("chats")
        .select("id, client_id")
        .eq("table_id", table.id)
        .eq("is_active", true)
        .single();

      if (!chatError && existingChat) {
        // Si existe un chat activo y no tiene client_id o es diferente, actualizarlo
        if (!existingChat.client_id || existingChat.client_id !== clientId) {
          const { error: updateChatError } = await supabaseAdmin
            .from("chats")
            .update({ client_id: clientId })
            .eq("id", existingChat.id);

          if (updateChatError) {
            console.error(
              "Error actualizando client_id en chat:",
              updateChatError,
            );
            // No lanzar error porque la mesa se activó correctamente
          } else {
            console.log(
              `✅ Chat actualizado con client_id para mesa ${table.number}`,
            );
          }
        }
      }
    } catch (chatUpdateError) {
      console.error("Error buscando/actualizando chat:", chatUpdateError);
      // No lanzar error porque la mesa se activó correctamente
    }

    return {
      success: true,
      message: `Mesa ${table.number} activada exitosamente. ¡Bienvenido a The Last Dance!`,
      table: {
        id: table.id,
        table_number: table.number,
        is_occupied: true,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Error interno del servidor",
    };
  }
}

// Liberar una mesa
export async function freeTable(
  tableId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Obtener información de la mesa antes de liberarla
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id, number, id_client")
      .eq("id", tableId)
      .single();

    if (tableError || !table) {
      throw new Error("Mesa no encontrada");
    }

    const clientId = table.id_client;

    // 2. Liberar la mesa
    const { error: updateError } = await supabaseAdmin
      .from("tables")
      .update({
        is_occupied: false,
        id_client: null,
      })
      .eq("id", tableId);

    if (updateError) {
      throw new Error(`Error liberando mesa: ${updateError.message}`);
    }

    // 3. Si había un cliente asignado, actualizar su estado en waiting_list
    if (clientId) {
      // Buscar la entrada más reciente del cliente en waiting_list
      const { data: waitingEntry, error: waitingError } = await supabaseAdmin
        .from("waiting_list")
        .select("id, status, client_id")
        .eq("client_id", clientId)
        .order("seated_at", { ascending: false })
        .limit(1)
        .single();

      console.log(`Error en búsqueda:`, waitingError);

      if (waitingError) {
        console.warn(
          "Error buscando entrada en waiting_list:",
          waitingError.message,
        );
      } else if (waitingEntry) {
        // Si el cliente tenía estado 'seated', cambiarlo a 'displaced'
        // (indica que fue removido por staff, no por cancelación propia)
        if (waitingEntry.status === "seated") {
          const { error: statusUpdateError } = await supabaseAdmin
            .from("waiting_list")
            .update({
              status: "displaced",
              updated_at: new Date().toISOString(),
            })
            .eq("id", waitingEntry.id);

          if (statusUpdateError) {
            console.error(
              "ERROR actualizando estado en waiting_list:",
              statusUpdateError.message,
            );
          } else {
            console.log(
              `✅ Cliente ${clientId} cambiado de 'seated' a 'displaced' exitosamente`,
            );
          }
        } else {
          console.log(
            `Cliente tiene estado '${waitingEntry.status}', no se requiere cambio`,
          );
        }
      } else {
        console.warn(
          `No se encontró entrada en waiting_list para cliente ${clientId}`,
        );
      }
    } else {
    }

    return { success: true, message: "Mesa liberada exitosamente" };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Error interno del servidor",
    };
  }
}

// Cancelar reserva asociada a una mesa
export async function cancelTableReservation(
  tableId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Buscar reservas approved para hoy en esta mesa
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "America/Argentina/Buenos_Aires",
    });

    const { data: reservations, error: reservationError } = await supabaseAdmin
      .from("reservations")
      .select("id, user_id, time, status")
      .eq("table_id", tableId)
      .eq("date", today)
      .eq("status", "approved")
      .order("time", { ascending: true }); // Ordenar por hora, más temprana primero

    if (reservationError || !reservations || reservations.length === 0) {
      console.error("Error buscando reservas:", reservationError);
      return {
        success: false,
        message: "No se encontró una reserva activa para esta mesa",
      };
    }

    // Obtener la reserva MÁS PRÓXIMA (la primera en el tiempo)
    // Esto coincide con lo que muestra getTablesStatus()
    const reservation = reservations[0];
    
    if (!reservation) {
      return {
        success: false,
        message: "No se encontró una reserva activa para esta mesa",
      };
    }
    
    console.log(`🔍 Cancelando reserva más próxima para mesa ${tableId}:`, {
      reservationId: reservation.id,
      time: reservation.time,
      totalReservations: reservations.length
    });

    // 2. Cancelar la reserva
    const { error: updateError } = await supabaseAdmin
      .from("reservations")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", reservation.id);

    if (updateError) {
      throw new Error(`Error cancelando reserva: ${updateError.message}`);
    }

    console.log(`✅ Reserva ${reservation.id} cancelada por staff (Maitre)`);

    return {
      success: true,
      message: `Reserva para las ${reservation.time} cancelada exitosamente`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Error interno del servidor",
    };
  }
}

// Cancelar entrada en lista de espera
export async function cancelWaitingListEntry(
  waitingListId: string,
  reason?: string,
  userId?: string,
  isStaff?: boolean,
): Promise<{ success: boolean; message: string }> {
  try {
    // Si no es staff, verificar que sea el dueño de la entrada
    if (!isStaff && userId) {
      const { data: entry, error: selectError } = await supabaseAdmin
        .from("waiting_list")
        .select("client_id")
        .eq("id", waitingListId)
        .eq("status", "waiting")
        .single();

      if (selectError) {
        console.error("Error en select:", selectError);
        throw new Error(`Error buscando entrada: ${selectError.message}`);
      }

      if (!entry) {
        return {
          success: false,
          message: "Entrada no encontrada o ya procesada",
        };
      }

      console.log(
        "Comparando client_id:",
        entry.client_id,
        "vs userId:",
        userId,
      );

      if (entry.client_id !== userId) {
        return {
          success: false,
          message: "No tienes permisos para cancelar esta entrada",
        };
      }
    }

    const { error } = await supabaseAdmin
      .from("waiting_list")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
        special_requests: reason ? `${reason}` : undefined,
      })
      .eq("id", waitingListId)
      .eq("status", "waiting");

    if (error) {
      throw new Error(`Error cancelando entrada: ${error.message}`);
    }

    return { success: true, message: "Entrada cancelada exitosamente" };
  } catch (error: any) {
    console.error("ERROR en cancelWaitingListEntry:", error);
    return {
      success: false,
      message: error.message || "Error interno del servidor",
    };
  }
}

// Marcar como no show
export async function markAsNoShow(
  waitingListId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabaseAdmin
      .from("waiting_list")
      .update({
        status: "no_show",
        updated_at: new Date().toISOString(),
      })
      .eq("id", waitingListId)
      .eq("status", "waiting");

    if (error) {
      throw new Error(`Error marcando como no show: ${error.message}`);
    }

    return { success: true, message: "Marcado como no show" };
  } catch (error: any) {
    return {
      success: false,
      message: error.message || "Error interno del servidor",
    };
  }
}

// Confirmar entrega de pedido de una mesa
export async function confirmTableDelivery(
  tableIdOrNumber: string,
  clientId: string,
): Promise<{ success: boolean; message: string; table?: any }> {
  try {
    console.log(
      "📦 confirmTableDelivery - Confirmando entrega para mesa:",
      tableIdOrNumber,
      "cliente:",
      clientId,
    );

    // Intentar buscar la mesa por ID (UUID) o por número
    let table: any = null;
    let tableError: any = null;

    // Primero intentar como UUID (si tiene formato de UUID)
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        tableIdOrNumber,
      );

    if (isUUID) {
      const { data: tableById, error: errorById } = await supabaseAdmin
        .from("tables")
        .select("id, number, id_client, is_occupied, table_status")
        .eq("id", tableIdOrNumber)
        .eq("id_client", clientId)
        .eq("is_occupied", true)
        .single();

      table = tableById;
      tableError = errorById;
    } else {
      // Si no es UUID, buscar por número de mesa
      const { data: tableByNumber, error: errorByNumber } = await supabaseAdmin
        .from("tables")
        .select("id, number, id_client, is_occupied, table_status")
        .eq("number", parseInt(tableIdOrNumber))
        .eq("id_client", clientId)
        .eq("is_occupied", true)
        .single();

      table = tableByNumber;
      tableError = errorByNumber;
    }

    if (tableError || !table) {
      console.log(
        "❌ confirmTableDelivery - Mesa no encontrada o no pertenece al cliente",
      );
      return {
        success: false,
        message:
          "Mesa no encontrada o no tienes permisos para confirmar entrega en esta mesa",
      };
    }

    // 2. Verificar que el status actual sea 'pending' (no 'delivered' como antes)
    if (table.table_status !== "pending") {
      console.log(
        "❌ confirmTableDelivery - Mesa no está en estado pending, estado actual:",
        table.table_status,
      );
      return {
        success: false,
        message: "Esta mesa ya tiene el pedido confirmado",
      };
    }

    // 3. Verificar que todos los items estén realmente entregados antes de confirmar
    console.log(
      "🔍 Verificando que todos los items estén entregados antes de confirmar...",
    );

    // Usar la función existente para verificar el estado de entrega
    const { checkAllItemsDelivered } = await import("../orders/ordersServices");
    const deliveryCheck = await checkAllItemsDelivered(table.id, clientId);

    if (!deliveryCheck.allDelivered) {
      console.log(
        "❌ confirmTableDelivery - No todos los items están entregados",
      );
      return {
        success: false,
        message: `Aún tienes ${deliveryCheck.pendingItems.length} items pendientes de entrega. Espera a que el mozo entregue todo antes de confirmar.`,
      };
    }

    // 4. Actualizar el status a 'confirmed'
    const { data: updatedTable, error: updateError } = await supabaseAdmin
      .from("tables")
      .update({
        table_status: "confirmed",
      })
      .eq("id", table.id)
      .select()
      .single();

    if (updateError) {
      console.error(
        "❌ confirmTableDelivery - Error actualizando status:",
        updateError,
      );
      throw new Error(`Error confirmando entrega: ${updateError.message}`);
    }

    console.log(
      "✅ confirmTableDelivery - Entrega confirmada exitosamente para mesa:",
      table.number,
    );

    return {
      success: true,
      message: `Entrega confirmada para la mesa ${table.number}`,
      table: updatedTable,
    };
  } catch (error: any) {
    console.error("💥 confirmTableDelivery - Error:", error);
    return {
      success: false,
      message: error.message || "Error interno del servidor",
    };
  }
}
