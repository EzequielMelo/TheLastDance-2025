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

    // 1. Validar que todos los productos existen y están activos
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

    // 5. Crear los items del pedido usando los datos del frontend
    const orderItemsData = orderData.items.map(item => ({
      order_id: newOrder.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      status: "pending" as OrderItemStatus, // NUEVO: Items inician pendientes
    }));

    const { error: itemsError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsData);

    if (itemsError)
      throw new Error(`Error creando items del pedido: ${itemsError.message}`);

    // 6. Obtener el pedido completo con items
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

  if (error)
    throw new Error(`Error obteniendo pedidos del usuario: ${error.message}`);
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

    // 5. Insertar nuevos order_items con status 'pending'
    const orderItemsToInsert = newItems.map(item => ({
      order_id: orderId,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
      status: "pending" as OrderItemStatus, // Los nuevos items siempre empiezan como pending
    }));

    const { error: insertError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsToInsert);

    if (insertError)
      throw new Error(`Error insertando items: ${insertError.message}`);

    // 6. Recalcular totales de la orden (solo items aceptados + pendientes)
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
      .in("status", ["accepted", "pending"]); // Solo contar items no rechazados

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

    // 7. Actualizar orden - solo actualizar totales (los items nuevos van como pending)
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
      `✅ Items agregados exitosamente a la orden ${orderId}. Nuevos items en estado 'pending'`,
    );

    // 8. Obtener orden actualizada completa
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

    // 3. Actualizar status de los items
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

    // 4. Recalcular total de la orden (solo items aceptados + accepted)
    const { data: acceptedItems, error: acceptedError } = await supabaseAdmin
      .from("order_items")
      .select("subtotal")
      .eq("order_id", orderId)
      .in("status", ["accepted"]);

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

    // 5. Crear nuevos items (en estado pending)
    const orderItemsToInsert = newItems.map(item => ({
      order_id: orderId,
      menu_item_id: item.menu_item_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.unit_price * item.quantity,
      status: "pending" as OrderItemStatus,
      created_at: new Date().toISOString(),
    }));

    const { error: insertError } = await supabaseAdmin
      .from("order_items")
      .insert(orderItemsToInsert);

    if (insertError) {
      throw new Error(`Error insertando nuevos items: ${insertError.message}`);
    }

    // 6. Recalcular totales de la orden (solo items no rechazados)
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

// Obtener pedidos pendientes para cocina (items con category "plato" y status "accepted")
export async function getKitchenPendingOrders(): Promise<OrderWithItems[]> {
  try {
    console.log("👨‍🍳 Obteniendo pedidos pendientes para cocina...");

    // Obtener todos los items aceptados que son platos
    const { data: kitchenItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
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
      `)
      .eq("status", "accepted")
      .eq("menu_items.category", "plato")
      .order("created_at", { ascending: true });

    if (itemsError) {
      throw new Error(`Error obteniendo items de cocina: ${itemsError.message}`);
    }

    if (!kitchenItems || kitchenItems.length === 0) {
      console.log("👨‍🍳 No hay items pendientes para cocina");
      return [];
    }

    // Agrupar items por orden
    const ordersMap = new Map<string, OrderWithItems>();

    kitchenItems.forEach((item) => {
      const order = (item as any).orders;
      const menuItem = (item as any).menu_items;

      if (!ordersMap.has(order.id)) {
        ordersMap.set(order.id, {
          ...order,
          table: order.tables,
          user: order.users,
          order_items: []
        });
      }

      const orderInMap = ordersMap.get(order.id)!;
      orderInMap.order_items.push({
        id: item.id,
        order_id: item.order_id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        status: item.status,
        created_at: item.created_at,
        menu_item: menuItem
      });
    });

    const ordersArray = Array.from(ordersMap.values());
    console.log(`👨‍🍳 Encontradas ${ordersArray.length} órdenes con items para cocina`);

    return ordersArray;
  } catch (error) {
    console.error("❌ Error en getKitchenPendingOrders:", error);
    throw error;
  }
}

// Actualizar status de items de cocina
export async function updateKitchenItemStatus(
  itemId: string,
  newStatus: OrderItemStatus,
  cookId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`👨‍🍳 Actualizando item ${itemId} a status ${newStatus} por cocinero ${cookId}`);

    // Validar que el nuevo status es válido para cocina
    const validStatuses: OrderItemStatus[] = ["preparing", "ready"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Status inválido para cocina: ${newStatus}`);
    }

    // Verificar que el item existe y es un plato
    const { data: item, error: itemError } = await supabaseAdmin
      .from("order_items")
      .select(`
        id,
        status,
        menu_items!inner(category)
      `)
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      throw new Error("Item no encontrado");
    }

    if ((item.menu_items as any).category !== "plato") {
      throw new Error("Este item no corresponde a cocina");
    }

    if (item.status !== "accepted" && item.status !== "preparing") {
      throw new Error(`No se puede cambiar el status desde ${item.status}`);
    }

    // Actualizar el status
    const { error: updateError } = await supabaseAdmin
      .from("order_items")
      .update({
        status: newStatus,
      })
      .eq("id", itemId);

    if (updateError) {
      throw new Error(`Error actualizando status: ${updateError.message}`);
    }

    console.log(`✅ Item ${itemId} actualizado a ${newStatus}`);

    return {
      success: true,
      message: `Item actualizado a ${newStatus === "preparing" ? "preparando" : "listo"}`
    };
  } catch (error) {
    console.error("❌ Error en updateKitchenItemStatus:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Error interno del servidor"
    };
  }
}

