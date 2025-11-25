import { supabaseAdmin } from "../../config/supabase";
import type {
  CreateOrderDTO,
  OrderWithItems,
  OrderItemStatus,
} from "./orders.types";

// Crear nuevo pedido
export async function createOrder(
  orderData: CreateOrderDTO,
  userId: string,
): Promise<OrderWithItems> {
  try {
    console.log("📝 Creando pedido para usuario:", userId);
    console.log("📦 Items del pedido:", orderData.items);

    // 1. Verificar si el usuario tiene una orden activa con items rechazados
    const { data: activeOrders, error: activeOrderError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        order_items!inner(
          menu_item_id,
          status
        )
      `,
      )
      .eq("user_id", userId)
      .eq("is_paid", false);

    if (!activeOrderError && activeOrders && activeOrders.length > 0) {
      // Obtener todos los menu_item_id rechazados
      const rejectedMenuItemIds = new Set<string>();
      activeOrders.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          if (item.status === "rejected") {
            rejectedMenuItemIds.add(item.menu_item_id);
          }
        });
      });

      // Verificar si algún item del nuevo pedido está rechazado
      const blockedItems = orderData.items.filter(item =>
        rejectedMenuItemIds.has(item.id),
      );

      if (blockedItems.length > 0) {
        const blockedNames = blockedItems.map(item => item.name).join(", ");
        throw new Error(
          `Los siguientes productos no están disponibles: ${blockedNames}. Ya fueron rechazados previamente en esta sesión.`,
        );
      }
    }

    // 2. Validar que todos los productos existen y están activos
    const menuItemIds = orderData.items.map(item => item.id);
    const { data: menuItems, error: menuError } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, prep_minutes")
      .in("id", menuItemIds)
      .eq("is_active", true);

    if (menuError)
      throw new Error(`Error obteniendo productos: ${menuError.message}`);
    if (!menuItems || menuItems.length === 0)
      throw new Error("No se encontraron productos válidos");

    // 2. Verificar que todos los productos del frontend existen en la BD
    for (const frontendItem of orderData.items) {
      const dbItem = menuItems.find(mi => mi.id === frontendItem.id);
      if (!dbItem) {
        throw new Error(`Producto no encontrado: ${frontendItem.id}`);
      }

      // Opcional: Verificar que los precios coinciden (seguridad)
      if (Math.abs(dbItem.price - frontendItem.price) > 0.01) {
        console.warn(
          `⚠️ Precio no coincide para ${frontendItem.name}: DB=${dbItem.price}, Frontend=${frontendItem.price}`,
        );
      }
    }

    // 3. Usar los totales del frontend (ya validados)
    const totalAmount = orderData.totalAmount;
    const estimatedTime = orderData.estimatedTime;

    // 4. Crear el pedido principal
    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from("orders")
      .insert({
        user_id: userId,
        table_id: orderData.table_id || null,
        total_amount: totalAmount,
        estimated_time: estimatedTime,
        is_paid: false, // NUEVO: Inicia como no pagado
        notes: orderData.notes || null,
      })
      .select()
      .single();

    if (orderError)
      throw new Error(`Error creando pedido: ${orderError.message}`);

    // 5. Generar batch_id para la primera tanda
    const initialBatchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`📦 Primera tanda con batch_id: ${initialBatchId}`);

    // 6. Crear los items del pedido usando los datos del frontend
    const orderItemsData = orderData.items.map(item => ({
      order_id: newOrder.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      status: "pending" as OrderItemStatus, // NUEVO: Items inician pendientes
      batch_id: initialBatchId, // Primera tanda del pedido
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsData);

    if (itemsError)
      throw new Error(`Error creando items del pedido: ${itemsError.message}`);

    // 7. Si hay table_id, resetear el table_status a 'pending'
    if (orderData.table_id) {
      console.log(
        `🔄 Reseteando table_status para mesa ${orderData.table_id} a 'pending'`,
      );

      const { error: tableUpdateError } = await supabaseAdmin
        .from("tables")
        .update({
          table_status: "pending",
        })
        .eq("id", orderData.table_id);

      if (tableUpdateError) {
        console.warn(
          "⚠️ Error actualizando table_status:",
          tableUpdateError.message,
        );
        // No falla el pedido por esto, solo es un warning
      } else {
        console.log(
          `✅ table_status reseteado a 'pending' para mesa ${orderData.table_id}`,
        );
      }
    }

    // 8. Obtener el pedido completo con items
    const fullOrder = await getOrderById(newOrder.id);

    console.log("✅ Pedido creado exitosamente:", newOrder.id);
    return fullOrder;
  } catch (error) {
    console.error("❌ Error en createOrder:", error);
    throw error;
  }
}

// Obtener pedido por ID con todos sus items
export async function getOrderById(orderId: string): Promise<OrderWithItems> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        menu_item:menu_items (
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        )
      ),
      table:tables (
        id,
        number
      ),
      user:users (
        id,
        first_name,
        last_name
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error) throw new Error(`Error obteniendo pedido: ${error.message}`);
  if (!data) throw new Error("Pedido no encontrado");

  return data as OrderWithItems;
}

// Obtener pedidos del usuario
export async function getUserOrders(userId: string): Promise<OrderWithItems[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        menu_item:menu_items (
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        )
      ),
      table:tables (
        id,
        number
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(`❌ Error getting user orders:`, error);
    throw new Error(`Error obteniendo pedidos del usuario: ${error.message}`);
  }

  return (data as OrderWithItems[]) || [];
}

// Obtener pedidos por mesa
export async function getTableOrders(
  tableId: string,
): Promise<OrderWithItems[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        menu_item:menu_items (
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        )
      ),
      user:users (
        id,
        first_name,
        last_name
      )
    `,
    )
    .eq("table_id", tableId)
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Error obteniendo pedidos de la mesa: ${error.message}`);
  return (data as OrderWithItems[]) || [];
}

// Función obsoleta - eliminada con el nuevo sistema de estados por item
// Los estados ahora se manejan a nivel de item, no de orden

// Obtener pedidos pendientes (para empleados)
export async function getPendingOrders(): Promise<OrderWithItems[]> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        menu_item:menu_items (
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        )
      ),
      table:tables (
        id,
        number
      ),
      user:users (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .in("status", ["pending"])
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(`Error obteniendo pedidos pendientes: ${error.message}`);
  return (data as OrderWithItems[]) || [];
}

// Obtener pedidos pendientes específicos para mozos
export async function getWaiterPendingOrders(
  waiterId: string,
): Promise<OrderWithItems[]> {
  // Primero obtenemos las mesas asignadas al mozo
  const { data: assignedTables, error: tablesError } = await supabaseAdmin
    .from("tables")
    .select("id")
    .eq("id_waiter", waiterId);

  if (tablesError) {
    throw new Error(`Error obteniendo mesas asignadas: ${tablesError.message}`);
  }

  // Si el mozo no tiene mesas asignadas, retornar array vacío
  if (!assignedTables || assignedTables.length === 0) {
    return [];
  }

  const tableIds = assignedTables.map(table => table.id);

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        menu_item:menu_items (
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        )
      ),
      table:tables (
        id,
        number
      ),
      user:users (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .in("table_id", tableIds)
    .eq("is_paid", false)
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(
      `Error obteniendo pedidos pendientes para mozo: ${error.message}`,
    );

  // Filtrar órdenes que tengan al menos un item pendiente
  const pendingOrders =
    (data as OrderWithItems[])?.filter((order: any) => {
      return order.order_items?.some((item: any) => item.status === "pending");
    }) || [];

  return pendingOrders;
}

// Obtener pedidos en proceso para un mozo específico (con items aceptados, preparando, listos)
export async function getWaiterActiveOrders(
  waiterId: string,
): Promise<OrderWithItems[]> {
  // Primero obtenemos las mesas asignadas al mozo
  const { data: assignedTables, error: tablesError } = await supabaseAdmin
    .from("tables")
    .select("id")
    .eq("id_waiter", waiterId);

  if (tablesError) {
    throw new Error(`Error obteniendo mesas asignadas: ${tablesError.message}`);
  }

  // Si el mozo no tiene mesas asignadas, retornar array vacío
  if (!assignedTables || assignedTables.length === 0) {
    return [];
  }

  const tableIds = assignedTables.map(table => table.id);

  // Obtener órdenes no pagadas que tengan items en estados activos
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      *,
      order_items (
        *,
        menu_item:menu_items (
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        )
      ),
      table:tables (
        id,
        number
      ),
      user:users (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .in("table_id", tableIds)
    .eq("is_paid", false)
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(
      `Error obteniendo pedidos activos para mozo: ${error.message}`,
    );

  // Filtrar órdenes que tengan al menos un item en estado activo (no pending y no rejected)
  const activeOrders =
    (data as any)?.filter((order: any) => {
      return order.order_items?.some((item: any) =>
        ["accepted", "preparing", "ready", "delivered"].includes(item.status),
      );
    }) || [];

  return activeOrders;
}

// Aceptar orden completa
export async function acceptOrder(
  orderId: string,
  notes?: string,
): Promise<OrderWithItems> {
  try {
    // Actualizar estado a 'accepted'
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "accepted",
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError)
      throw new Error(`Error aceptando orden: ${updateError.message}`);

    // Retornar orden actualizada
    return await getOrderById(orderId);
  } catch (error) {
    console.error("❌ Error en acceptOrder:", error);
    throw error;
  }
}

// Rechazar orden completa
export async function rejectOrder(
  orderId: string,
  notes?: string,
): Promise<OrderWithItems> {
  try {
    // Actualizar estado a 'rejected'
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "rejected",
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError)
      throw new Error(`Error rechazando orden: ${updateError.message}`);

    // Retornar orden actualizada
    return await getOrderById(orderId);
  } catch (error) {
    console.error("❌ Error en rejectOrder:", error);
    throw error;
  }
}

// Rechazo parcial - eliminar items específicos
export async function partialRejectOrder(
  orderId: string,
  rejectedItemIds: string[],
  notes?: string,
): Promise<{ order: OrderWithItems; rejectedItems: any[] }> {
  try {
    // Obtener la orden actual
    const currentOrder = await getOrderById(orderId);

    // Filtrar items rechazados
    const rejectedItems = currentOrder.order_items.filter(item =>
      rejectedItemIds.includes(item.id),
    );

    // Verificar que existan items para rechazar
    if (rejectedItems.length === 0) {
      throw new Error("No se encontraron items para rechazar");
    }

    // Verificar que no se rechacen todos los items
    if (rejectedItems.length >= currentOrder.order_items.length) {
      throw new Error(
        "No se pueden rechazar todos los items. Use rechazo completo.",
      );
    }

    // Eliminar items rechazados de la base de datos
    const { error: deleteError } = await supabaseAdmin
      .from("order_items")
      .delete()
      .in("id", rejectedItemIds);

    if (deleteError)
      throw new Error(`Error eliminando items: ${deleteError.message}`);

    // Recalcular totales
    const remainingItems = currentOrder.order_items.filter(
      item => !rejectedItemIds.includes(item.id),
    );

    const newTotalAmount = remainingItems.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );
    const newEstimatedTime = Math.max(
      ...remainingItems.map(item => item.menu_item?.prep_minutes || 0),
    );

    // Actualizar orden con nuevos totales y estado
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "partial",
        total_amount: newTotalAmount,
        estimated_time: newEstimatedTime,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError)
      throw new Error(`Error actualizando orden: ${updateError.message}`);

    // Obtener orden actualizada
    const updatedOrder = await getOrderById(orderId);

    return {
      order: updatedOrder,
      rejectedItems: rejectedItems,
    };
  } catch (error) {
    console.error("❌ Error en partialRejectOrder:", error);
    throw error;
  }
}

// Nueva función: Rechazar items individuales de una tanda (sin eliminar, para que el cliente pueda reemplazar)
export async function rejectIndividualItemsFromBatch(
  orderId: string,
  waiterId: string,
  itemsToReject: string[], // IDs de items específicos a rechazar
  reason?: string,
): Promise<OrderWithItems> {
  try {
    console.log(`🔄 Rechazando items individuales de la orden ${orderId}`);
    console.log(`Items a rechazar: ${itemsToReject.join(", ")}`);

    // 1. Verificar que la orden existe
    const currentOrder = await getOrderById(orderId);

    // 2. Verificar que el mesero tiene permisos (mesa asignada)
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id")
      .eq("id", currentOrder.table_id)
      .eq("id_waiter", waiterId)
      .single();

    if (tableError || !table) {
      throw new Error("No tienes permisos para gestionar esta orden");
    }

    // 3. Verificar que los items existen y están en estado 'pending'
    const { data: itemsToCheck, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("id, status, batch_id, menu_item_id, quantity, subtotal")
      .eq("order_id", orderId)
      .in("id", itemsToReject);

    if (itemsError) {
      throw new Error(`Error verificando items: ${itemsError.message}`);
    }

    if (!itemsToCheck || itemsToCheck.length !== itemsToReject.length) {
      throw new Error("Algunos items no existen");
    }

    // Verificar que todos están en estado 'pending'
    const nonPendingItems = itemsToCheck.filter(
      item => item.status !== "pending",
    );
    if (nonPendingItems.length > 0) {
      throw new Error("Solo se pueden rechazar items en estado pendiente");
    }

    // Calcular el monto total de los items rechazados
    const rejectedAmount = itemsToCheck.reduce(
      (sum, item) => sum + (item.subtotal || 0),
      0,
    );
    console.log(
      `💰 Monto a descontar por items rechazados: $${rejectedAmount}`,
    );

    // 4. Obtener todos los batch_ids de los items rechazados
    const batchIds = [...new Set(itemsToCheck.map(item => item.batch_id))];

    // 5. Devolver TODA la tanda al cliente diferenciando disponibles vs no disponibles
    // Marcar items específicamente rechazados como 'rejected'
    const { error: rejectSpecificError } = await supabaseAdmin
      .from("order_items")
      .update({
        status: "rejected" as OrderItemStatus,
        updated_at: new Date().toISOString(),
      })
      .in("id", itemsToReject);

    if (rejectSpecificError) {
      throw new Error(
        `Error marcando items específicos como rechazados: ${rejectSpecificError.message}`,
      );
    }

    // Marcar los OTROS items de las mismas tandas como 'needs_modification'
    const { error: returnOthersError } = await supabaseAdmin
      .from("order_items")
      .update({
        status: "needs_modification" as OrderItemStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("order_id", orderId)
      .in("batch_id", batchIds)
      .not("id", "in", `(${itemsToReject.join(",")})`);

    if (returnOthersError) {
      throw new Error(
        `Error devolviendo otros items de la tanda: ${returnOthersError.message}`,
      );
    }

    // 6. Actualizar total_amount de la orden (restar items rechazados)
    const newTotalAmount = currentOrder.total_amount - rejectedAmount;
    console.log(
      `💰 Nuevo total de la orden: $${newTotalAmount} (anterior: $${currentOrder.total_amount})`,
    );

    // 7. Actualizar notas y total_amount de la orden
    const unavailableItemsInfo = itemsToCheck
      .map(item => `Item ID ${item.id}`)
      .join(", ");
    const noteText = reason
      ? `⚠️ Items no disponibles: ${unavailableItemsInfo}. Razón: ${reason}. Toda la tanda devuelta para que puedas reorganizar tu pedido.`
      : `⚠️ Items no disponibles: ${unavailableItemsInfo}. Toda la tanda devuelta para que puedas reorganizar tu pedido.`;

    const { error: updateOrderError } = await supabaseAdmin
      .from("orders")
      .update({
        notes: noteText,
        total_amount: newTotalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateOrderError) {
      console.warn(`⚠️ Error actualizando orden: ${updateOrderError.message}`);
    }

    // 8. Obtener la orden actualizada
    const updatedOrder = await getOrderById(orderId);

    console.log(
      `✅ Tanda completa devuelta al cliente. Items no disponibles: ${itemsToReject.join(", ")}`,
    );
    return updatedOrder;
  } catch (error) {
    console.error("❌ Error en rejectIndividualItemsFromBatch:", error);
    throw error;
  }
}

// Función simplificada: Solo aprobar TODA la tanda completa
export async function approveBatchCompletely(
  orderId: string,
  waiterId: string,
  batchId: string,
): Promise<OrderWithItems> {
  try {
    console.log(
      `✅ Aprobando tanda completa ${batchId} de la orden ${orderId}`,
    );

    // 1. Verificar que la orden existe
    const currentOrder = await getOrderById(orderId);

    // 2. Verificar que el mesero tiene permisos (mesa asignada)
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id")
      .eq("id", currentOrder.table_id)
      .eq("id_waiter", waiterId)
      .single();

    if (tableError || !table) {
      throw new Error("No tienes permisos para gestionar esta orden");
    }

    // 3. Obtener todos los items de la tanda
    const { data: batchItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("batch_id", batchId);

    if (itemsError) {
      throw new Error(
        `Error obteniendo items de la tanda: ${itemsError.message}`,
      );
    }

    if (!batchItems || batchItems.length === 0) {
      throw new Error("No se encontraron items en esta tanda");
    }

    // Verificar que todos están en estado 'pending'
    const nonPendingItems = batchItems.filter(
      item => item.status !== "pending",
    );
    if (nonPendingItems.length > 0) {
      throw new Error(
        "Solo se pueden aprobar tandas con items en estado pendiente",
      );
    }

    // 4. Aprobar TODA la tanda
    const itemIds = batchItems.map(item => item.id);
    const { error: approveError } = await supabaseAdmin
      .from("order_items")
      .update({
        status: "approved" as OrderItemStatus,
        updated_at: new Date().toISOString(),
      })
      .in("id", itemIds);

    if (approveError) {
      throw new Error(`Error aprobando tanda: ${approveError.message}`);
    }

    // 5. Actualizar notas de la orden
    const { error: noteError } = await supabaseAdmin
      .from("orders")
      .update({
        notes: `✅ Tanda ${batchId} aprobada completamente por el mozo`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (noteError) {
      console.warn(`⚠️ Error agregando notas a la orden: ${noteError.message}`);
    }

    // 6. Obtener la orden actualizada
    const updatedOrder = await getOrderById(orderId);

    console.log(`✅ Tanda ${batchId} aprobada completamente`);
    return updatedOrder;
  } catch (error) {
    console.error("❌ Error en approveBatchCompletely:", error);
    throw error;
  }
}

// Agregar items a un pedido parcial y cambiar estado a pending
export async function addItemsToPartialOrder(
  orderId: string,
  newItems: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    prepMinutes: number;
    quantity: number;
    image_url?: string | undefined;
  }>,
  userId: string,
): Promise<OrderWithItems> {
  try {
    console.log(`📝 Agregando items a pedido parcial ${orderId}`);

    // 1. Verificar que la orden existe, está en estado "partial" y pertenece al usuario
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, status, total_amount, estimated_time")
      .eq("id", orderId)
      .eq("user_id", userId)
      .eq("status", "partial")
      .single();

    if (orderError)
      throw new Error(`Error obteniendo orden: ${orderError.message}`);
    if (!order)
      throw new Error("Orden no encontrada o no está en estado parcial");

    // 2. Validar que todos los productos nuevos existen y están activos
    const menuItemIds = newItems.map(item => item.id);
    const { data: menuItems, error: menuError } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, prep_minutes")
      .in("id", menuItemIds)
      .eq("is_active", true);

    if (menuError)
      throw new Error(`Error obteniendo productos: ${menuError.message}`);
    if (!menuItems || menuItems.length === 0)
      throw new Error("No se encontraron productos válidos");

    // 3. Verificar que todos los productos del frontend existen en la BD
    for (const newItem of newItems) {
      const menuItem = menuItems.find(mi => mi.id === newItem.id);
      if (!menuItem)
        throw new Error(`Producto con ID ${newItem.id} no encontrado`);

      // Verificar precios (opcional - se podría usar precio de BD)
      if (Math.abs(menuItem.price - newItem.price) > 0.01)
        console.warn(
          `⚠️ Precio discrepante para ${newItem.name}: BD=${menuItem.price}, Frontend=${newItem.price}`,
        );
    }

    // 4. Insertar nuevos order_items
    const orderItemsToInsert = newItems.map(item => ({
      order_id: orderId,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
    }));

    const { error: insertError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsToInsert);

    if (insertError)
      throw new Error(`Error insertando items: ${insertError.message}`);

    // 5. Recalcular totales de la orden
    const { data: allOrderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        quantity,
        subtotal,
        menu_items!inner(prep_minutes)
      `,
      )
      .eq("order_id", orderId);

    if (itemsError)
      throw new Error(`Error obteniendo items: ${itemsError.message}`);

    // Calcular nuevo total y tiempo estimado
    const newTotalAmount = allOrderItems.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );
    const newEstimatedTime = Math.max(
      ...allOrderItems.map(item => (item.menu_items as any).prep_minutes),
    );

    console.log(`💰 Nuevo total: $${newTotalAmount}`);
    console.log(`⏰ Nuevo tiempo estimado: ${newEstimatedTime} min`);

    // 6. Actualizar orden (cambiar a pending y actualizar totales)
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        status: "pending",
        total_amount: newTotalAmount,
        estimated_time: newEstimatedTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError)
      throw new Error(`Error actualizando orden: ${updateError.message}`);

    console.log(
      `✅ Items agregados exitosamente. Orden ${orderId} cambiada a estado pending`,
    );

    // 7. Obtener orden actualizada completa
    const updatedOrder = await getOrderById(orderId);
    return updatedOrder;
  } catch (error) {
    console.error("❌ Error en addItemsToPartialOrder:", error);
    throw error;
  }
}

