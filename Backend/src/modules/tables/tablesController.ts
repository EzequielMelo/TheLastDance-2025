import type { Request, Response } from "express";
import { supabaseAdmin } from "../../config/supabase";
import {
  getWaitingList,
  addToWaitingList,
  getClientPosition,
  getTablesStatus,
  assignClientToTable,
  activateTableByClient,
  freeTable,
  cancelWaitingListEntry,
  markAsNoShow,
} from "./tablesServices";
import type {
  CreateWaitingListEntry,
  AssignTableRequest,
} from "./tables.types";
import {
  notifyMaitreNewWaitingClient,
  notifyClientTableAssigned,
} from "../../services/pushNotificationService";

// ========== CONTROLADORES PARA LISTA DE ESPERA ==========

// GET /api/tables/waiting-list - Obtener lista de espera (para maitre)
export async function getWaitingListHandler(_req: Request, res: Response) {
  try {
    const result = await getWaitingList();
    return res.json(result);
  } catch (e: any) {
    console.error("📋 getWaitingListHandler - Error:", e.message);
    return res.status(400).json({ error: e.message });
  }
}

// POST /api/tables/waiting-list - Agregar cliente a lista de espera
export async function addToWaitingListHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const entryData: CreateWaitingListEntry = {
      client_id: req.body.client_id || req.user.appUserId,
      party_size: parseInt(req.body.party_size),
      preferred_table_type: req.body.preferred_table_type,
      special_requests: req.body.special_requests,
      priority: req.body.priority || 0,
    };

    // Validaciones
    if (!entryData.party_size || entryData.party_size < 1) {
      return res.status(400).json({ error: "Tamaño del grupo inválido" });
    }

    if (
      entryData.preferred_table_type &&
      !["vip", "estandar", "accesible"].includes(entryData.preferred_table_type)
    ) {
      return res.status(400).json({ error: "Tipo de mesa inválido" });
    }

    const result = await addToWaitingList(entryData);

    // Notificar al maître sobre el nuevo cliente en lista de espera
    try {
      // Obtener el nombre del cliente para la notificación
      const { data: clientData } = await supabaseAdmin
        .from("users")
        .select("name")
        .eq("id", entryData.client_id)
        .single();

      const clientName = clientData?.name || "Cliente";
      await notifyMaitreNewWaitingClient(
        clientName,
        entryData.party_size,
        entryData.preferred_table_type,
      );
    } catch (notifyError) {
      console.error("Error enviando notificación al maître:", notifyError);
      // No bloqueamos la respuesta por error de notificación
    }

    return res.status(201).json({
      message: "Agregado a la lista de espera exitosamente",
      data: result,
    });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

// GET /api/tables/waiting-list/my-position - Obtener posición del cliente actual
export async function getMyPositionHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const result = await getClientPosition(req.user.appUserId);
    return res.json(result);
  } catch (e: any) {
    // Este es un caso normal cuando el usuario no está en la lista
    if (e.message.includes("no encontrado")) {
      console.log(
        `Usuario ${req.user?.appUserId} no está en la lista de espera`,
      );
      return res.json({
        inQueue: false,
        message: "No estás en la lista de espera",
      });
    } else {
      console.error("Error obteniendo posición:", e.message);
      return res.status(500).json({ error: "Error interno del servidor" });
    }
  }
}

