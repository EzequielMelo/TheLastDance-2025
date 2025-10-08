import { supabaseAdmin } from "../../config/supabase";

// Tipos para meseros
export interface WaiterTable {
  id: string;
  number: number;
  capacity: number;
  type: string;
  is_occupied: boolean;
  id_client: string | null;
  id_waiter: string | null;
  photo_url: string;
  qr_url: string;
}

export interface WaiterInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_image?: string;
  assigned_tables: WaiterTable[];
  available_slots: number;
}

// Obtener información completa del mesero (perfil + mesas asignadas)
export async function getWaiterInfo(
  waiterId: string,
): Promise<WaiterInfo | null> {
  // Verificar que es un mesero
  const { data: waiter, error: waiterError } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, profile_image, position_code")
    .eq("id", waiterId)
    .eq("position_code", "mozo")
    .single();

  if (waiterError || !waiter) {
    return null;
  }

  // Obtener mesas asignadas al mesero
  const { data: tables, error: tablesError } = await supabaseAdmin
    .from("tables")
    .select("*")
    .eq("id_waiter", waiterId)
    .order("number", { ascending: true });

  if (tablesError) {
    throw new Error(
      `Error obteniendo mesas del mesero: ${tablesError.message}`,
    );
  }

  return {
    id: waiter.id,
    first_name: waiter.first_name,
    last_name: waiter.last_name,
    profile_image: waiter.profile_image,
    assigned_tables: tables || [],
    available_slots: 3 - (tables?.length || 0),
  };
}

// Obtener todas las mesas disponibles para asignar (sin mesero y sin cliente)
export async function getAvailableTablesForAssignment(): Promise<
  WaiterTable[]
> {
  const { data, error } = await supabaseAdmin
    .from("tables")
    .select("*")
    .is("id_waiter", null)
    .eq("is_occupied", false)
    .is("id_client", null)
    .order("number", { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo mesas disponibles: ${error.message}`);
  }

  return data || [];
}

// Asignar mesa a mesero
export async function assignTableToWaiter(
  waiterId: string,
  tableId: string,
): Promise<void> {
  // Verificar que es un mesero válido
  const waiterInfo = await getWaiterInfo(waiterId);
  if (!waiterInfo) {
    throw new Error("Mesero no encontrado o no válido");
  }

  // Verificar que el mesero no tenga ya 3 mesas asignadas
  if (waiterInfo.available_slots <= 0) {
    throw new Error("El mesero ya tiene el máximo de mesas asignadas (3)");
  }

  // Verificar que la mesa existe y está disponible para asignar
  const { data: table, error: tableError } = await supabaseAdmin
    .from("tables")
    .select("*")
    .eq("id", tableId)
    .is("id_waiter", null)
    .eq("is_occupied", false)
    .is("id_client", null)
    .single();

  if (tableError || !table) {
    throw new Error("Mesa no encontrada o no disponible para asignar");
  }

  // Asignar mesa al mesero
  const { error: assignError } = await supabaseAdmin
    .from("tables")
    .update({ id_waiter: waiterId })
    .eq("id", tableId);

  if (assignError) {
    throw new Error(`Error asignando mesa: ${assignError.message}`);
  }
}

// Desasignar mesa de mesero
export async function unassignTableFromWaiter(
  waiterId: string,
  tableId: string,
): Promise<void> {
  // Verificar que la mesa está asignada al mesero especificado
  const { data: table, error: tableError } = await supabaseAdmin
    .from("tables")
    .select("*")
    .eq("id", tableId)
    .eq("id_waiter", waiterId)
    .single();

  if (tableError || !table) {
    throw new Error("Mesa no encontrada o no asignada a este mesero");
  }

  // Verificar que la mesa no tiene cliente asignado ni está ocupada
  if (table.is_occupied || table.id_client) {
    throw new Error(
      "No se puede desasignar una mesa que tiene cliente asignado o está ocupada",
    );
  }

  // Desasignar mesa
  const { error: unassignError } = await supabaseAdmin
    .from("tables")
    .update({ id_waiter: null })
    .eq("id", tableId);

  if (unassignError) {
    throw new Error(`Error desasignando mesa: ${unassignError.message}`);
  }
}

// Obtener todos los meseros con sus mesas asignadas
export async function getAllWaitersWithTables(): Promise<WaiterInfo[]> {
  // Obtener todos los meseros
  const { data: waiters, error: waitersError } = await supabaseAdmin
    .from("users")
    .select("id, first_name, last_name, profile_image")
    .eq("position_code", "mozo")
    .eq("state", "aprobado")
    .order("first_name", { ascending: true });

  if (waitersError) {
    throw new Error(`Error obteniendo meseros: ${waitersError.message}`);
  }

  if (!waiters || waiters.length === 0) {
    return [];
  }

  // Para cada mesero, obtener sus mesas asignadas
  const waitersWithTables = await Promise.all(
    waiters.map(async waiter => {
      const { data: tables, error: tablesError } = await supabaseAdmin
        .from("tables")
        .select("*")
        .eq("id_waiter", waiter.id)
        .order("number", { ascending: true });

      if (tablesError) {
        throw new Error(
          `Error obteniendo mesas del mesero ${waiter.id}: ${tablesError.message}`,
        );
      }

      return {
        id: waiter.id,
        first_name: waiter.first_name,
        last_name: waiter.last_name,
        profile_image: waiter.profile_image,
        assigned_tables: tables || [],
        available_slots: 3 - (tables?.length || 0),
      };
    }),
  );

  return waitersWithTables;
}

// Verificar si una mesa puede ser desasignada
export async function canUnassignTable(tableId: string): Promise<boolean> {
  const { data: table, error } = await supabaseAdmin
    .from("tables")
    .select("is_occupied, id_client")
    .eq("id", tableId)
    .single();

  if (error || !table) {
    return false;
  }

  // Solo se puede desasignar si no está ocupada y no tiene cliente asignado
  return !table.is_occupied && !table.id_client;
}
