import { Request, Response } from "express";
import {
  getWaiterInfo,
  getAvailableTablesForAssignment,
  assignTableToWaiter,
  unassignTableFromWaiter,
  getAllWaitersWithTables,
  canUnassignTable,
  markItemsAsDelivered,
} from "./waiterServices";

// GET /api/waiter/me - Información del mesero logueado
export async function getMyWaiterInfo(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado",
        message: "Usuario no autenticado",
      });
    }

    const waiterId = req.user.appUserId;

    // Verificar que es un mesero
    if (req.user.position_code !== "mozo") {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "Solo los meseros pueden acceder a esta información",
      });
    }

    const waiterInfo = await getWaiterInfo(waiterId);
    if (!waiterInfo) {
      return res.status(404).json({
        error: "Mesero no encontrado",
      });
    }

    return res.json({
      success: true,
      data: waiterInfo,
    });
  } catch (error) {
    console.error("Error en getMyWaiterInfo:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// GET /api/waiter/available-tables - Mesas disponibles para asignar
export async function getAvailableTables(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado",
        message: "Usuario no autenticado",
      });
    }

    // Solo meseros pueden ver mesas disponibles
    if (req.user.position_code !== "mozo") {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "Solo los meseros pueden ver las mesas disponibles",
      });
    }

    const availableTables = await getAvailableTablesForAssignment();

    return res.json({
      success: true,
      data: availableTables,
    });
  } catch (error) {
    console.error("Error en getAvailableTables:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// POST /api/waiter/assign-table - Asignar mesa a mesero
export async function assignTable(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado",
        message: "Usuario no autenticado",
      });
    }

    const waiterId = req.user.appUserId;
    const { tableId } = req.body;

    // Verificar que es un mesero
    if (req.user.position_code !== "mozo") {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "Solo los meseros pueden asignar mesas",
      });
    }

    if (!tableId) {
      return res.status(400).json({
        error: "Datos inválidos",
        message: "El ID de la mesa es obligatorio",
      });
    }

    await assignTableToWaiter(waiterId, tableId);

    return res.json({
      success: true,
      message: "Mesa asignada correctamente",
    });
  } catch (error) {
    console.error("Error en assignTable:", error);
    return res.status(400).json({
      error: "Error asignando mesa",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// DELETE /api/waiter/unassign-table/:tableId - Desasignar mesa
export async function unassignTable(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado",
        message: "Usuario no autenticado",
      });
    }

    const waiterId = req.user.appUserId;
    const { tableId } = req.params;

    // Verificar que es un mesero
    if (req.user.position_code !== "mozo") {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "Solo los meseros pueden desasignar mesas",
      });
    }

    if (!tableId) {
      return res.status(400).json({
        error: "Datos inválidos",
        message: "El ID de la mesa es obligatorio",
      });
    }

    await unassignTableFromWaiter(waiterId, tableId);

    return res.json({
      success: true,
      message: "Mesa desasignada correctamente",
    });
  } catch (error) {
    console.error("Error en unassignTable:", error);
    return res.status(400).json({
      error: "Error desasignando mesa",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// GET /api/waiter/all - Obtener todos los meseros (solo para admin/supervisor)
export async function getAllWaiters(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado",
        message: "Usuario no autenticado",
      });
    }

    // Solo administradores y supervisores pueden ver todos los meseros
    if (!["dueno", "supervisor"].includes(req.user.profile_code)) {
      return res.status(403).json({
        error: "Acceso denegado",
        message:
          "Solo administradores y supervisores pueden ver todos los meseros",
      });
    }

    const waitersWithTables = await getAllWaitersWithTables();

    return res.json({
      success: true,
      data: waitersWithTables,
    });
  } catch (error) {
    console.error("Error en getAllWaiters:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// GET /api/waiter/can-unassign/:tableId - Verificar si se puede desasignar una mesa
export async function checkCanUnassignTable(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado",
        message: "Usuario no autenticado",
      });
    }

    const { tableId } = req.params;

    // Solo meseros pueden verificar si pueden desasignar
    if (req.user.position_code !== "mozo") {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "Solo los meseros pueden verificar disponibilidad",
      });
    }

    if (!tableId) {
      return res.status(400).json({
        error: "Datos inválidos",
        message: "El ID de la mesa es obligatorio",
      });
    }

    const canUnassign = await canUnassignTable(tableId);

    return res.json({
      success: true,
      data: {
        canUnassign,
        message: canUnassign
          ? "La mesa puede ser desasignada"
          : "La mesa no puede ser desasignada (tiene cliente asignado o está ocupada)",
      },
    });
  } catch (error) {
    console.error("Error en checkCanUnassignTable:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}

// POST /api/waiter/mark-delivered - Marcar items como entregados
export async function markItemsAsDeliveredHandler(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "No autenticado",
        message: "Usuario no autenticado",
      });
    }

    // Solo meseros pueden marcar items como entregados
    if (req.user.position_code !== "mozo") {
      return res.status(403).json({
        error: "Acceso denegado",
        message: "Solo los meseros pueden marcar items como entregados",
      });
    }

    const { itemIds } = req.body;

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        error: "Datos inválidos",
        message: "Se requiere un array de IDs de items",
      });
    }

    const waiterId = req.user.appUserId;
    const result = await markItemsAsDelivered(itemIds, waiterId);

    if (!result.success) {
      return res.status(400).json({
        error: "Error en entrega",
        message: result.message,
      });
    }

    return res.json({
      success: true,
      message: result.message,
      data: {
        deliveredItems: itemIds.length,
        checkedTables: result.checkedTables,
      },
    });
  } catch (error) {
    console.error("Error en markItemsAsDeliveredHandler:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
      message: error instanceof Error ? error.message : "Error desconocido",
    });
  }
}