// GET /api/tables/waiting-list/position/:clientId - Obtener posición de cliente específico
export async function getClientPositionHandler(req: Request, res: Response) {
  try {
    const clientId = req.params["clientId"];
    if (!clientId) {
      return res.status(400).json({ error: "ID de cliente requerido" });
    }

    const result = await getClientPosition(clientId);
    return res.json(result);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

// PUT /api/tables/waiting-list/:id/cancel - Cancelar entrada en lista de espera
export async function cancelWaitingListHandler(req: Request, res: Response) {
  try {
    console.log(
      "User:",
      req.user
        ? {
            appUserId: req.user.appUserId,
            profile_code: req.user.profile_code,
          }
        : "No user",
    );

    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const waitingListId = req.params["id"];
    const reason = req.body?.reason;

    if (!waitingListId) {
      return res.status(400).json({ error: "ID de entrada requerido" });
    }

    // Verificar permisos: puede cancelar si es el dueño de la entrada o es staff
    const isStaff = ["dueno", "supervisor", "maitre"].includes(
      req.user.profile_code,
    );

    console.log("Calling cancelWaitingListEntry with:", {
      waitingListId,
      reason,
      userId: req.user.appUserId,
      isStaff,
    });

    const result = await cancelWaitingListEntry(
      waitingListId,
      reason,
      req.user.appUserId,
      isStaff,
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({ message: result.message });
  } catch (e: any) {
    console.error("ERROR in cancelWaitingListHandler:", e);
    return res.status(500).json({ error: e.message });
  }
}

// PUT /api/tables/waiting-list/:id/no-show - Marcar como no show
export async function markAsNoShowHandler(req: Request, res: Response) {
  try {
    const waitingListId = req.params["id"];

    if (!waitingListId) {
      return res.status(400).json({ error: "ID de entrada requerido" });
    }

    const result = await markAsNoShow(waitingListId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({ message: result.message });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// ========== CONTROLADORES PARA MESAS ==========

// GET /api/tables/status - Obtener estado de todas las mesas
export async function getTablesStatusHandler(_req: Request, res: Response) {
  try {
    const result = await getTablesStatus();
    return res.json(result);
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
}

// POST /api/tables/assign - Asignar cliente a mesa (para maitre)
export async function assignTableHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // El roleGuard ya verificó los permisos

    const assignData: AssignTableRequest = {
      waiting_list_id: req.body.waiting_list_id,
      table_id: req.body.table_id,
    };

    // Validaciones
    if (!assignData.waiting_list_id || !assignData.table_id) {
      return res.status(400).json({
        error: "ID de lista de espera y ID de mesa son requeridos",
      });
    }

    const result = await assignClientToTable(assignData);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    // Notificar al cliente sobre la mesa asignada
    try {
      // Obtener datos del cliente y la mesa para la notificación
      const { data: waitingEntry } = await supabaseAdmin
        .from("waiting_list")
        .select("client_id")
        .eq("id", assignData.waiting_list_id)
        .single();

      const { data: tableData } = await supabaseAdmin
        .from("tables")
        .select("number")
        .eq("id", assignData.table_id)
        .single();

      if (waitingEntry && tableData) {
        await notifyClientTableAssigned(
          waitingEntry.client_id,
          tableData.number.toString(),
        );
      }
    } catch (notifyError) {
      console.error("Error enviando notificación al cliente:", notifyError);
      // No bloqueamos la respuesta por error de notificación
    }

    return res.json({ message: result.message });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// POST /api/tables/:id/activate - Activar mesa cuando cliente escanea QR
export async function activateTableHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const tableId = req.params["id"];
    if (!tableId) {
      return res.status(400).json({ error: "ID de mesa requerido" });
    }

    // El cliente debe estar autenticado y ser un cliente (registrado o anónimo)
    const allowedProfiles = ["cliente_registrado", "cliente_anonimo"];
    if (!allowedProfiles.includes(req.user.profile_code)) {
      return res
        .status(403)
        .json({ error: "Solo clientes pueden activar mesas" });
    }

    const result = await activateTableByClient(tableId, req.user.appUserId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({
      success: true,
      message: result.message,
      table: result.table,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// POST /api/tables/:id/free - Liberar una mesa
export async function freeTableHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // El roleGuard ya verificó los permisos

    const tableId = req.params["id"];
    if (!tableId) {
      return res.status(400).json({ error: "ID de mesa requerido" });
    }

    const result = await freeTable(tableId);

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    return res.json({ message: result.message });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// GET /api/tables/my-table - Ver mi mesa ocupada (clientes)
export async function getMyTableHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const { data: myTable, error } = await supabaseAdmin
      .from("tables")
      .select("id, number, is_occupied")
      .eq("id_client", req.user.appUserId)
      .eq("is_occupied", true)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, otros errores sí son problemáticos
      throw error;
    }

    return res.json({
      hasOccupiedTable: !!myTable,
      table: myTable || null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// GET /api/tables/my-assigned - Ver mi mesa asignada pero no ocupada (clientes)
export async function getMyAssignedTableHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const { data: assignedTable, error } = await supabaseAdmin
      .from("tables")
      .select("id, number, is_occupied")
      .eq("id_client", req.user.appUserId)
      .eq("is_occupied", false)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found, otros errores sí son problemáticos
      throw error;
    }

    return res.json({
      hasAssignedTable: !!assignedTable,
      table: assignedTable || null,
    });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}

// GET /api/tables/my-status - Obtener estado completo del cliente
export async function getMyStatusHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const clientId = req.user.appUserId;

    // 1. Verificar mesa ocupada
    const { data: occupiedTable, error: occupiedError } = await supabaseAdmin
      .from("tables")
      .select("id, number")
      .eq("id_client", clientId)
      .eq("is_occupied", true)
      .maybeSingle();

    if (occupiedTable && !occupiedError) {
      const result = {
        status: "seated",
        table: occupiedTable,
      };
      return res.json(result);
    }

    // 2. Verificar mesa asignada pero no ocupada
    const { data: assignedTable, error: assignedError } = await supabaseAdmin
      .from("tables")
      .select("id, number")
      .eq("id_client", clientId)
      .eq("is_occupied", false)
      .maybeSingle();

    if (assignedTable && !assignedError) {
      const result = {
        status: "assigned",
        table: assignedTable,
      };
      return res.json(result);
    }

    // 3. Verificar estado en waiting_list (cualquier estado)
    const { data: waitingEntry, error: waitingError } = await supabaseAdmin
      .from("waiting_list")
      .select("id, status, party_size, preferred_table_type, special_requests")
      .eq("client_id", clientId)
      .order("seated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (waitingEntry && !waitingError) {
      if (waitingEntry.status === "displaced") {
        const result = {
          status: "displaced",
          waitingListId: waitingEntry.id,
        };
        return res.json(result);
      } else if (waitingEntry.status === "waiting") {
        // Calcular posición solo si está waiting
        try {
          const positionData = await getClientPosition(clientId);
          const result = {
            status: "in_queue",
            position: positionData.position,
            estimatedWait: positionData.estimatedWait,
            waitingListId: waitingEntry.id,
            party_size: waitingEntry.party_size,
            preferred_table_type: waitingEntry.preferred_table_type,
            special_requests: waitingEntry.special_requests,
            entry: positionData.entry,
          };
          return res.json(result);
        } catch (error) {
          console.error(
            "🔍 getMyStatusHandler - Error calculando posición:",
            error,
          );
          // Si falla el cálculo de posición, aún está en waiting
          const result = {
            status: "in_queue",
            waitingListId: waitingEntry.id,
            party_size: waitingEntry.party_size,
            preferred_table_type: waitingEntry.preferred_table_type,
            special_requests: waitingEntry.special_requests,
          };
          return res.json(result);
        }
      }
    }

    // 4. No está en ninguna lista/mesa
    const result = {
      status: "not_in_queue",
    };
    return res.json(result);
  } catch (e: any) {
    console.error("Error obteniendo estado del cliente:", e.message);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}
