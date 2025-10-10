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

// ========== SERVICIOS PARA LISTA DE ESPERA ==========

// Obtener lista de espera completa para el maitre
export async function getWaitingList(): Promise<WaitingListResponse> {
  console.log('📋 getWaitingList - Iniciando consulta de lista de espera');
  
  // Primero obtenemos las entradas de waiting_list
  const { data: waitingEntries, error: waitingError } = await supabaseAdmin
    .from("waiting_list")
    .select("*")
    .eq("status", "waiting")
    .order("priority", { ascending: false })
    .order("joined_at", { ascending: true });

  console.log('📋 getWaitingList - Entradas waiting_list:', { 
    dataLength: waitingEntries?.length, 
    error: waitingError?.message 
  });

  if (waitingError) {
    console.error('📋 getWaitingList - Error en waiting_list:', waitingError);
    throw new Error(`Error obteniendo lista de espera: ${waitingError.message}`);
  }

  if (!waitingEntries || waitingEntries.length === 0) {
    console.log('📋 getWaitingList - No hay entradas en waiting_list');
    return {
      waiting_list: [],
      total_waiting: 0,
    };
  }

  // Obtener IDs de clientes únicos
  const clientIds = [...new Set(waitingEntries.map(entry => entry.client_id))];
  console.log('📋 getWaitingList - IDs de clientes:', clientIds);

  // Consultar usuarios por separado
  const { data: users, error: usersError } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, profile_image, profile_code")
    .in("id", clientIds);

  console.log('📋 getWaitingList - Usuarios obtenidos:', { 
    usersLength: users?.length, 
    error: usersError?.message,
    users: users?.map(u => ({ id: u.id, name: `${u.first_name} ${u.last_name}`, profile_code: u.profile_code }))
  });

  if (usersError) {
    console.error('📋 getWaitingList - Error obteniendo usuarios:', usersError);
    throw new Error(`Error obteniendo usuarios: ${usersError.message}`);
  }

  // Combinar los datos
  const waitingList: WaitingListWithUser[] = waitingEntries.map(entry => {
    const user = users?.find(u => u.id === entry.client_id);
    return {
      ...entry,
      users: user ? {
        first_name: user.first_name,
        last_name: user.last_name,
        profile_image: user.profile_image,
        profile_code: user.profile_code,
      } : {
        first_name: 'Usuario',
        last_name: 'Desconocido',
        profile_code: 'cliente_registrado',
      }
    };
  });

  console.log('📋 getWaitingList - Lista combinada:', waitingList.length, 'entradas');

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
  console.log('📍 getClientPosition - Calculando posición para cliente:', clientId);
  
  const { data: clientEntry } = await supabaseAdmin
    .from("waiting_list")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "waiting")
    .single();

  console.log('📍 getClientPosition - Entrada del cliente:', clientEntry);

  if (!clientEntry) {
    console.log('📍 getClientPosition - Cliente no encontrado en waiting_list');
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
  console.log('📍 getClientPosition - Posición calculada:', position);

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

  console.log('📍 getClientPosition - Tiempo estimado:', estimatedWait);

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
    console.log("Buscando información de clientes para IDs:", clientIds);

    const { data: clients, error: clientsError } = await supabaseAdmin
      .from("users")
      .select("id, first_name, last_name, profile_image, profile_code")
      .in("id", clientIds);

    console.log("Datos de clientes obtenidos:", clients);

    if (clientsError) {
      console.warn("Error obteniendo datos de clientes:", clientsError.message);
    } else {
      clientsData = clients || [];
    }
  }

  // Mapear los datos para incluir información del cliente
  const tables: TableWithClient[] = tablesData.map(table => {
    const client = table.id_client
      ? clientsData.find(c => c.id === table.id_client)
      : undefined;

    return {
      ...table,
      client,
    };
  });
  const occupiedCount = tables.filter(t => t.is_occupied).length;
  const assignedCount = tables.filter(
    t => t.id_client && !t.is_occupied,
  ).length;
  const unavailableCount = tables.filter(
    t => t.is_occupied || t.id_client,
  ).length;
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const occupiedCapacity = tables
    .filter(t => t.is_occupied)
    .reduce((sum, t) => sum + t.capacity, 0);
  const assignedCapacity = tables
    .filter(t => t.id_client && !t.is_occupied)
    .reduce((sum, t) => sum + t.capacity, 0);

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
      console.log('❌ [assignClientToTable] Cliente no encontrado en lista de espera');
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
      console.log('❌ [assignClientToTable] Mesa no disponible');
      return {
        success: false,
        message: "Mesa no disponible o ya asignada a otro cliente",
      };
    }

    // 3. Verificar capacidad
    if (waitingEntry.party_size > table.capacity) {
      console.log('❌ [assignClientToTable] Mesa muy pequeña', {
        party_size: waitingEntry.party_size,
        capacity: table.capacity
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
      console.log('❌ [assignClientToTable] Error actualizando waiting list');
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
    console.log('💥 [assignClientToTable] Error en asignación:', {
      error: error.message,
      stack: error.stack
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
): Promise<{ success: boolean; message: string; table?: any }> {
  try {
    // 1. Verificar si el cliente ya tiene una mesa ocupada
    const { data: existingOccupiedTable, error: existingError } =
      await supabaseAdmin
        .from("tables")
        .select("id, number, is_occupied")
        .eq("id_client", clientId)
        .eq("is_occupied", true)
        .limit(1);

    if (existingError) {
      throw new Error(
        `Error verificando mesas ocupadas: ${existingError.message}`,
      );
    }

    if (existingOccupiedTable && existingOccupiedTable.length > 0) {
      const occupiedTable = existingOccupiedTable[0];
      return {
        success: false,
        message: `Ya tienes la mesa ${occupiedTable?.number || "una mesa"} ocupada. Solo puedes tener una mesa activa a la vez.`,
      };
    }

    // 2. Verificar que la mesa esté asignada al cliente pero no ocupada
    // Intentar buscar por ID primero, luego por número si falla
    let table: any = null;
    let tableError: any = null;

    // Intentar como ID numérico
    if (!isNaN(Number(tableIdOrNumber))) {
      const { data: tableById, error: errorById } = await supabaseAdmin
        .from("tables")
        .select("id, number, id_client, is_occupied")
        .eq("id", Number(tableIdOrNumber))
        .single();

      if (!errorById && tableById) {
        table = tableById;
      } else {
        // Si falló como ID, intentar como número de mesa
        const { data: tableByNumber, error: errorByNumber } =
          await supabaseAdmin
            .from("tables")
            .select("id, number, id_client, is_occupied")
            .eq("number", Number(tableIdOrNumber))
            .single();

        table = tableByNumber;
        tableError = errorByNumber;
      }
    } else {
      // Si no es numérico, solo intentar como número
      const { data: tableByNumber, error: errorByNumber } = await supabaseAdmin
        .from("tables")
        .select("id, number, id_client, is_occupied")
        .eq("number", Number(tableIdOrNumber))
        .single();

      table = tableByNumber;
      tableError = errorByNumber;
    }

    if (tableError || !table) {
      return { success: false, message: "Mesa no encontrada" };
    }

    // 3. Verificar que la mesa esté asignada al cliente correcto
    if (table.id_client !== clientId) {
      return {
        success: false,
        message:
          "Esta mesa no está asignada a tu usuario. Solo puedes activar mesas que te hayan sido asignadas por el maitre.",
      };
    }

    // 4. Verificar que no esté ya ocupada
    if (table.is_occupied) {
      return { success: false, message: "La mesa ya está activa" };
    }

    // 5. Activar la mesa
    const { error: updateError } = await supabaseAdmin
      .from("tables")
      .update({
        is_occupied: true,
      })
      .eq("id", table.id);

    if (updateError) {
      throw new Error(`Error activando mesa: ${updateError.message}`);
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
      console.log(`=== LIBERANDO MESA - ACTUALIZANDO CLIENTE ===`);
      console.log(`Cliente ID: ${clientId}`);
      console.log(`Mesa número: ${table.number}`);

      // Buscar la entrada más reciente del cliente en waiting_list
      const { data: waitingEntry, error: waitingError } = await supabaseAdmin
        .from("waiting_list")
        .select("id, status, client_id")
        .eq("client_id", clientId)
        .order("seated_at", { ascending: false })
        .limit(1)
        .single();

      console.log(`Entrada en waiting_list encontrada:`, waitingEntry);
      console.log(`Error en búsqueda:`, waitingError);

      if (waitingError) {
        console.warn(
          "Error buscando entrada en waiting_list:",
          waitingError.message,
        );
      } else if (waitingEntry) {
        console.log(`Estado actual del cliente: ${waitingEntry.status}`);

        // Si el cliente tenía estado 'seated', cambiarlo a 'displaced'
        // (indica que fue removido por staff, no por cancelación propia)
        if (waitingEntry.status === "seated") {
          console.log(`Cambiando estado de 'seated' a 'displaced'...`);

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
      console.log(`Mesa ${table.number} no tenía cliente asignado`);
    }

    return { success: true, message: "Mesa liberada exitosamente" };
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
    console.log("=== SERVICIO CANCELAR ENTRADA ===");
    console.log("Parámetros:", { waitingListId, reason, userId, isStaff });

    // Si no es staff, verificar que sea el dueño de la entrada
    if (!isStaff && userId) {
      console.log("Verificando permisos para usuario no-staff...");

      const { data: entry, error: selectError } = await supabaseAdmin
        .from("waiting_list")
        .select("client_id")
        .eq("id", waitingListId)
        .eq("status", "waiting")
        .single();

      console.log("Resultado de búsqueda de entrada:", { entry, selectError });

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

    console.log("Procediendo a cancelar entrada...");

    const { error } = await supabaseAdmin
      .from("waiting_list")
      .update({
        status: "cancelled",
        updated_at: new Date().toISOString(),
        special_requests: reason ? `${reason}` : undefined,
      })
      .eq("id", waitingListId)
      .eq("status", "waiting");

    console.log("Resultado de update:", { error });

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
