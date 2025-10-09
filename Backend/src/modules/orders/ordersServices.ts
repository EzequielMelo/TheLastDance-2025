import { supabaseAdmin } from "../../config/supabase";
import type {
  CreateOrderDTO,
  Order,
  OrderWithItems,
  OrderStatus,
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
        status: "pending",
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

// Actualizar estado del pedido
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
): Promise<Order> {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select()
    .single();

  if (error)
    throw new Error(`Error actualizando estado del pedido: ${error.message}`);
  return data as Order;
}

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
    .in("status", ["pending"])
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(
      `Error obteniendo pedidos pendientes para mozo: ${error.message}`,
    );
  return (data as OrderWithItems[]) || [];
}

// Obtener pedidos en proceso para un mozo específico (aceptados, preparando, listos)
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
    .in("status", ["accepted", "preparing", "ready"])
    .order("created_at", { ascending: true });

  if (error)
    throw new Error(
      `Error obteniendo pedidos activos para mozo: ${error.message}`,
    );
  return (data as any) || [];
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