// Obtener estado de pedidos de una mesa específica (para cliente que escanea QR)
export async function getTableOrdersStatus(
  tableId: string,
  userId: string
): Promise<OrderWithItems[]> {
  try {
    console.log(`📱 Obteniendo estado de pedidos para mesa ${tableId} y usuario ${userId}`);

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
      .select(`
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
      `)
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
        menu_item: item.menu_items?.[0] || null
      }))
    }));

    return mappedOrders;
  } catch (error) {
    console.error("❌ Error en getTableOrdersStatus:", error);
    throw error;
  }
}

// ============= FUNCIONES PARA BAR =============

// Obtener pedidos pendientes para bar (items con category "bebida" y status "accepted")
export async function getBartenderPendingOrders(): Promise<OrderWithItems[]> {
  try {
    console.log("🍷 Obteniendo pedidos pendientes para bar...");

    // Obtener todos los items aceptados que son bebidas
    const { data: barItems, error: itemsError } = await supabaseAdmin
      .from("order_items")
      .select(`
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
      `)
      .eq("status", "accepted")
      .eq("menu_items.category", "bebida")
      .order("created_at", { ascending: true });

    if (itemsError) {
      throw new Error(`Error obteniendo items de bar: ${itemsError.message}`);
    }

    if (!barItems || barItems.length === 0) {
      console.log("🍷 No hay items pendientes para bar");
      return [];
    }

    // Agrupar items por orden
    const ordersMap = new Map<string, OrderWithItems>();

    barItems.forEach((item) => {
      const order = (item as any).orders;
      const menuItem = (item as any).menu_items;

      console.log("🍷 Procesando item de bar:", {
        itemId: item.id,
        orderId: order?.id,
        menuItemName: menuItem?.name,
        orderHasTables: !!order?.tables,
        orderHasUsers: !!order?.users
      });

      if (!ordersMap.has(order.id)) {
        ordersMap.set(order.id, {
          ...order,
          table: order.tables,
          user: order.users,
          order_items: []
        });
      }

      const orderInMap = ordersMap.get(order.id)!;
      orderInMap.order_items.push({
        id: item.id,
        order_id: item.order_id,
        menu_item_id: item.menu_item_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
        status: item.status,
        created_at: item.created_at,
        menu_item: menuItem
      });
    });

    const ordersArray = Array.from(ordersMap.values());
    console.log(`🍷 Encontradas ${ordersArray.length} órdenes con items para bar`);
    console.log("🍷 Estructura de primera orden:", JSON.stringify(ordersArray[0], null, 2));

    return ordersArray;
  } catch (error) {
    console.error("❌ Error en getBartenderPendingOrders:", error);
    throw error;
  }
}

// Actualizar status de items de bar
export async function updateBartenderItemStatus(
  itemId: string,
  newStatus: OrderItemStatus,
  bartenderId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`🍷 Actualizando item ${itemId} a status ${newStatus} por bartender ${bartenderId}`);

    // Validar que el nuevo status es válido para bar
    const validStatuses: OrderItemStatus[] = ["preparing", "ready"];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Status inválido para bar: ${newStatus}`);
    }

    // Verificar que el item existe y es una bebida
    const { data: item, error: itemError } = await supabaseAdmin
      .from("order_items")
      .select(`
        id,
        status,
        menu_items!inner(category)
      `)
      .eq("id", itemId)
      .single();

    if (itemError || !item) {
      throw new Error(`Item no encontrado: ${itemError?.message || "Item inexistente"}`);
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
      delivered: []
    };

    if (!validTransitions[currentStatus]?.includes(newStatus)) {
      throw new Error(`No se puede cambiar de ${currentStatus} a ${newStatus}`);
    }

    // Actualizar status
    const { error: updateError } = await supabaseAdmin
      .from("order_items")
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq("id", itemId);

    if (updateError) {
      throw new Error(`Error actualizando status: ${updateError.message}`);
    }

    const statusMessages: Record<"preparing" | "ready", string> = {
      preparing: "Bebida marcada como en preparación",
      ready: "Bebida marcada como lista"
    };

    console.log(`✅ ${statusMessages[newStatus as "preparing" | "ready"]} - Item: ${itemId}`);

    return {
      success: true,
      message: statusMessages[newStatus as "preparing" | "ready"]
    };

  } catch (error) {
    console.error("❌ Error en updateBartenderItemStatus:", error);
    throw error;
  }
}