// Agregar items a un pedido existente (cualquier estado excepto delivered/cancelled)
export async function addItemsToExistingOrder(
  orderId: string,
  newItems: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    prepMinutes: number;
    quantity: number;
    image_url?: string | undefined;
  }>,
  userId: string,
): Promise<OrderWithItems> {
  try {
    console.log(`📝 Agregando items a pedido existente ${orderId}`);

    // 1. Verificar que la orden existe y pertenece al usuario
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, is_paid, total_amount, estimated_time")
      .eq("id", orderId)
      .eq("user_id", userId)
      .single();

    if (orderError)
      throw new Error(`Error obteniendo orden: ${orderError.message}`);
    if (!order) throw new Error("Orden no encontrada");

    // 2. Verificar que la orden permite agregar items (no debe estar pagada)
    if (order.is_paid) {
      throw new Error(
        `No se pueden agregar items a un pedido que ya está pagado`,
      );
    }

    // 3. Validar que todos los productos nuevos existen y están activos
    const menuItemIds = newItems.map(item => item.id);
    const { data: menuItems, error: menuError } = await supabaseAdmin
      .from("menu_items")
      .select("id, name, price, prep_minutes")
      .in("id", menuItemIds)
      .eq("is_active", true);

    if (menuError)
      throw new Error(`Error obteniendo productos: ${menuError.message}`);
    if (!menuItems || menuItems.length === 0)
      throw new Error("No se encontraron productos válidos");

    // 4. Verificar que todos los productos del frontend existen en la BD
    for (const newItem of newItems) {
      const menuItem = menuItems.find(mi => mi.id === newItem.id);
      if (!menuItem)
        throw new Error(`Producto con ID ${newItem.id} no encontrado`);

      // Verificar precios (opcional - se podría usar precio de BD)
      if (Math.abs(menuItem.price - newItem.price) > 0.01)
        console.warn(
          `⚠️ Precio discrepante para ${newItem.name}: BD=${menuItem.price}, Frontend=${newItem.price}`,
        );
    }

    // 5. Generar un batch_id único para esta nueva tanda
    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`📦 Nueva tanda con batch_id: ${batchId}`);

    // 6. Insertar nuevos order_items con status 'pending' y batch_id único
    const orderItemsToInsert = newItems.map(item => ({
      order_id: orderId,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      status: "pending" as OrderItemStatus, // Los nuevos items siempre empiezan como pending
      batch_id: batchId, // Identificador único para esta tanda
    }));

    const { error: insertError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsToInsert);

    if (insertError)
      throw new Error(`Error insertando items: ${insertError.message}`);

    // 7. Recalcular totales de la orden (incluir TODOS los items excepto rechazados)
    const { data: allOrderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        quantity,
        subtotal,
        status,
        menu_items!inner(prep_minutes)
      `,
      )
      .eq("order_id", orderId)
      .neq("status", "rejected"); // Excluir solo items rechazados

    if (itemsError)
      throw new Error(`Error obteniendo items: ${itemsError.message}`);

    // Calcular nuevo total y tiempo estimado
    const newTotalAmount = allOrderItems.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );
    const newEstimatedTime = Math.max(
      ...allOrderItems.map(item => (item.menu_items as any).prep_minutes),
    );

    console.log(`💰 Nuevo total: $${newTotalAmount}`);
    console.log(`⏰ Nuevo tiempo estimado: ${newEstimatedTime} min`);

    // 8. Actualizar orden - solo actualizar totales (los items nuevos van como pending)
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        total_amount: newTotalAmount,
        estimated_time: newEstimatedTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError)
      throw new Error(`Error actualizando orden: ${updateError.message}`);

    console.log(
      `✅ Items agregados exitosamente a la orden ${orderId}. Nuevos items en estado 'pending' con batch_id: ${batchId}`,
    );

    // 9. Obtener orden actualizada completa
    const updatedOrder = await getOrderById(orderId);
    return updatedOrder;
  } catch (error) {
    console.error("❌ Error en addItemsToExistingOrder:", error);
    throw error;
  }
}

// FUNCIÓN OBSOLETA - Reemplazada por waiterItemsActionNew
// Esta función usaba el sistema antiguo de estados a nivel de orden
// El nuevo sistema maneja estados únicamente a nivel de item

// NUEVA FUNCIÓN REFACTORIZADA: Obtener items pendientes de aprobación
export async function getWaiterPendingItems(waiterId: string): Promise<any[]> {
  // Obtener mesas asignadas al mozo
  const { data: assignedTables, error: tablesError } = await supabaseAdmin
    .from("tables")
    .select("id")
    .eq("id_waiter", waiterId);

  if (tablesError) {
    throw new Error(`Error obteniendo mesas asignadas: ${tablesError.message}`);
  }

  if (!assignedTables || assignedTables.length === 0) {
    return [];
  }

  const tableIds = assignedTables.map(table => table.id);

  // Obtener órdenes NO PAGADAS que tienen items pendientes
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(
      `
      id,
      user_id,
      table_id,
      is_paid,
      total_amount,
      estimated_time,
      notes,
      created_at,
      updated_at,
      order_items!inner (
        id,
        menu_item_id,
        quantity,
        unit_price,
        subtotal,
        status,
        batch_id,
        created_at,
        menu_item:menu_items (
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        )
      ),
      table:tables (
        id,
        number
      ),
      user:users (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .in("table_id", tableIds)
    .eq("is_paid", false) // Solo órdenes no pagadas
    .eq("order_items.status", "pending") // Solo items pendientes
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(`Error obteniendo items pendientes: ${error.message}`);

  // Filtrar para que cada orden solo tenga los items pendientes
  const ordersWithPendingItems = (data || [])
    .map(order => ({
      ...order,
      order_items: order.order_items.filter(
        (item: any) => item.status === "pending",
      ),
    }))
    .filter(order => order.order_items.length > 0);

  return ordersWithPendingItems;
}

// Nueva función para obtener tandas pendientes agrupadas por batch_id
export async function getWaiterPendingBatches(
  waiterId: string,
): Promise<any[]> {
  // Obtener mesas asignadas al mozo
  const { data: assignedTables, error: tablesError } = await supabaseAdmin
    .from("tables")
    .select("id")
    .eq("id_waiter", waiterId);

  if (tablesError) {
    throw new Error(`Error obteniendo mesas asignadas: ${tablesError.message}`);
  }

  if (!assignedTables || assignedTables.length === 0) {
    return [];
  }

  const tableIds = assignedTables.map(table => table.id);

  // Obtener items pendientes con información de orden y agrupados por batch_id
  const { data, error } = await supabaseAdmin
    .from("order_items")
    .select(
      `
      id,
      menu_item_id,
      quantity,
      unit_price,
      subtotal,
      status,
      batch_id,
      created_at,
      order:orders!inner (
        id,
        user_id,
        table_id,
        is_paid,
        total_amount,
        estimated_time,
        notes,
        created_at,
        table:tables (
          id,
          number
        ),
        user:users (
          id,
          first_name,
          last_name,
          profile_image
        )
      ),
      menu_item:menu_items (
        id,
        name,
        description,
        prep_minutes,
        price,
        category
      )
    `,
    )
    .in("order.table_id", tableIds)
    .eq("order.is_paid", false)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Error obteniendo tandas pendientes: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Agrupar items por orden y batch_id
  const groupedBatches = data.reduce((acc: any, item: any) => {
    const orderId = item.order.id;
    const batchId = item.batch_id;
    const key = `${orderId}_${batchId}`;

    if (!acc[key]) {
      acc[key] = {
        order_id: orderId,
        batch_id: batchId,
        order: item.order,
        items: [],
        created_at: item.created_at,
        total_items: 0,
        total_amount: 0,
        max_prep_time: 0,
      };
    }

    acc[key].items.push({
      id: item.id,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.subtotal,
      status: item.status,
      menu_item: item.menu_item,
    });

    acc[key].total_items += item.quantity;
    acc[key].total_amount += item.subtotal;
    acc[key].max_prep_time = Math.max(
      acc[key].max_prep_time,
      item.menu_item.prep_minutes,
    );

    return acc;
  }, {});

  // Convertir el objeto agrupado en array y ordenar por fecha de creación
  const batchesArray = Object.values(groupedBatches).sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  console.log(
    `📦 Encontradas ${batchesArray.length} tandas pendientes para mozo ${waiterId}`,
  );

  return batchesArray;
}

// NUEVA FUNCIÓN REFACTORIZADA: Acción del mozo sobre items específicos
export async function waiterItemsActionNew(
  orderId: string,
  action: "accept" | "reject",
  itemIds: string[],
  notes?: string,
): Promise<{
  order: any;
  affectedItems: any[];
}> {
  try {
    console.log(
      `👨‍💼 Mozo ${action} items [${itemIds.join(", ")}] en orden ${orderId}`,
    );

    // 1. Verificar que la orden existe y no está pagada
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .eq("is_paid", false) // Solo órdenes no pagadas
      .single();

    if (orderError || !order) {
      throw new Error("Orden no encontrada o ya está pagada");
    }

    // 2. Verificar que todos los items existen y están pending
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .in("id", itemIds)
      .eq("status", "pending");

    if (itemsError || !items || items.length !== itemIds.length) {
      throw new Error("Algunos items no existen o no están pendientes");
    }

    if (action === "reject" && itemIds.length > 0) {
      // LÓGICA DE TANDAS: Si rechazamos al menos un item, identificar su tanda
      // y devolver TODA la tanda a "pending" para que el cliente pueda modificar todo

      console.log("🔄 Rechazando items - implementando lógica de tandas");

      // 3a. Identificar las tandas: obtener batch_id de los items que se van a rechazar
      const { data: itemsToReject, error: rejectError } = await supabaseAdmin
        .from("order_items")
        .select("id, batch_id")
        .in("id", itemIds);

      if (rejectError || !itemsToReject) {
        throw new Error("Error obteniendo items a rechazar");
      }

      // 3b. Extraer todos los batch_ids únicos de los items rechazados
      const batchIds = [...new Set(itemsToReject.map(item => item.batch_id))];
      console.log(`📦 Batch IDs afectados: ${batchIds.join(", ")}`);

      // 3c. Obtener TODOS los items de las tandas afectadas (mismo batch_id)
      const { data: batchItems, error: batchError } = await supabaseAdmin
        .from("order_items")
        .select("id, batch_id, status")
        .eq("order_id", orderId)
        .in("batch_id", batchIds)
        .in("status", ["pending", "accepted"]); // Items que pueden ser devueltos a pending

      if (batchError || !batchItems) {
        throw new Error("Error obteniendo items de la tanda");
      }

      console.log(
        `📦 Tandas identificadas: ${batchItems.length} items total en ${batchIds.length} tanda(s)`,
      );

      // 3d. Devolver TODA las tandas afectadas a "pending"
      const allBatchItemIds = batchItems.map(item => item.id);

      const { error: revertError } = await supabaseAdmin
        .from("order_items")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .in("id", allBatchItemIds);

      if (revertError) {
        throw new Error(
          `Error revirtiendo tanda a pending: ${revertError.message}`,
        );
      }

      // 3e. Marcar específicamente los items rechazados
      const { error: rejectUpdateError } = await supabaseAdmin
        .from("order_items")
        .update({
          status: "rejected",
          updated_at: new Date().toISOString(),
        })
        .in("id", itemIds);

      if (rejectUpdateError) {
        throw new Error(
          `Error marcando items rechazados: ${rejectUpdateError.message}`,
        );
      }

      console.log(
        `✅ Tanda devuelta a pending. ${itemIds.length} items rechazados específicamente.`,
      );
    } else {
      // 3. Lógica normal para aceptar (no requiere lógica de tandas)
      const newStatus = action === "accept" ? "accepted" : "rejected";

      const { error: updateError } = await supabaseAdmin
        .from("order_items")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .in("id", itemIds);

      if (updateError) {
        throw new Error(`Error actualizando items: ${updateError.message}`);
      }
    }

    // 4. Recalcular total de la orden (todos los items excepto rechazados)
    const { data: acceptedItems, error: acceptedError } = await supabaseAdmin
      .from("order_items")
      .select("subtotal")
      .eq("order_id", orderId)
      .neq("status", "rejected");

    if (acceptedError) {
      throw new Error(
        `Error obteniendo items aceptados: ${acceptedError.message}`,
      );
    }

    // Calcular nuevo total
    const newTotalAmount = (acceptedItems || []).reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    // 5. Actualizar total de la orden
    const { error: orderUpdateError } = await supabaseAdmin
      .from("orders")
      .update({
        total_amount: newTotalAmount,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (orderUpdateError) {
      throw new Error(`Error actualizando orden: ${orderUpdateError.message}`);
    }

    console.log(
      `✅ Acción ${action} completada en ${itemIds.length} items. Nuevo total: $${newTotalAmount}`,
    );

    // 6. Retornar orden actualizada
    const updatedOrder = await getOrderById(orderId);

    return {
      order: updatedOrder,
      affectedItems: items,
    };
  } catch (error) {
    console.error("❌ Error en waiterItemsActionNew:", error);
    throw error;
  }
}

// Reemplazar items rechazados con nuevos items
export async function replaceRejectedItems(
  orderId: string,
  userId: string,
  rejectedItemIds: string[],
  newItems: Array<{
    menu_item_id: string;
    quantity: number;
    unit_price: number;
  }>,
): Promise<OrderWithItems> {
  try {
    console.log(`🔄 Reemplazando items rechazados en orden ${orderId}`);

    // 1. Verificar que la orden existe y pertenece al usuario
    const existingOrder = await getOrderById(orderId);
    if (existingOrder.user_id !== userId) {
      throw new Error("No tienes permisos para modificar esta orden");
    }

    if (existingOrder.is_paid) {
      throw new Error("No se pueden modificar órdenes que ya están pagadas");
    }

    // 2. Verificar que los items están realmente rechazados
    const { data: rejectedItems, error: rejectedError } = await supabaseAdmin
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .in("id", rejectedItemIds)
      .eq("status", "rejected");

    if (rejectedError) {
      throw new Error(
        `Error verificando items rechazados: ${rejectedError.message}`,
      );
    }

    if (!rejectedItems || rejectedItems.length !== rejectedItemIds.length) {
      throw new Error("Algunos items no están rechazados o no existen");
    }

    // 3. Eliminar items rechazados
    const { error: deleteError } = await supabaseAdmin
      .from("order_items")
      .delete()
      .in("id", rejectedItemIds);

    if (deleteError) {
      throw new Error(
        `Error eliminando items rechazados: ${deleteError.message}`,
      );
    }

    // 4. Validar que los nuevos productos existen
    const menuItemIds = newItems.map(item => item.menu_item_id);
    const { data: menuItems, error: menuError } = await supabaseAdmin
      .from("menu_items")
      .select("*")
      .in("id", menuItemIds)
      .eq("is_active", true);

    if (menuError) {
      throw new Error(`Error validando productos: ${menuError.message}`);
    }

    if (!menuItems || menuItems.length !== menuItemIds.length) {
      throw new Error("Algunos productos no existen o no están disponibles");
    }

    // 5. Generar batch_id para los items de reemplazo
    const replacementBatchId = `replacement_${Date.now()}_${orderId}`;
    console.log(`📦 Items de reemplazo con batch_id: ${replacementBatchId}`);

    // 6. Crear nuevos items (en estado pending)
    const orderItemsToInsert = newItems.map(item => ({
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.unit_price * item.quantity,
      status: "pending" as OrderItemStatus,
      batch_id: replacementBatchId, // Identificador único para este reemplazo
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsToInsert);

    if (insertError) {
      throw new Error(`Error insertando nuevos items: ${insertError.message}`);
    }

    // 7. Recalcular totales de la orden (solo items no rechazados)
    const { data: allOrderItems, error: allItemsError } = await supabaseAdmin
      .from("order_items")
      .select("subtotal, menu_items!inner(prep_minutes)")
      .eq("order_id", orderId)
      .neq("status", "rejected");

    if (allItemsError) {
      throw new Error(`Error calculando totales: ${allItemsError.message}`);
    }

    const newTotalAmount = (allOrderItems || []).reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );

    const newEstimatedTime = Math.max(
      ...(allOrderItems || []).map(
        item => (item.menu_items as any).prep_minutes,
      ),
    );

    // 7. Actualizar totales de la orden
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({
        total_amount: newTotalAmount,
        estimated_time: newEstimatedTime,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateError) {
      throw new Error(`Error actualizando orden: ${updateError.message}`);
    }

    console.log(
      `✅ Items rechazados reemplazados exitosamente en orden ${orderId}`,
    );

    // 8. Retornar orden actualizada
    const updatedOrder = await getOrderById(orderId);
    return updatedOrder;
  } catch (error) {
    console.error("❌ Error en replaceRejectedItems:", error);
    throw error;
  }
}

// ============= FUNCIONES PARA COCINA =============

// Obtener pedidos para cocina (items con category "plato" en estados activos)
// UNIFICA items de mesas (order_items) + items de delivery (delivery_order_items)
export async function getKitchenPendingOrders(): Promise<OrderWithItems[]> {
  try {
    console.log(
      "👨‍🍳 Obteniendo pedidos para cocina (mesas + deliveries, todos los estados activos)...",
    );

    // 1. Obtener items de MESAS (order_items)
    const { data: tableItems, error: tableError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        order_id,
        menu_item_id,
        quantity,
        unit_price,
        subtotal,
        status,
        created_at,
        menu_items!inner(
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        ),
        orders!inner(
          id,
          user_id,
          table_id,
          total_amount,
          estimated_time,
          is_paid,
          notes,
          created_at,
          updated_at,
          tables(id, number),
          users(id, first_name, last_name, profile_image)
        )
      `,
      )
      .in("status", ["accepted", "preparing", "ready"])
      .eq("menu_items.category", "plato")
      .order("created_at", { ascending: true });

    if (tableError) {
      console.error("❌ Error obteniendo items de mesas:", tableError);
      throw new Error(
        `Error obteniendo items de cocina (mesas): ${tableError.message}`,
      );
    }

    // 2. Obtener items de DELIVERIES (delivery_order_items)
    const { data: deliveryItems, error: deliveryError } = await supabaseAdmin
      .from("delivery_order_items")
      .select(
        `
        id,
        delivery_order_id,
        menu_item_id,
        quantity,
        unit_price,
        subtotal,
        status,
        created_at,
        menu_items!inner(
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        ),
        delivery_orders!inner(
          id,
          user_id,
          total_amount,
          estimated_time,
          is_paid,
          notes,
          created_at,
          updated_at,
          users(id, first_name, last_name, profile_image)
        )
      `,
      )
      .in("status", ["accepted", "preparing", "ready"])
      .eq("menu_items.category", "plato")
      .order("created_at", { ascending: true });

    if (deliveryError) {
      console.error("❌ Error obteniendo items de deliveries:", deliveryError);
      throw new Error(
        `Error obteniendo items de cocina (deliveries): ${deliveryError.message}`,
      );
    }

    // 3. Combinar items de ambas fuentes en una lista única
    const allItems: any[] = [];

    // Normalizar items de mesas
    if (tableItems && tableItems.length > 0) {
      tableItems.forEach((item: any) => {
        allItems.push({
          ...item,
          is_delivery: false,
          order_id: item.order_id,
          delivery_order_id: null,
          order: item.orders,
          delivery_order: null,
        });
      });
    }

    // Normalizar items de deliveries
    if (deliveryItems && deliveryItems.length > 0) {
      deliveryItems.forEach((item: any) => {
        allItems.push({
          ...item,
          is_delivery: true,
          order_id: null,
          delivery_order_id: item.delivery_order_id,
          order: null,
          delivery_order: item.delivery_orders,
        });
      });
    }

    // 4. Ordenar por created_at (más antiguo primero = mayor prioridad)
    allItems.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateA - dateB;
    });

    if (allItems.length === 0) {
      console.log("👨‍🍳 No hay items pendientes para cocina");
      return [];
    }

    console.log(
      `👨‍🍳 Items encontrados: ${tableItems?.length || 0} de mesas, ${deliveryItems?.length || 0} de deliveries`,
    );

    // 5. Agrupar items por orden (respetando el orden cronológico)
    const ordersMap = new Map<string, OrderWithItems>();

    allItems.forEach(item => {
      const menuItem = (item as any).menu_items;
      const isDelivery = item.is_delivery;
      const sourceOrder = isDelivery ? item.delivery_order : item.order;
      const orderId = isDelivery ? item.delivery_order_id : item.order_id;

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          ...sourceOrder,
          id: orderId,
          table: isDelivery ? null : sourceOrder.tables,
          user: sourceOrder.users,
          is_delivery: isDelivery,
          order_items: [],
        });
      }

      const orderInMap = ordersMap.get(orderId)!;
      orderInMap.order_items.push({
        id: item.id,
        order_id: item.order_id,
        delivery_order_id: item.delivery_order_id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        status: item.status,
        created_at: item.created_at,
        menu_item: menuItem,
        is_delivery: isDelivery,
      });
    });

    const ordersArray = Array.from(ordersMap.values());
    console.log(
      `👨‍🍳 Encontradas ${ordersArray.length} órdenes con items para cocina (${allItems.length} items totales)`,
    );

    return ordersArray;
  } catch (error) {
    console.error("❌ Error en getKitchenPendingOrders:", error);
    throw error;
  }
}

// Actualizar status de items de cocina
// SOPORTA items de mesas (order_items) + items de delivery (delivery_order_items)
export async function updateKitchenItemStatus(
  itemId: string,
  newStatus: OrderItemStatus,
  cookId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(
      `👨‍🍳 Actualizando item ${itemId} a status ${newStatus} por cocinero ${cookId}`,
    );

    // Validar que el nuevo status es válido para cocina
    const validStatuses: OrderItemStatus[] = ["preparing", "ready"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Status inválido para cocina: ${newStatus}`);
    }

    // 1. Intentar encontrar el item en order_items (mesas)
    const { data: tableItem } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        status,
        order_id,
        menu_items!inner(category)
      `,
      )
      .eq("id", itemId)
      .single();

    // 2. Si no se encuentra en mesas, buscar en delivery_order_items
    const { data: deliveryItem } = await supabaseAdmin
      .from("delivery_order_items")
      .select(
        `
        id,
        status,
        delivery_order_id,
        menu_items!inner(category)
      `,
      )
      .eq("id", itemId)
      .single();

    // Determinar si el item existe y de qué tipo es
    const isDelivery = !tableItem && deliveryItem;
    const item = isDelivery ? deliveryItem : tableItem;

    if (!item) {
      throw new Error("Item no encontrado en ninguna tabla");
    }

    if ((item.menu_items as any).category !== "plato") {
      throw new Error("Este item no corresponde a cocina");
    }

    if (item.status !== "accepted" && item.status !== "preparing") {
      throw new Error(`No se puede cambiar el status desde ${item.status}`);
    }

    // 3. Actualizar el status en la tabla correspondiente
    if (isDelivery) {
      console.log(`📦 Actualizando item de DELIVERY ${itemId}`);
      const { error: updateError } = await supabaseAdmin
        .from("delivery_order_items")
        .update({ status: newStatus })
        .eq("id", itemId);

      if (updateError) {
        throw new Error(
          `Error actualizando status (delivery): ${updateError.message}`,
        );
      }

      // Sincronizar estado con tabla deliveries
      await syncDeliveryStatus(deliveryItem.delivery_order_id);
    } else {
      console.log(`🍽️ Actualizando item de MESA ${itemId}`);
      const { error: updateError } = await supabaseAdmin
        .from("order_items")
        .update({ status: newStatus })
        .eq("id", itemId);

      if (updateError) {
        throw new Error(
          `Error actualizando status (mesa): ${updateError.message}`,
        );
      }
    }

    console.log(`✅ Item ${itemId} actualizado a ${newStatus}`);

    // Si el item fue marcado como "ready", verificar si todos los items de la mesa están listos para delivery
    if (newStatus === "ready" && !isDelivery) {
      console.log(
        `🔍 Item de mesa marcado como ready, verificando si se debe actualizar mesa status...`,
      );

      // Obtener información de la orden y mesa para este item
      const { data: itemInfo, error: itemInfoError } = await supabaseAdmin
        .from("order_items")
        .select(
          `
          orders!inner(
            table_id,
            user_id
          )
        `,
        )
        .eq("id", itemId)
        .single();

      if (!itemInfoError && itemInfo) {
        const tableId = (itemInfo.orders as any).table_id;
        const userId = (itemInfo.orders as any).user_id;

        if (tableId && userId) {
          console.log(
            `🔄 Verificando delivery status para mesa ${tableId} y usuario ${userId}`,
          );

          try {
            // Usar la función existente para verificar y actualizar automáticamente
            const deliveryCheck = await checkAllItemsDelivered(tableId, userId);
            console.log(`📊 Resultado verificación entrega:`, deliveryCheck);
          } catch (error) {
            console.warn(`⚠️ Error verificando delivery status:`, error);
            // No fallar la actualización del item por esto
          }
        }
      }
    }

    return {
      success: true,
      message: `Item actualizado a ${newStatus === "preparing" ? "preparando" : "listo"}`,
    };
  } catch (error) {
    console.error("❌ Error en updateKitchenItemStatus:", error);
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Error interno del servidor",
    };
  }
}

// Obtener estado de pedidos de una mesa específica (para cliente que escanea QR)
export async function getTableOrdersStatus(
  tableId: string,
  userId: string,
): Promise<OrderWithItems[]> {
  try {
    console.log(
      `📱 Obteniendo estado de pedidos para mesa ${tableId} y usuario ${userId}`,
    );

    // Verificar que el usuario tiene acceso a esta mesa
    const { data: tableData, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("id_client")
      .eq("id", tableId)
      .eq("id_client", userId)
      .single();

    if (tableError || !tableData) {
      throw new Error("No tienes acceso a esta mesa o la mesa no existe");
    }

    // Obtener todas las órdenes de la mesa del usuario
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select(
        `
        id,
        user_id,
        table_id,
        total_amount,
        estimated_time,
        is_paid,
        notes,
        created_at,
        updated_at,
        order_items(
          id,
          menu_item_id,
          quantity,
          unit_price,
          subtotal,
          status,
          created_at,
          menu_items(
            id,
            name,
            description,
            prep_minutes,
            price,
            category
          )
        ),
        tables(id, number),
        users(id, first_name, last_name, profile_image)
      `,
      )
      .eq("table_id", tableId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (ordersError) {
      throw new Error(`Error obteniendo pedidos: ${ordersError.message}`);
    }

    console.log(`📱 Encontradas ${orders?.length || 0} órdenes para la mesa`);

    // Mapear los datos para que coincidan con el tipo OrderWithItems
    const mappedOrders: OrderWithItems[] = (orders || []).map((order: any) => ({
      ...order,
      table: order.tables?.[0] || null,
      user: order.users?.[0] || null,
      order_items: order.order_items.map((item: any) => ({
        ...item,
        order_id: order.id,
        menu_item: item.menu_items?.[0] || null,
      })),
    }));

    return mappedOrders;
  } catch (error) {
    console.error("❌ Error en getTableOrdersStatus:", error);
    throw error;
  }
}

// ============= FUNCIONES PARA BAR =============

// Obtener pedidos pendientes para bar (items con category "bebida" y status "accepted")
// UNIFICA items de mesas (order_items) + items de delivery (delivery_order_items)
export async function getBartenderPendingOrders(): Promise<OrderWithItems[]> {
  try {
    console.log(
      "🍷 Obteniendo pedidos para bar (mesas + deliveries, todos los estados activos)...",
    );

    // 1. Obtener items de MESAS (order_items)
    const { data: tableItems, error: tableError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        order_id,
        menu_item_id,
        quantity,
        unit_price,
        subtotal,
        status,
        created_at,
        menu_items!inner(
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        ),
        orders!inner(
          id,
          user_id,
          table_id,
          total_amount,
          estimated_time,
          is_paid,
          notes,
          created_at,
          updated_at,
          tables(id, number),
          users(id, first_name, last_name, profile_image)
        )
      `,
      )
      .in("status", ["accepted", "preparing", "ready"])
      .eq("menu_items.category", "bebida")
      .order("created_at", { ascending: true });

    if (tableError) {
      console.error("❌ Error obteniendo items de mesas:", tableError);
      throw new Error(
        `Error obteniendo items de bar (mesas): ${tableError.message}`,
      );
    }

    // 2. Obtener items de DELIVERIES (delivery_order_items)
    const { data: deliveryItems, error: deliveryError } = await supabaseAdmin
      .from("delivery_order_items")
      .select(
        `
        id,
        delivery_order_id,
        menu_item_id,
        quantity,
        unit_price,
        subtotal,
        status,
        created_at,
        menu_items!inner(
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        ),
        delivery_orders!inner(
          id,
          user_id,
          total_amount,
          estimated_time,
          is_paid,
          notes,
          created_at,
          updated_at,
          users(id, first_name, last_name, profile_image)
        )
      `,
      )
      .in("status", ["accepted", "preparing", "ready"])
      .eq("menu_items.category", "bebida")
      .order("created_at", { ascending: true });

    if (deliveryError) {
      console.error("❌ Error obteniendo items de deliveries:", deliveryError);
      throw new Error(
        `Error obteniendo items de bar (deliveries): ${deliveryError.message}`,
      );
    }

    // 3. Combinar items de ambas fuentes en una lista única
    const allItems: any[] = [];

    // Normalizar items de mesas
    if (tableItems && tableItems.length > 0) {
      tableItems.forEach((item: any) => {
        allItems.push({
          ...item,
          is_delivery: false,
          order_id: item.order_id,
          delivery_order_id: null,
          order: item.orders,
          delivery_order: null,
        });
      });
    }

    // Normalizar items de deliveries
    if (deliveryItems && deliveryItems.length > 0) {
      deliveryItems.forEach((item: any) => {
        allItems.push({
          ...item,
          is_delivery: true,
          order_id: null,
          delivery_order_id: item.delivery_order_id,
          order: null,
          delivery_order: item.delivery_orders,
        });
      });
    }

    // 4. Ordenar por created_at (más antiguo primero = mayor prioridad)
    allItems.sort((a, b) => {
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return dateA - dateB;
    });

    if (allItems.length === 0) {
      console.log("🍷 No hay items pendientes para bar");
      return [];
    }

    console.log(
      `🍷 Items encontrados: ${tableItems?.length || 0} de mesas, ${deliveryItems?.length || 0} de deliveries`,
    );

    // 5. Agrupar items por orden (respetando el orden cronológico)
    const ordersMap = new Map<string, OrderWithItems>();

    allItems.forEach(item => {
      const menuItem = (item as any).menu_items;
      const isDelivery = item.is_delivery;
      const sourceOrder = isDelivery ? item.delivery_order : item.order;
      const orderId = isDelivery ? item.delivery_order_id : item.order_id;

      if (!ordersMap.has(orderId)) {
        ordersMap.set(orderId, {
          ...sourceOrder,
          id: orderId,
          table: isDelivery ? null : sourceOrder.tables,
          user: sourceOrder.users,
          is_delivery: isDelivery,
          order_items: [],
        });
      }

      const orderInMap = ordersMap.get(orderId)!;
      orderInMap.order_items.push({
        id: item.id,
        order_id: item.order_id,
        delivery_order_id: item.delivery_order_id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        status: item.status,
        created_at: item.created_at,
        menu_item: menuItem,
        is_delivery: isDelivery,
      });
    });

    const ordersArray = Array.from(ordersMap.values());
    console.log(
      `🍷 Encontradas ${ordersArray.length} órdenes con items para bar (${allItems.length} items totales)`,
    );

    return ordersArray;
  } catch (error) {
    console.error("❌ Error en getBartenderPendingOrders:", error);
    throw error;
  }
}

// Actualizar status de items de bar
// SOPORTA items de mesas (order_items) + items de delivery (delivery_order_items)
export async function updateBartenderItemStatus(
  itemId: string,
  newStatus: OrderItemStatus,
  bartenderId: string,
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(
      `🍷 Actualizando item ${itemId} a status ${newStatus} por bartender ${bartenderId}`,
    );

    // Validar que el nuevo status es válido para bar
    const validStatuses: OrderItemStatus[] = ["preparing", "ready"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Status inválido para bar: ${newStatus}`);
    }

    // 1. Intentar encontrar el item en order_items (mesas)
    const { data: tableItem } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        status,
        order_id,
        menu_items!inner(category)
      `,
      )
      .eq("id", itemId)
      .single();

    // 2. Si no se encuentra en mesas, buscar en delivery_order_items
    const { data: deliveryItem } = await supabaseAdmin
      .from("delivery_order_items")
      .select(
        `
        id,
        status,
        delivery_order_id,
        menu_items!inner(category)
      `,
      )
      .eq("id", itemId)
      .single();

    // Determinar si el item existe y de qué tipo es
    const isDelivery = !tableItem && deliveryItem;
    const item = isDelivery ? deliveryItem : tableItem;

    if (!item) {
      throw new Error("Item no encontrado en ninguna tabla");
    }

    // Verificar que es una bebida
    if ((item as any).menu_items.category !== "bebida") {
      throw new Error("Este item no es una bebida");
    }

    // Verificar que el status actual permite la transición
    const currentStatus = item.status as OrderItemStatus;
    const validTransitions: Record<OrderItemStatus, OrderItemStatus[]> = {
      pending: [],
      accepted: ["preparing"],
      rejected: [],
      preparing: ["ready"],
      ready: ["delivered"],
      delivered: [],
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`No se puede cambiar de ${currentStatus} a ${newStatus}`);
    }

    // 3. Actualizar el status en la tabla correspondiente
    if (isDelivery) {
      console.log(`📦 Actualizando item de DELIVERY ${itemId}`);
      const { error: updateError } = await supabaseAdmin
        .from("delivery_order_items")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (updateError) {
        throw new Error(
          `Error actualizando status (delivery): ${updateError.message}`,
        );
      }

      // Sincronizar estado con tabla deliveries
      await syncDeliveryStatus(deliveryItem.delivery_order_id);
    } else {
      console.log(`🍽️ Actualizando item de MESA ${itemId}`);
      const { error: updateError } = await supabaseAdmin
        .from("order_items")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", itemId);

      if (updateError) {
        throw new Error(
          `Error actualizando status (mesa): ${updateError.message}`,
        );
      }
    }

    const statusMessages: Record<"preparing" | "ready", string> = {
      preparing: "Bebida marcada como en preparación",
      ready: "Bebida marcada como lista",
    };

    console.log(
      `✅ ${statusMessages[newStatus as "preparing" | "ready"]} - Item: ${itemId}`,
    );

    return {
      success: true,
      message: statusMessages[newStatus as "preparing" | "ready"],
    };
  } catch (error) {
    console.error("❌ Error en updateBartenderItemStatus:", error);
    throw error;
  }
}

// Verificar si todos los order_items de una mesa están en estado 'delivered'
export async function checkAllItemsDelivered(
  tableId: string,
  userId: string,
): Promise<{
  allDelivered: boolean;
  totalItems: number;
  deliveredItems: number;
  pendingItems: Array<{
    id: string;
    name: string;
    status: OrderItemStatus;
  }>;
}> {
  try {
    // Verificar que la mesa existe
    const { data: tableExists, error: tableExistsError } = await supabaseAdmin
      .from("tables")
      .select("id")
      .eq("id", tableId)
      .single();

    if (tableExistsError || !tableExists) {
      throw new Error("La mesa no existe");
    }

    // Obtener todas las órdenes NO PAGADAS del usuario para esta mesa
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("table_id", tableId)
      .eq("user_id", userId)
      .eq("is_paid", false); // CRÍTICO: Solo órdenes no pagadas

    if (ordersError) {
      throw new Error(`Error obteniendo órdenes: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      // Si no hay órdenes no pagadas del usuario para esta mesa
      return {
        allDelivered: true, // Si no hay órdenes pendientes, consideramos que todo está entregado
        totalItems: 0,
        deliveredItems: 0,
        pendingItems: [],
      };
    }

    // Extraer los IDs de las órdenes
    const orderIds = orders.map(order => order.id);

    // Obtener todos los order_items de estas órdenes
    const { data: orderItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        status,
        menu_items(
          id,
          name
        )
      `,
      )
      .in("order_id", orderIds);

    if (itemsError) {
      throw new Error(`Error obteniendo items: ${itemsError.message}`);
    }

    if (!orderItems || orderItems.length === 0) {
      return {
        allDelivered: true, // Si no hay items, consideramos que todo está "entregado"
        totalItems: 0,
        deliveredItems: 0,
        pendingItems: [],
      };
    }

    // Filtrar items que NO son 'rejected' (solo considerar items válidos para entrega)
    const validItems = orderItems.filter(item => item.status !== "rejected");
    const deliveredItems = validItems.filter(
      item => item.status === "delivered",
    );
    const pendingItems = validItems
      .filter(item => item.status !== "delivered")
      .map(item => ({
        id: item.id,
        name: (item as any).menu_items?.name || "Item desconocido",
        status: item.status as OrderItemStatus,
      }));

    // Considerar "todo entregado" si todos los items válidos (no rejected) están delivered
    const allDelivered =
      validItems.length === 0 || deliveredItems.length === validItems.length;

    return {
      allDelivered,
      totalItems: validItems.length, // Solo contar items válidos (no rejected)
      deliveredItems: deliveredItems.length,
      pendingItems,
    };
  } catch (error) {
    console.error("❌ Error en checkAllItemsDelivered:", error);
    throw error;
  }
}

// Procesar pago de una orden
export async function payOrder(
  tableId: string,
  clientId: string,
  paymentDetails?: {
    totalAmount: number;
    tipAmount: number;
    gameDiscountAmount?: number;
    gameDiscountPercentage?: number;
    satisfactionLevel?: string;
  },
): Promise<{
  success: boolean;
  message: string;
  paidOrders: OrderWithItems[];
}> {
  try {
    console.log(
      `💳 Procesando pago para mesa ${tableId} del cliente ${clientId}`,
    );
    if (paymentDetails) {
      console.log(`💰 Detalles de pago:`, paymentDetails);
    }

    // 1. Verificar que el cliente tiene acceso a la mesa
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .eq("id_client", clientId)
      .eq("is_occupied", true)
      .single();

    if (tableError || !table) {
      console.error(
        `❌ Error verificando mesa: ${tableError?.message || "Mesa no encontrada"}`,
      );
      throw new Error("Mesa no encontrada o no tienes acceso a ella");
    }

    console.log(
      `✅ Mesa verificada: ${table.number}, estado actual: ${table.table_status}`,
    );

    // 2. Obtener todas las órdenes no pagadas del cliente en esta mesa
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id, total_amount")
      .eq("table_id", tableId)
      .eq("user_id", clientId)
      .eq("is_paid", false);

    if (ordersError) {
      throw new Error(`Error obteniendo órdenes: ${ordersError.message}`);
    }

    if (!orders || orders.length === 0) {
      throw new Error("No hay órdenes pendientes de pago");
    }

    console.log(`📝 Encontradas ${orders.length} órdenes para procesar pago`);

    // 3. ACTUALIZAR TOTAL_AMOUNT si hay descuentos de juegos
    if (
      paymentDetails?.gameDiscountAmount &&
      paymentDetails.gameDiscountAmount > 0
    ) {
      console.log(
        `🎮 Aplicando descuento de juegos: $${paymentDetails.gameDiscountAmount} (${paymentDetails.gameDiscountPercentage}%)`,
      );

      // Calcular el total original de todas las órdenes
      const originalTotal = orders.reduce(
        (sum, order) => sum + (order.total_amount || 0),
        0,
      );
      console.log(`💵 Total original: $${originalTotal}`);

      // Calcular el nuevo total después del descuento (sin incluir propina)
      const discountedTotal = originalTotal - paymentDetails.gameDiscountAmount;
      console.log(`💵 Total después del descuento: $${discountedTotal}`);

      // Actualizar proporcionalmente cada orden
      for (const order of orders) {
        const orderProportion = (order.total_amount || 0) / originalTotal;
        const orderDiscount =
          paymentDetails.gameDiscountAmount * orderProportion;
        const newOrderTotal = (order.total_amount || 0) - orderDiscount;

        console.log(
          `📋 Orden ${order.id}: $${order.total_amount} → $${newOrderTotal.toFixed(2)} (descuento: $${orderDiscount.toFixed(2)})`,
        );

        const { error: updateError } = await supabaseAdmin
          .from("orders")
          .update({
            total_amount: Math.round(newOrderTotal * 100) / 100, // Redondear a 2 decimales
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        if (updateError) {
          console.error(
            `❌ Error actualizando orden ${order.id}:`,
            updateError,
          );
          throw new Error(
            `Error aplicando descuento a la orden: ${updateError.message}`,
          );
        }
      }

      console.log(`✅ Descuentos de juegos aplicados a todas las órdenes`);
    }

    // 3. NO actualizar is_paid aquí - se actualizará cuando el mozo confirme
    // Las órdenes permanecen con is_paid = false hasta la confirmación del mozo

    console.log(
      `🔄 Procesando pago del cliente (pendiente de confirmación del mozo)`,
    );

    // 4. PRIMERO: Marcar la mesa como "pago pendiente de confirmación"
    console.log(`🔄 Actualizando mesa ${tableId} a payment_pending...`);
    const { error: tableUpdateError } = await supabaseAdmin
      .from("tables")
      .update({
        table_status: "payment_pending", // Nuevo estado: pago pendiente de confirmación por el mozo
      })
      .eq("id", tableId);

    if (tableUpdateError) {
      console.error(
        `❌ Error actualizando estado de mesa: ${tableUpdateError.message}`,
      );
      throw new Error(
        `Error actualizando estado de mesa: ${tableUpdateError.message}`,
      );
    }

    console.log(
      `✅ Mesa ${tableId} marcada como pago pendiente de confirmación`,
    );

    // 5. NOTIFICAR AL MOZO sobre el pago realizado
    if (table.id_waiter) {
      try {
        // Obtener información del cliente
        const { data: clientData, error: clientError } = await supabaseAdmin
          .from("users")
          .select("first_name, last_name")
          .eq("id", clientId)
          .single();

        const clientName =
          clientData && !clientError
            ? `${clientData.first_name} ${clientData.last_name}`.trim()
            : "Cliente";

        // Calcular el total de las órdenes
        const { data: orderAmounts } = await supabaseAdmin
          .from("orders")
          .select("total_amount, user_id, is_paid")
          .eq("table_id", tableId)
          .eq("user_id", clientId)
          .eq("is_paid", false);

        const totalAmount =
          orderAmounts?.reduce(
            (sum, order) => sum + (order.total_amount || 0),
            0,
          ) || 0;

        // Importar la función de notificación aquí para evitar dependencia circular
        const { notifyWaiterPaymentCompleted } = await import(
          "../../services/pushNotificationService"
        );

        await notifyWaiterPaymentCompleted(
          table.id_waiter,
          clientName,
          table.number,
          totalAmount,
        );
      } catch (notifyError) {
        console.error(
          "Error enviando notificación de pago al mozo:",
          notifyError,
        );
        // No bloqueamos la función por error de notificación
      }
    }

    // 6. SEGUNDO: Actualizar el estado de waiting_list a 'confirm_pending' si el cliente tiene una entrada activa
    console.log(
      `🔄 Buscando entrada en waiting_list para cliente ${clientId}...`,
    );
    const { data: waitingEntry, error: waitingError } = await supabaseAdmin
      .from("waiting_list")
      .select("*")
      .eq("client_id", clientId)
      .in("status", ["waiting", "seated"])
      .order("joined_at", { ascending: false })
      .limit(1)
      .single();

    if (!waitingError && waitingEntry) {
      console.log(
        `✅ Entrada en waiting_list encontrada: ${waitingEntry.id}, estado actual: ${waitingEntry.status}`,
      );
      console.log(
        `🎯 Actualizando waiting_list entry ${waitingEntry.id} a confirm_pending`,
      );

      const { error: waitingUpdateError } = await supabaseAdmin
        .from("waiting_list")
        .update({
          status: "confirm_pending",
          updated_at: new Date().toISOString(),
        })
        .eq("id", waitingEntry.id);

      if (waitingUpdateError) {
        console.error(
          `❌ Error actualizando waiting_list: ${waitingUpdateError.message}`,
        );
        console.warn(
          `⚠️ Error actualizando waiting_list: ${waitingUpdateError.message}`,
        );
        // No falla la función por esto, el pago ya se procesó
      } else {
        console.log(`✅ Waiting_list entry marcada como confirm_pending`);
      }
    } else {
      console.log(
        `ℹ️ No se encontró entrada activa en waiting_list para el cliente`,
      );
      if (waitingError) {
        console.warn(`⚠️ Error buscando waiting_list: ${waitingError.message}`);
      }
    }

    // 6. Obtener las órdenes para retornar (aún no pagadas, pero procesadas)
    const orderIds = orders.map(order => order.id);
    const paidOrders: OrderWithItems[] = [];
    for (const orderId of orderIds) {
      try {
        const order = await getOrderById(orderId);
        paidOrders.push(order);
      } catch (error) {
        console.warn(`⚠️ Error obteniendo orden ${orderId}:`, error);
      }
    }

    return {
      success: true,
      message: `Pago procesado y pendiente de confirmación del mozo para ${orders.length} órdenes`,
      paidOrders,
    };
  } catch (error) {
    console.error("❌ Error procesando pago:", error);
    throw error;
  }
}

// Confirmar pago y liberar mesa (función para mozos)
export async function confirmPaymentAndReleaseTable(
  tableId: string,
  waiterId: string,
  payingClientId: string, // NUEVO PARÁMETRO: ID del cliente que solicitó el pago
  invoiceInfo?: {
    generated: boolean;
    filePath?: string;
    fileName?: string;
    htmlContent?: string;
    isRegistered?: boolean;
    message?: string;
    error?: string;
  },
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`💰 Mozo ${waiterId} confirmando pago para mesa ${tableId}`);

    // 1. Verificar que la mesa tiene pago pendiente y que el mozo es el asignado
    const { data: table, error: tableError } = await supabaseAdmin
      .from("tables")
      .select("*")
      .eq("id", tableId)
      .eq("id_waiter", waiterId)
      .eq("table_status", "payment_pending")
      .eq("is_occupied", true)
      .single();

    if (tableError || !table) {
      throw new Error(
        "Mesa no encontrada, no tienes acceso o no hay pago pendiente",
      );
    }

    // 2. Marcar todas las órdenes del cliente específico como pagadas
    const { data: orders, error: ordersError } = await supabaseAdmin
      .from("orders")
      .select("id")
      .eq("table_id", tableId)
      .eq("user_id", payingClientId) // Usar el cliente que solicitó el pago
      .eq("is_paid", false); // Solo órdenes que aún no están marcadas como pagadas

    if (ordersError) {
      throw new Error(`Error obteniendo órdenes: ${ordersError.message}`);
    }

    if (orders && orders.length > 0) {
      const orderIds = orders.map(order => order.id);
      const { error: updateError } = await supabaseAdmin
        .from("orders")
        .update({
          is_paid: true,
          updated_at: new Date().toISOString(),
        })
        .in("id", orderIds);

      if (updateError) {
        throw new Error(
          `Error marcando órdenes como pagadas: ${updateError.message}`,
        );
      }

      console.log(
        `✅ ${orders.length} órdenes marcadas como pagadas por confirmación del mozo`,
      );
    }

    // 3. Actualizar waiting_list a 'completed' para el cliente que pagó
    const { data: waitingEntry, error: waitingError } = await supabaseAdmin
      .from("waiting_list")
      .select("*")
      .eq("client_id", payingClientId) // Usar el cliente que solicitó el pago
      .eq("status", "confirm_pending")
      .order("joined_at", { ascending: false })
      .limit(1)
      .single();

    if (!waitingError && waitingEntry) {
      console.log(
        `🎯 Actualizando waiting_list entry ${waitingEntry.id} a completed`,
      );

      const { error: waitingUpdateError } = await supabaseAdmin
        .from("waiting_list")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", waitingEntry.id);

      if (waitingUpdateError) {
        console.warn(
          `⚠️ Error actualizando waiting_list: ${waitingUpdateError.message}`,
        );
      } else {
        console.log(`✅ Waiting_list entry marcada como completed`);
      }
    } else {
      console.log(
        `ℹ️ No se encontró entrada confirm_pending en waiting_list para el cliente`,
      );
    }

    // 4. Liberar completamente la mesa
    const { error: releaseError } = await supabaseAdmin
      .from("tables")
      .update({
        id_client: null,
        table_status: "pending",
        is_occupied: false,
      })
      .eq("id", tableId);

    if (releaseError) {
      throw new Error(`Error liberando mesa: ${releaseError.message}`);
    }

    console.log(
      `✅ Mesa ${tableId} liberada completamente por mozo ${waiterId}`,
    );

    // 5. Obtener el total real SOLO de las órdenes que acabamos de marcar como pagadas
    let finalTotalAmount = 0;
    if (orders && orders.length > 0) {
      const orderIds = orders.map(order => order.id);
      const { data: paidOrdersData } = await supabaseAdmin
        .from("orders")
        .select("total_amount")
        .in("id", orderIds);

      finalTotalAmount =
        paidOrdersData?.reduce(
          (sum, order) => sum + (order.total_amount || 0),
          0,
        ) || 0;
    }

    // 6. Obtener información del cliente que pagó y mozo para las notificaciones
    const { data: clientData, error: clientError } = await supabaseAdmin
      .from("users")
      .select("first_name, last_name")
      .eq("id", payingClientId) // Usar el cliente que solicitó el pago
      .single();

    const { data: waiterData, error: waiterError } = await supabaseAdmin
      .from("users")
      .select("first_name, last_name")
      .eq("id", waiterId)
      .single();

    const clientName =
      clientData && !clientError
        ? `${clientData.first_name} ${clientData.last_name}`.trim()
        : "Cliente";

    const waiterName =
      waiterData && !waiterError
        ? `${waiterData.first_name} ${waiterData.last_name}`.trim()
        : "Mozo";

    // 7. PUNTO 22: Entrega diferenciada de factura según tipo de usuario
    if (invoiceInfo?.generated) {
      try {
        // Obtener datos del cliente de la tabla users
        const { data: clientData, error: clientError } = await supabaseAdmin
          .from("users")
          .select("first_name, last_name")
          .eq("id", payingClientId)
          .single();

        if (clientError || !clientData) {
          console.error("❌ Error obteniendo datos del cliente:", clientError);
          throw new Error("No se pudieron obtener datos del cliente");
        }

        const clientName =
          `${clientData.first_name} ${clientData.last_name}`.trim();

        if (invoiceInfo.isRegistered && invoiceInfo.htmlContent) {
          // USUARIO REGISTRADO: Enviar factura por email (HTML embebido)
          console.log(`📧 Enviando factura por email a usuario registrado`);

          // Obtener email del cliente desde Firebase Auth
          const { getAuthEmailById } = await import("../admin/adminServices");
          const clientEmail = await getAuthEmailById(payingClientId);

          if (!clientEmail) {
            throw new Error("No se pudo obtener email del cliente registrado");
          }

          const { InvoiceEmailService } = await import(
            "../../services/invoiceEmailService"
          );
          const emailResult = await InvoiceEmailService.sendInvoiceByEmail(
            clientEmail,
            invoiceInfo.htmlContent,
            {
              clientName,
              tableNumber: table.number.toString(),
              invoiceNumber: `INV-${Date.now()}`,
              totalAmount: finalTotalAmount,
              invoiceDate: new Date().toLocaleDateString("es-AR"),
            },
          );

          if (emailResult.success) {
            console.log(
              `✅ Factura enviada por email exitosamente a: ${clientEmail}`,
            );
          } else {
            console.error(
              `❌ Error enviando factura por email: ${emailResult.error}`,
            );
          }
        } else if (
          !invoiceInfo.isRegistered &&
          invoiceInfo.filePath &&
          invoiceInfo.fileName
        ) {
          // USUARIO ANÓNIMO: Enviar notificación push con enlace de descarga
          console.log(
            `📱 Enviando notificación push con enlace de descarga a usuario anónimo`,
          );

          const { notifyAnonymousClientInvoiceReady } = await import(
            "../../services/pushNotificationService"
          );
          await notifyAnonymousClientInvoiceReady(
            payingClientId,
            table.number.toString(),
            finalTotalAmount,
            {
              generated: true,
              filePath: invoiceInfo.filePath,
              fileName: invoiceInfo.fileName,
              message: invoiceInfo.message || "Factura generada exitosamente",
            },
          );
        } else {
          console.warn(
            `⚠️ Factura generada pero faltan datos para entrega: isRegistered=${invoiceInfo.isRegistered}, hasHTML=${!!invoiceInfo.htmlContent}, hasFile=${!!invoiceInfo.filePath}`,
          );
        }
      } catch (deliveryError) {
        console.error(
          `❌ Error en entrega diferenciada de factura:`,
          deliveryError,
        );
        // Continúa con notificación normal como fallback
      }
    }

    // 8. Enviar notificación estándar al cliente confirmando que el pago fue recibido
    try {
      const { notifyClientPaymentConfirmation } = await import(
        "../../services/pushNotificationService"
      );
      await notifyClientPaymentConfirmation(
        payingClientId, // Usar el cliente que solicitó el pago
        waiterName,
        table.number,
        finalTotalAmount,
        invoiceInfo,
      );
      console.log(
        `📱 Notificación de pago confirmado enviada al cliente ${invoiceInfo?.generated ? "con información de factura" : "sin factura"}`,
      );
    } catch (notifyError) {
      console.warn(`⚠️ Error enviando notificación al cliente:`, notifyError);
      // No falla la función por esto
    }

    // 9. Enviar notificación a gerencia sobre el pago recibido
    try {
      const { notifyManagementPaymentReceived } = await import(
        "../../services/pushNotificationService"
      );
      await notifyManagementPaymentReceived(
        clientName,
        table.number,
        finalTotalAmount,
        waiterName,
        "efectivo", // Método de pago simulado
      );
      console.log(`📱 Notificación de pago recibido enviada a gerencia`);
    } catch (notifyError) {
      console.warn(`⚠️ Error enviando notificación a gerencia:`, notifyError);
      // No falla la función por esto
    }

    return {
      success: true,
      message: "Pago confirmado y mesa liberada exitosamente",
    };
  } catch (error) {
    console.error("❌ Error confirmando pago:", error);
    throw error;
  }
}

// ============= FUNCIONES PARA MOZOS - ITEMS READY =============

export async function getWaiterReadyItems(waiterId: string): Promise<any[]> {
  try {
    console.log(
      `🥳 Obteniendo items listos para entregar para mozo ${waiterId}`,
    );

    // Obtener todos los items con status 'ready' de las mesas asignadas al mozo
    const { data: readyItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        order_id,
        menu_item_id,
        quantity,
        unit_price,
        subtotal,
        status,
        created_at,
        menu_items!inner(
          id,
          name,
          description,
          prep_minutes,
          price,
          category
        ),
        orders!inner(
          id,
          user_id,
          table_id,
          total_amount,
          estimated_time,
          is_paid,
          notes,
          created_at,
          updated_at,
          tables!inner(
            id, 
            number, 
            id_waiter,
            table_status
          ),
          users(id, first_name, last_name, profile_image)
        )
      `,
      )
      .eq("status", "ready")
      .eq("orders.tables.id_waiter", waiterId)
      .order("created_at", { ascending: true });

    if (itemsError) {
      throw new Error(`Error obteniendo items listos: ${itemsError.message}`);
    }

    if (!readyItems || readyItems.length === 0) {
      console.log("🥳 No hay items listos para entregar");
      return [];
    }

    // Procesar y agrupar los datos
    const groupedByTable = readyItems.reduce((acc: any, item: any) => {
      const tableId = item.orders.table_id;
      const tableNumber = item.orders.tables.number;

      if (!acc[tableId]) {
        acc[tableId] = {
          table_id: tableId,
          table_number: tableNumber,
          customer_name: `${item.orders.users.first_name} ${item.orders.users.last_name}`,
          items: [],
        };
      }

      acc[tableId].items.push({
        id: item.id,
        order_id: item.order_id,
        menu_item: {
          id: item.menu_items.id,
          name: item.menu_items.name,
          description: item.menu_items.description,
          category: item.menu_items.category,
        },
        quantity: item.quantity,
        status: item.status,
        created_at: item.created_at,
      });

      return acc;
    }, {});

    const result = Object.values(groupedByTable);
    console.log(`🥳 ${result.length} mesas con items listos encontradas`);

    return result;
  } catch (error) {
    console.error("❌ Error en getWaiterReadyItems:", error);
    throw error;
  }
}

// Obtener mesas con pago pendiente de confirmación para un mozo
export async function getWaiterPendingPayments(
  waiterId: string,
): Promise<any[]> {
  try {
    // Log más discreto - solo en desarrollo
    if (process.env["NODE_ENV"] === "development") {
      console.log(
        `💰 Verificando mesas con pago pendiente para mozo ${waiterId}`,
      );
    }

    // Primero obtenemos las mesas con pago pendiente
    const { data: tables, error } = await supabaseAdmin
      .from("tables")
      .select(
        `
        id,
        number,
        id_client,
        table_status
      `,
      )
      .eq("id_waiter", waiterId)
      .eq("table_status", "payment_pending")
      .eq("is_occupied", true)
      .order("number", { ascending: true });

    if (error) {
      // Solo loguear errores reales de base de datos, no lanzar excepción
      console.warn(
        `⚠️ Error consultando mesas con pago pendiente: ${error.message}`,
      );
      return [];
    }

    if (!tables || tables.length === 0) {
      // Mensaje más discreto cuando no hay mesas pendientes
      if (process.env["NODE_ENV"] === "development") {
        console.log("💰 No hay mesas con pago pendiente actualmente");
      }
      return [];
    }

    // Luego obtenemos la información de los clientes por separado
    const result = [];
    for (const table of tables) {
      if (table.id_client) {
        const { data: user, error: userError } = await supabaseAdmin
          .from("users")
          .select("id, first_name, last_name, profile_image")
          .eq("id", table.id_client)
          .single();

        // Obtener el total amount de las órdenes del cliente específico que está pidiendo pagar
        const { data: orders } = await supabaseAdmin
          .from("orders")
          .select("total_amount")
          .eq("table_id", table.id)
          .eq("user_id", table.id_client) // Filtrar solo las órdenes del cliente que está pidiendo pagar
          .eq("is_paid", false); // Solo órdenes no pagadas

        const totalAmount = (orders || []).reduce(
          (sum, order) => sum + (order.total_amount || 0),
          0,
        );

        result.push({
          table_id: table.id,
          table_number: table.number,
          customer_name:
            user && !userError
              ? `${user.first_name} ${user.last_name}`
              : "Cliente desconocido",
          customer_id: table.id_client,
          total_amount: totalAmount,
        });
      }
    }

    console.log(`💰 ${result.length} mesa(s) con pago pendiente encontrada(s)`);
    return result;
  } catch (error) {
    // Capturar cualquier error inesperado pero no propagarlo
    console.warn("⚠️ Error verificando pagos pendientes:", error);
    return [];
  }
}

export async function markItemAsDelivered(
  itemId: string,
  waiterId: string,
): Promise<void> {
  try {
    console.log(
      `🚚 Marcando item ${itemId} como entregado por mozo ${waiterId}`,
    );

    // Verificar que el item existe y está en estado 'ready'
    const { data: item, error: itemError } = await supabaseAdmin
      .from("order_items")
      .select(
        `
        id,
        status,
        orders!inner(
          id,
          table_id,
          tables!inner(id, id_waiter)
        )
      `,
      )
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      throw new Error("Item no encontrado");
    }

    if (item.status !== "ready") {
      throw new Error("El item no está en estado 'ready'");
    }

    // Verificar que la mesa está asignada al mozo
    if ((item.orders as any).tables.id_waiter !== waiterId) {
      throw new Error("No tienes permiso para entregar items de esta mesa");
    }

    // Actualizar el status del item a 'delivered'
    const { error: updateError } = await supabaseAdmin
      .from("order_items")
      .update({
        status: "delivered",
        updated_at: new Date().toISOString(),
      })
      .eq("id", itemId);

    if (updateError) {
      throw new Error(`Error actualizando item: ${updateError.message}`);
    }

    console.log(`✅ Item ${itemId} marcado como entregado`);

    // Emitir evento Socket.IO a la mesa para notificar actualización de items entregados
    try {
      const { getIOInstance } = await import("../../socket/chatSocket");
      const io = getIOInstance();

      if (io) {
        const tableId = (item.orders as any).table_id;
        const tableRoom = `table_${tableId}`;

        console.log(`📡 Intentando emitir evento Socket.IO...`);
        console.log(`   - TableId: ${tableId}`);
        console.log(`   - Room: ${tableRoom}`);
        console.log(`   - ItemId: ${itemId}`);

        io.to(tableRoom).emit("order_items_delivered", { tableId });

        // Verificar cuántos clientes hay en la sala
        const room = io.sockets.adapter.rooms.get(tableRoom);
        const clientCount = room?.size || 0;
        console.log(`   - Clientes en sala ${tableRoom}: ${clientCount}`);

        console.log(
          `✅ Evento Socket.IO emitido a room ${tableRoom}: item ${itemId} entregado`,
        );
      } else {
        console.error("⚠️ Socket.IO instance no disponible");
      }
    } catch (socketError) {
      console.error("❌ Error emitiendo evento Socket.IO:", socketError);
      // No lanzar error, el item ya se actualizó correctamente
    }
  } catch (error) {
    console.error("❌ Error en markItemAsDelivered:", error);
    throw error;
  }
}

export async function submitTandaModifications(
  orderId: string,
  clientId: string,
  keepItems?: string[],
  newItems?: Array<{
    menu_item_id: string;
    quantity: number;
    unit_price: number;
  }>,
): Promise<void> {
  try {
    console.log(
      `🔄 Reenviando modificaciones de tanda para orden ${orderId} del cliente ${clientId}`,
    );
    console.log("📦 keepItems:", keepItems);
    console.log("📦 newItems:", newItems);

    // 1. Verificar que la orden pertenece al cliente
    const { data: order, error: orderError } = await supabaseAdmin
      .from("orders")
      .select("id, user_id, table_id")
      .eq("id", orderId)
      .eq("user_id", clientId)
      .single();

    if (orderError || !order) {
      throw new Error("Orden no encontrada o no pertenece al cliente");
    }

    // 2. Obtener el batch_id de la tanda existente (de items needs_modification o rejected)
    const { data: existingBatchItem, error: batchError } = await supabaseAdmin
      .from("order_items")
      .select("batch_id")
      .eq("order_id", orderId)
      .or("status.eq.needs_modification,status.eq.rejected")
      .limit(1)
      .single();

    if (batchError && batchError.code !== "PGRST116") {
      // PGRST116 = no rows returned
      throw new Error(`Error obteniendo batch_id: ${batchError.message}`);
    }

    const tandaBatchId = existingBatchItem?.batch_id;
    console.log("🔖 Batch ID de la tanda:", tandaBatchId);

    // 3. Calcular los cambios en el total_amount
    let amountToAdd = 0; // Nuevos items a sumar
    let amountToSubtract = 0; // Items removidos a restar

    // Obtener items needs_modification actuales para calcular cuáles se eliminan
    const { data: needsModItems, error: needsModError } = await supabaseAdmin
      .from("order_items")
      .select("id, subtotal")
      .eq("order_id", orderId)
      .eq("status", "needs_modification");

    if (needsModError) {
      throw new Error(
        `Error obteniendo items needs_modification: ${needsModError.message}`,
      );
    }

    // Calcular items que se van a eliminar (needs_modification que NO están en keepItems)
    const itemsToRemove = (needsModItems || []).filter(
      item => !keepItems?.includes(item.id),
    );
    amountToSubtract = itemsToRemove.reduce(
      (sum, item) => sum + (item.subtotal || 0),
      0,
    );

    console.log(
      `💰 Items a eliminar: ${itemsToRemove.length}, monto a restar: $${amountToSubtract}`,
    );

    // Calcular nuevos items a agregar
    if (newItems && newItems.length > 0) {
      amountToAdd = newItems.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0,
      );
      console.log(
        `💰 Nuevos items: ${newItems.length}, monto a sumar: $${amountToAdd}`,
      );

      // Verificar que ningún item nuevo esté rechazado en la orden actual
      const { data: rejectedItems, error: rejectedError } = await supabaseAdmin
        .from("order_items")
        .select("menu_item_id")
        .eq("order_id", orderId)
        .eq("status", "rejected");

      if (!rejectedError && rejectedItems && rejectedItems.length > 0) {
        const rejectedMenuItemIds = new Set(
          rejectedItems.map((item: any) => item.menu_item_id),
        );

        const blockedNewItems = newItems.filter(item =>
          rejectedMenuItemIds.has(item.menu_item_id),
        );

        if (blockedNewItems.length > 0) {
          throw new Error(
            "No puedes agregar productos que ya fueron rechazados en esta sesión",
          );
        }
      }
    }

    // 4. Eliminar items needs_modification que NO están en keepItems
    if (itemsToRemove.length > 0) {
      const itemIdsToRemove = itemsToRemove.map(item => item.id);
      const { error: deleteError } = await supabaseAdmin
        .from("order_items")
        .delete()
        .in("id", itemIdsToRemove);

      if (deleteError) {
        throw new Error(
          `Error eliminando items no mantenidos: ${deleteError.message}`,
        );
      }

      console.log(
        `🗑️ ${itemsToRemove.length} items needs_modification eliminados`,
      );
    }

    // 5. Si hay keepItems, cambiar esos items de 'needs_modification' a 'pending'
    if (keepItems && keepItems.length > 0) {
      const { data: keptItemsData, error: updateError } = await supabaseAdmin
        .from("order_items")
        .update({
          status: "pending",
          updated_at: new Date().toISOString(),
        })
        .eq("order_id", orderId)
        .in("id", keepItems)
        .eq("status", "needs_modification")
        .select("id, menu_items(name)");

      if (updateError) {
        throw new Error(
          `Error actualizando items mantenidos: ${updateError.message}`,
        );
      }

      if (keptItemsData && keptItemsData.length > 0) {
        const itemNames = keptItemsData
          .map(item => (item as any).menu_items?.name || "Item desconocido")
          .join(", ");

        console.log(
          `✅ ${keptItemsData.length} items mantenidos y reenviados: ${itemNames}`,
        );
      }
    }

    // 6. Si hay newItems, agregarlos a la orden con el MISMO batch_id de la tanda
    if (newItems && newItems.length > 0) {
      if (!tandaBatchId) {
        throw new Error("No se pudo obtener el batch_id de la tanda existente");
      }

      const itemsToInsert = newItems.map(item => ({
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
        status: "pending",
        batch_id: tandaBatchId, // ✅ Usar el batch_id de la tanda existente
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { data: insertedItems, error: insertError } = await supabaseAdmin
        .from("order_items")
        .insert(itemsToInsert)
        .select("id, menu_items(name)");

      if (insertError) {
        throw new Error(
          `Error insertando nuevos items: ${insertError.message}`,
        );
      }

      if (insertedItems && insertedItems.length > 0) {
        const newItemNames = insertedItems
          .map(item => (item as any).menu_items?.name || "Item desconocido")
          .join(", ");

        console.log(
          `✅ ${insertedItems.length} items nuevos agregados con batch_id ${tandaBatchId}: ${newItemNames}`,
        );
      }
    }

    // 7. Actualizar total_amount de la orden
    const { data: currentOrder, error: getOrderError } = await supabaseAdmin
      .from("orders")
      .select("total_amount")
      .eq("id", orderId)
      .single();

    if (getOrderError || !currentOrder) {
      throw new Error("Error obteniendo orden actual");
    }

    const newTotalAmount =
      currentOrder.total_amount - amountToSubtract + amountToAdd;

    console.log(
      `💰 Actualizando total: $${currentOrder.total_amount} - $${amountToSubtract} + $${amountToAdd} = $${newTotalAmount}`,
    );

    const { error: updateTotalError } = await supabaseAdmin
      .from("orders")
      .update({
        total_amount: newTotalAmount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    if (updateTotalError) {
      throw new Error(
        `Error actualizando total_amount: ${updateTotalError.message}`,
      );
    }

    // 8. Los items 'rejected' se mantienen como están (registro auxiliar para el cliente)
    // NO se eliminan ni se modifican - sirven como historial de productos no disponibles
    console.log("ℹ️ Items rechazados mantenidos como registro auxiliar");

    console.log("✅ Modificaciones de tanda procesadas exitosamente");
  } catch (error) {
    console.error("❌ Error en submitTandaModifications:", error);
    throw error;
  }
}

// ============= FUNCIÓN PARA SINCRONIZAR ESTADO DE DELIVERY =============

/**
 * Sincroniza el estado de la tabla deliveries basándose en el estado de los delivery_order_items
 * Lógica de transición:
 * - Si algún item está en 'preparing' -> delivery status = 'preparing'
 * - Si todos los items están en 'ready' -> delivery status = 'ready'
 * - Si todos los items están en 'delivered' -> delivery status = 'delivered'
 */
export async function syncDeliveryStatus(
  deliveryOrderId: string,
): Promise<void> {
  try {
    console.log(
      `🔄 Sincronizando estado de delivery para orden ${deliveryOrderId}`,
    );

    // 1. Obtener todos los items de esta delivery order
    const { data: items, error: itemsError } = await supabaseAdmin
      .from("delivery_order_items")
      .select("id, status")
      .eq("delivery_order_id", deliveryOrderId);

    if (itemsError || !items || items.length === 0) {
      console.warn(
        `⚠️ No se encontraron items para delivery_order ${deliveryOrderId}`,
      );
      return;
    }

    console.log(
      `📊 Items encontrados: ${items.length}, estados: ${items.map(i => i.status).join(", ")}`,
    );

    // 2. Determinar el nuevo estado de la delivery según los items
    const statuses = items.map(item => item.status);
    const allDelivered = statuses.every(status => status === "delivered");
    const allReady = statuses.every(status => status === "ready");
    const somePreparing = statuses.some(status => status === "preparing");
    const someReady = statuses.some(status => status === "ready");

    let newDeliveryStatus: string;

    // Lógica de prioridad (de más avanzado a menos):
    if (allDelivered) {
      // Todos entregados → delivery completado
      newDeliveryStatus = "delivered";
    } else if (allReady) {
      // Todos listos → delivery listo para enviar
      newDeliveryStatus = "ready";
    } else if (someReady || somePreparing) {
      // Si hay al menos un item en preparing o ready → delivery en preparación
      newDeliveryStatus = "preparing";
    } else {
      // Todos en 'accepted' → mantener confirmed
      newDeliveryStatus = "confirmed";
    }

    console.log(
      `➡️ Nuevo estado de delivery determinado: ${newDeliveryStatus} (todos delivered: ${allDelivered}, todos ready: ${allReady}, alguno preparing/ready: ${somePreparing || someReady})`,
    );

    // 3. Obtener el delivery actual para verificar si necesita actualización
    const { data: delivery, error: deliveryError } = await supabaseAdmin
      .from("deliveries")
      .select("id, status, delivery_order_id, user_id")
      .eq("delivery_order_id", deliveryOrderId)
      .single();

    if (deliveryError || !delivery) {
      console.warn(
        `⚠️ No se encontró delivery para delivery_order ${deliveryOrderId}`,
      );
      return;
    }

    // 4. Solo actualizar si el estado cambió
    if (delivery.status === newDeliveryStatus) {
      console.log(
        `✅ Estado ya es ${newDeliveryStatus}, no se requiere actualización`,
      );
      return;
    }

    // 5. Actualizar el estado de la delivery
    const { error: updateError } = await supabaseAdmin
      .from("deliveries")
      .update({
        status: newDeliveryStatus,
      })
      .eq("id", delivery.id);

    if (updateError) {
      console.error(`❌ Error actualizando delivery:`, updateError);
      throw new Error(`Error actualizando delivery: ${updateError.message}`);
    }

    console.log(
      `✅ Delivery ${delivery.id} actualizado de ${delivery.status} a ${newDeliveryStatus}`,
    );

    // 6. Emitir evento Socket.IO para notificar al cliente
    try {
      const { getIOInstance } = await import("../../socket/chatSocket");
      const io = getIOInstance();

      if (io && delivery.user_id) {
        const userRoom = `user_${delivery.user_id}`;
        io.to(userRoom).emit("delivery_status_changed", {
          deliveryId: delivery.id,
          deliveryOrderId: deliveryOrderId,
          oldStatus: delivery.status,
          newStatus: newDeliveryStatus,
          updatedAt: new Date().toISOString(),
        });

        console.log(
          `📡 Evento Socket.IO emitido a room ${userRoom}: delivery_status_changed`,
        );
      }
    } catch (socketError) {
      console.error(
        `⚠️ Error emitiendo evento Socket.IO (no crítico):`,
        socketError,
      );
      // No lanzar error, el estado se actualizó correctamente
    }
  } catch (error) {
    console.error(`❌ Error en syncDeliveryStatus:`, error);
    throw error;
  }
}
