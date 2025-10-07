import type { Request, Response } from "express";
import {
  getWaitingList,
  addToWaitingList,
  getClientPosition,
  getTablesStatus,
  assignClientToTable,
  freeTable,
  cancelWaitingListEntry,
  markAsNoShow,
} from "./tablesServices";
import type {
  CreateWaitingListEntry,
  AssignTableRequest,
} from "./tables.types";

// ========== CONTROLADORES PARA LISTA DE ESPERA ==========

// GET /api/tables/waiting-list - Obtener lista de espera (para maitre)
export async function getWaitingListHandler(_req: Request, res: Response) {
  try {
    const result = await getWaitingList();
    return res.json(result);
  } catch (e: any) {
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
    } else {
      console.error("Error obteniendo posición:", e.message);
    }
    return res.status(400).json({ error: e.message });
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
    console.log("=== CANCELAR RESERVA ===");
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

    console.log("Waiting List ID:", waitingListId);
    console.log("Reason:", reason);
    console.log("Request body:", req.body);

    if (!waitingListId) {
      return res.status(400).json({ error: "ID de entrada requerido" });
    }

    // Verificar permisos: puede cancelar si es el dueño de la entrada o es staff
    const isStaff = ["dueno", "supervisor", "maitre"].includes(
      req.user.profile_code,
    );

    console.log("Is Staff:", isStaff);
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

    console.log("Result from service:", result);

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

    return res.json({ message: result.message });
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
