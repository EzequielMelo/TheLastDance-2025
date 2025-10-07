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
  const { data, error } = await supabaseAdmin
    .from("waiting_list")
    .select(
      `
      *,
      users!waiting_list_client_id_fkey(
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .eq("status", "waiting")
    .order("priority", { ascending: false })
    .order("joined_at", { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo lista de espera: ${error.message}`);
  }

  const waitingList = (data || []) as WaitingListWithUser[];

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
  const { data, error } = await supabaseAdmin
    .from("tables")
    .select("*")
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo estado de mesas: ${error.message}`);
  }

  // Por ahora no incluimos información del cliente para evitar problemas de FK
  const tables: TableWithClient[] = data.map(table => ({
    ...table,
    // Si hay client_id, podríamos hacer una consulta separada aquí
    client: undefined,
  }));
  const occupiedCount = tables.filter(t => t.is_occupied).length;
  const totalCapacity = tables.reduce((sum, t) => sum + t.capacity, 0);
  const occupiedCapacity = tables
    .filter(t => t.is_occupied)
    .reduce((sum, t) => sum + t.capacity, 0);

  return {
    tables,
    occupied_count: occupiedCount,
    available_count: tables.length - occupiedCount,
    total_capacity: totalCapacity,
    occupied_capacity: occupiedCapacity,
  };
}

// Asignar cliente de la lista de espera a una mesa
export async function assignClientToTable({
  waiting_list_id,
  table_id,
}: AssignTableRequest): Promise<{ success: boolean; message: string }> {
  try {
    // 1. Verificar que el cliente esté en la lista de espera
    const { data: waitingEntry, error: waitingError } = await supabaseAdmin
      .from("waiting_list")
      .select("client_id, party_size, status")
      .eq("id", waiting_list_id)
      .eq("status", "waiting")
      .single();

    if (waitingError || !waitingEntry) {
      return {
        success: false,
        message: "Cliente no encontrado en la lista de espera",
      };
    }

    // 2. Verificar que la mesa esté disponible
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id, capacity, is_occupied")
      .eq("id", table_id)
      .eq("is_occupied", false)
      .single();

    if (tableError || !table) {
      return { success: false, message: "Mesa no disponible" };
    }

    // 3. Verificar capacidad
    if (waitingEntry.party_size > table.capacity) {
      return {
        success: false,
        message: `Mesa muy pequeña. Capacidad: ${table.capacity}, Grupo: ${waitingEntry.party_size}`,
      };
    }

    // 4. Actualizar lista de espera
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

    // 5. Ocupar mesa
    const { error: updateTableError } = await supabaseAdmin
      .from("tables")
      .update({
        is_occupied: true,
        id_client: waitingEntry.client_id,
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

      throw new Error(`Error ocupando mesa: ${updateTableError.message}`);
    }

    return { success: true, message: "Cliente asignado exitosamente" };
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
    const { error } = await supabaseAdmin
      .from("tables")
      .update({
        is_occupied: false,
        id_client: null,
      })
      .eq("id", tableId);

    if (error) {
      throw new Error(`Error liberando mesa: ${error.message}`);
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
