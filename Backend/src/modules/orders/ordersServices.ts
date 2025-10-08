import { supabaseAdmin } from "../../config/supabase";
import type { CreateOrderDTO, Order, OrderWithItems, OrderStatus } from "./orders.types";

// Crear nuevo pedido
export async function createOrder(orderData: CreateOrderDTO, userId: string): Promise<OrderWithItems> {
  try {
    console.log('📝 Creando pedido para usuario:', userId);
    console.log('📦 Items del pedido:', orderData.items);

    // 1. Validar que todos los productos existen y están activos
    const menuItemIds = orderData.items.map(item => item.id);
    const { data: menuItems, error: menuError } = await supabaseAdmin
      .from('menu_items')
      .select('id, name, price, prep_minutes')
      .in('id', menuItemIds)
      .eq('is_active', true);

    if (menuError) throw new Error(`Error obteniendo productos: ${menuError.message}`);
    if (!menuItems || menuItems.length === 0) throw new Error('No se encontraron productos válidos');

    // 2. Verificar que todos los productos del frontend existen en la BD
    for (const frontendItem of orderData.items) {
      const dbItem = menuItems.find(mi => mi.id === frontendItem.id);
      if (!dbItem) {
        throw new Error(`Producto no encontrado: ${frontendItem.id}`);
      }
      
      // Opcional: Verificar que los precios coinciden (seguridad)
      if (Math.abs(dbItem.price - frontendItem.price) > 0.01) {
        console.warn(`⚠️ Precio no coincide para ${frontendItem.name}: DB=${dbItem.price}, Frontend=${frontendItem.price}`);
      }
    }

    // 3. Usar los totales del frontend (ya validados)
    const totalAmount = orderData.totalAmount;
    const estimatedTime = orderData.estimatedTime;

    // 4. Crear el pedido principal
    const { data: newOrder, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: userId,
        table_id: orderData.table_id || null,
        total_amount: totalAmount,
        estimated_time: estimatedTime,
        status: 'pending',
        notes: orderData.notes || null,
      })
      .select()
      .single();

    if (orderError) throw new Error(`Error creando pedido: ${orderError.message}`);

    // 5. Crear los items del pedido usando los datos del frontend
    const orderItemsData = orderData.items.map(item => ({
      order_id: newOrder.id,
      menu_item_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: item.price * item.quantity,
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('order_items')
      .insert(orderItemsData);

    if (itemsError) throw new Error(`Error creando items del pedido: ${itemsError.message}`);

    // 6. Obtener el pedido completo con items
    const fullOrder = await getOrderById(newOrder.id);
    
    console.log('✅ Pedido creado exitosamente:', newOrder.id);
    return fullOrder;

  } catch (error) {
    console.error('❌ Error en createOrder:', error);
    throw error;
  }
}

// Obtener pedido por ID con todos sus items
export async function getOrderById(orderId: string): Promise<OrderWithItems> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
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
    `)
    .eq('id', orderId)
    .single();

  if (error) throw new Error(`Error obteniendo pedido: ${error.message}`);
  if (!data) throw new Error('Pedido no encontrado');

  return data as OrderWithItems;
}

// Obtener pedidos del usuario
export async function getUserOrders(userId: string): Promise<OrderWithItems[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
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
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error obteniendo pedidos del usuario: ${error.message}`);
  return data as OrderWithItems[] || [];
}

// Obtener pedidos por mesa
export async function getTableOrders(tableId: string): Promise<OrderWithItems[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
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
    `)
    .eq('table_id', tableId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Error obteniendo pedidos de la mesa: ${error.message}`);
  return data as OrderWithItems[] || [];
}

// Actualizar estado del pedido
export async function updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw new Error(`Error actualizando estado del pedido: ${error.message}`);
  return data as Order;
}

// Obtener pedidos pendientes (para empleados)
export async function getPendingOrders(): Promise<OrderWithItems[]> {
  const { data, error } = await supabaseAdmin
    .from('orders')
    .select(`
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
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Error obteniendo pedidos pendientes: ${error.message}`);
  return data as OrderWithItems[] || [];
}