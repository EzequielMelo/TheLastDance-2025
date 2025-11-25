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
  cancelTableReservation,
  cancelWaitingListEntry,
  markAsNoShow,
  confirmTableDelivery,
} from "./tablesServices";
import { getBillData } from "./billController";
import type {
  CreateWaitingListEntry,
  AssignTableRequest,
} from "./tables.types";
import {
  notifyMaitreNewWaitingClient,
  notifyClientTableAssigned,
  notifyWaiterPaymentRequest,
} from "../../services/pushNotificationService";
import { emitClientStateUpdate } from "../../socket/clientStateSocket";

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

    // Emitir evento de socket para actualización en tiempo real
    emitClientStateUpdate(entryData.client_id, "client:state-update", {
      waitingListId: result.id,
      status: "in_queue",
    });

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

        // Emitir evento de socket para actualización en tiempo real
        emitClientStateUpdate(waitingEntry.client_id, "client:table-assigned", {
          tableId: assignData.table_id,
          tableNumber: tableData.number,
          status: "assigned",
        });
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
      // Caso especial: llegada temprana (no es un error, es informativo)
      if (result.earlyArrival) {
        return res.status(200).json({
          success: false,
          earlyArrival: true,
          message: result.message,
          reservationTime: result.reservationTime,
          userName: result.userName
        });
      }
      
      // Otros casos de error
      return res.status(400).json({ error: result.message });
    }

    // Emitir evento de socket para actualización en tiempo real (cliente se sentó)
    emitClientStateUpdate(req.user.appUserId, "client:state-update", {
      tableId,
      tableNumber: result.table?.number,
      status: "seated",
    });

    return res.json({
      success: true,
      message: result.message,
      table: result.table,
    });
  } catch (e: any) {
    // Manejar errores específicos de reserva
    if (e.status === 403 && e.reservedFor) {
      return res.status(403).json({ 
        error: e.message,
        reservedFor: e.reservedFor 
      });
    }
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

// POST /api/tables/:id/cancel-reservation - Cancelar reserva de una mesa (Maitre)
export async function cancelTableReservationHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // El roleGuard ya verificó los permisos (maitre, supervisor, dueño)

    const tableId = req.params["id"];
    if (!tableId) {
      return res.status(400).json({ error: "ID de mesa requerido" });
    }

    const result = await cancelTableReservation(tableId);

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

    // 1. PRIMERO: Verificar estado en waiting_list (incluyendo confirm_pending)
    const { data: waitingEntry, error: waitingError } = await supabaseAdmin
      .from("waiting_list")
      .select("id, status, party_size, preferred_table_type, special_requests")
      .eq("client_id", clientId)
      .in("status", ["waiting", "displaced", "confirm_pending"]) // Incluir confirm_pending
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Si está en confirm_pending, devolver ese estado (tiene prioridad sobre seated)
    if (
      !waitingError &&
      waitingEntry &&
      waitingEntry.status === "confirm_pending"
    ) {
      // También obtener información de la mesa asignada para confirm_pending
      const { data: clientTable } = await supabaseAdmin
        .from("tables")
        .select("id, number, id_waiter")
        .eq("id_client", clientId)
        .eq("is_occupied", true)
        .maybeSingle();

      const result = {
        status: "confirm_pending",
        waitingListId: waitingEntry.id,
        party_size: waitingEntry.party_size,
        preferred_table_type: waitingEntry.preferred_table_type,
        special_requests: waitingEntry.special_requests,
        table: clientTable || null, // Incluir información de la mesa si existe
      };
      return res.json(result);
    }

    // 2. Verificar mesa ocupada
    const { data: occupiedTable, error: occupiedError } = await supabaseAdmin
      .from("tables")
      .select("id, number, table_status, id_waiter")
      .eq("id_client", clientId)
      .eq("is_occupied", true)
      .maybeSingle();

    if (occupiedTable && !occupiedError) {
      const result = {
        status: "seated",
        table: {
          id: occupiedTable.id,
          number: occupiedTable.number,
          id_waiter: occupiedTable.id_waiter,
        },
        table_status: occupiedTable.table_status || "pending",
      };
      return res.json(result);
    }

    // 3. Verificar mesa asignada pero no ocupada
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

    // 4. Verificar otros estados en waiting_list (que no sean confirm_pending)
    if (!waitingError && waitingEntry) {
      if (waitingEntry.status === "displaced") {
        const result = {
          status: "displaced",
          waitingListId: waitingEntry.id,
        };
        return res.json(result);
      } else if (waitingEntry.status === "waiting") {
        // Calcular posición para usuarios en espera
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

// POST /api/tables/:id/confirm-delivery - Confirmar entrega de pedido
export async function confirmDeliveryHandler(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const tableIdOrNumber = req.params["id"];
    if (!tableIdOrNumber) {
      return res.status(400).json({ error: "ID o número de mesa requerido" });
    }

    // El cliente debe estar autenticado y ser un cliente (registrado o anónimo)
    const allowedProfiles = ["cliente_registrado", "cliente_anonimo"];
    if (!allowedProfiles.includes(req.user.profile_code)) {
      return res
        .status(403)
        .json({ error: "Solo clientes pueden confirmar entrega" });
    }

    const result = await confirmTableDelivery(
      tableIdOrNumber,
      req.user.appUserId,
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    // Emitir evento de socket para actualización en tiempo real
    emitClientStateUpdate(req.user.appUserId, "client:delivery-confirmed", {
      tableId: result.table?.id,
      tableNumber: result.table?.number,
      status: "confirmed",
    });

    return res.json({
      success: true,
      message: "Entrega confirmada exitosamente",
      table: result.table,
    });
  } catch (e: any) {
    console.error("Error confirmando entrega:", e.message);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}

// POST /api/tables/:id/request-bill - Solicitar la cuenta (solo clientes)
export async function requestBillHandler(req: Request, res: Response) {
  try {
    const tableId = req.params["id"];
    const clientId = req.user?.appUserId;

    if (!clientId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    if (!tableId) {
      return res.status(400).json({ error: "ID de mesa requerido" });
    }

    // 1. Verificar que el cliente tiene acceso a la mesa
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id, number, id_client, id_waiter, table_status")
      .eq("id", tableId)
      .eq("id_client", clientId)
      .eq("is_occupied", true)
      .single();

    if (tableError || !table) {
      return res.status(403).json({
        error: "Mesa no encontrada o no tienes acceso a ella",
      });
    }

    if (!table.id_waiter) {
      return res.status(400).json({
        error: "No hay mozo asignado a esta mesa",
      });
    }

    // 2. Actualizar estado de la mesa a 'bill_requested'
    const { error: updateError } = await supabaseAdmin
      .from("tables")
      .update({ table_status: "bill_requested" })
      .eq("id", tableId);

    if (updateError) {
      console.error("Error actualizando estado de mesa:", updateError);
      return res.status(500).json({
        error: "Error interno del servidor",
      });
    }

    // 3. Calcular el total de las órdenes no pagadas
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        total_amount,
        order_items (
          quantity,
          price,
          menu_items (name)
        )
      `,
      )
      .eq("table_id", tableId)
      .eq("user_id", clientId)
      .eq("is_paid", false);

    if (ordersError) {
      console.error("Error obteniendo órdenes:", ordersError);
      return res.status(500).json({
        error: "Error calculando el total",
      });
    }

    const totalAmount = (orders || []).reduce(
      (sum, order) => sum + (order.total_amount || 0),
      0,
    );

    // 4. Obtener información del cliente para la notificación
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from("users")
      .select("first_name, last_name")
      .eq("id", clientId)
      .single();

    const clientName =
      clientData && !clientError
        ? `${clientData.first_name} ${clientData.last_name}`.trim()
        : "Cliente";

    // 5. Enviar notificación al mozo
    try {
      await notifyWaiterPaymentRequest(
        table.id_waiter,
        clientName,
        table.number,
        totalAmount,
      );
    } catch (notifyError) {
      console.error("Error enviando notificación al mozo:", notifyError);
      // No bloqueamos la respuesta por error de notificación
    }

    // Emitir evento de socket para actualización en tiempo real
    emitClientStateUpdate(clientId, "client:bill-requested", {
      tableId: table.id,
      tableNumber: table.number,
      totalAmount,
      status: "bill_requested",
    });

    return res.json({
      success: true,
      message: "Cuenta solicitada exitosamente",
      data: {
        tableNumber: table.number,
        totalAmount,
        itemsCount: orders?.length || 0,
      },
    });
  } catch (error) {
    console.error("Error en requestBillHandler:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
    });
  }
}

// GET /api/tables/:tableId/order-status - Consultar solo el estado de productos del cliente (QR flotante)
export async function getTableOrderStatusHandler(req: Request, res: Response) {
  try {
    const tableId = req.params["tableId"];
    const clientId = req.user?.appUserId;

    if (!clientId) {
      return res.status(401).json({ error: "No autenticado" });
    }

    if (!tableId) {
      return res.status(400).json({ error: "ID de mesa requerido" });
    }

    // 1. Verificar que el cliente tiene acceso a esta mesa
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id, number, id_client")
      .eq("id", tableId)
      .eq("id_client", clientId)
      .eq("is_occupied", true)
      .single();

    if (tableError || !table) {
      return res.status(403).json({
        error: "No tienes acceso a esta mesa o la mesa no está ocupada",
      });
    }

    // 2. Obtener todas las órdenes no pagadas del cliente en esta mesa
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        total_amount,
        created_at,
        order_items (
          id,
          quantity,
          status,
          menu_items (
            id,
            name,
            category,
            prep_minutes
          )
        )
      `,
      )
      .eq("table_id", tableId)
      .eq("user_id", clientId)
      .eq("is_paid", false)
      .order("created_at", { ascending: false });

    if (ordersError) {
      return res.status(500).json({
        error: "Error obteniendo órdenes",
      });
    }

    if (!orders || orders.length === 0) {
      return res.json({
        success: true,
        message: "No hay órdenes activas",
        data: {
          table_number: table.number,
          orders: [],
        },
      });
    }

    // 3. Organizar los datos por estado
    const statusCounts = {
      pending: 0,
      accepted: 0,
      preparing: 0,
      ready: 0,
      delivered: 0,
      rejected: 0,
    };

    const itemsByStatus: Record<string, any[]> = {
      pending: [],
      accepted: [],
      preparing: [],
      ready: [],
      delivered: [],
      rejected: [],
    };

    orders.forEach(order => {
      order.order_items.forEach((item: any) => {
        const status = item.status;
        if (status in statusCounts) {
          statusCounts[status as keyof typeof statusCounts]++;
        }

        if (status in itemsByStatus && itemsByStatus[status]) {
          itemsByStatus[status]!.push({
            id: item.id,
            name: item.menu_items.name,
            category: item.menu_items.category,
            quantity: item.quantity,
            prep_minutes: item.menu_items.prep_minutes,
            order_id: order.id,
          });
        }
      });
    });

    return res.json({
      success: true,
      message: "Estado de órdenes obtenido exitosamente",
      data: {
        table_number: table.number,
        summary: statusCounts,
        items_by_status: itemsByStatus,
        total_orders: orders.length,
        last_order_time: orders[0]?.created_at,
      },
    });
  } catch (error) {
    console.error("Error en getTableOrderStatusHandler:", error);
    return res.status(500).json({
      error: "Error interno del servidor",
    });
  }
}

export { getBillData };
