/**
 * Servicios para Delivery Orders
 * Maneja las órdenes específicas de delivery (sin table_id)
 */
import { supabaseAdmin } from "../../config/supabase";

export type OrderItemStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "needs_modification";

export interface CreateDeliveryOrderDTO {
  userId: string;
  items: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
    prepMinutes: number;
    quantity: number;
    image_url?: string;
  }>;
  totalAmount: number;
  estimatedTime: number;
  notes?: string;
}

export interface DeliveryOrder {
  id: string;
  user_id: string;
  total_amount: number;
  estimated_time: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_paid: boolean;
}

/**
 * Crear una orden de delivery
 */
export const createDeliveryOrder = async (
  orderData: CreateDeliveryOrderDTO,
): Promise<DeliveryOrder> => {
  console.log("📦 Creando delivery order...", {
    userId: orderData.userId,
    itemsCount: orderData.items.length,
    totalAmount: orderData.totalAmount,
  });

  // 1. Validar que los productos existen en la BD
  const menuItemIds = orderData.items.map(item => item.id);
  const { data: menuItems, error: menuError } = await supabaseAdmin
    .from("menu_items")
    .select("id, name, price, prep_minutes, category")
    .in("id", menuItemIds);

  if (menuError)
    throw new Error(`Error obteniendo productos: ${menuError.message}`);
  if (!menuItems || menuItems.length === 0)
    throw new Error("No se encontraron productos válidos");

  // 2. Verificar que todos los productos del frontend existen
  for (const frontendItem of orderData.items) {
    const dbItem = menuItems.find(mi => mi.id === frontendItem.id);
    if (!dbItem) {
      throw new Error(`Producto no encontrado: ${frontendItem.id}`);
    }

    // Validar precios
    if (Math.abs(dbItem.price - frontendItem.price) > 0.01) {
      console.warn(
        `⚠️ Precio no coincide para ${frontendItem.name}: DB=${dbItem.price}, Frontend=${frontendItem.price}`,
      );
    }
  }

  // 3. Crear la orden de delivery
  const { data: newOrder, error: orderError } = await supabaseAdmin
    .from("delivery_orders")
    .insert({
      user_id: orderData.userId,
      total_amount: orderData.totalAmount,
      estimated_time: orderData.estimatedTime,
      is_paid: false,
      notes: orderData.notes || null,
    })
    .select()
    .single();

  if (orderError)
    throw new Error(`Error creando delivery order: ${orderError.message}`);

  // 4. Generar batch_id para la primera tanda
  const initialBatchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 5. Crear los items de la orden
  const orderItemsData = orderData.items.map(item => ({
    delivery_order_id: newOrder.id,
    menu_item_id: item.id,
    quantity: item.quantity,
    unit_price: item.price,
    subtotal: item.price * item.quantity,
    status: "pending" as OrderItemStatus,
    batch_id: initialBatchId,
  }));

  const { error: itemsError } = await supabaseAdmin
    .from("delivery_order_items")
    .insert(orderItemsData);

  if (itemsError)
    throw new Error(
      `Error creando items de delivery order: ${itemsError.message}`,
    );

  console.log("✅ Delivery order creada exitosamente:", newOrder.id);

  return newOrder;
};

/**
 * Obtener orden de delivery por ID
 */
export const getDeliveryOrderById = async (orderId: string): Promise<any> => {
  const { data, error } = await supabaseAdmin
    .from("delivery_orders")
    .select(
      `
      *,
      delivery_order_items(
        *,
        menu_item:menu_items(*)
      )
    `,
    )
    .eq("id", orderId)
    .single();

  if (error)
    throw new Error(`Error obteniendo delivery order: ${error.message}`);
  return data;
};

/**
 * Obtener órdenes de delivery por usuario
 */
export const getDeliveryOrdersByUser = async (
  userId: string,
): Promise<any[]> => {
  const { data, error } = await supabaseAdmin
    .from("delivery_orders")
    .select(
      `
      *,
      delivery_order_items(
        *,
        menu_item:menu_items(*)
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error)
    throw new Error(`Error obteniendo delivery orders: ${error.message}`);
  return data || [];
};

/**
 * Actualizar items en batch (enviar a cocina o bar)
 */
export const updateItemsBatch = async (
  orderId: string,
  itemIds: string[],
  status: OrderItemStatus,
  station: "kitchen" | "bar",
): Promise<void> => {
  console.log(`📋 Actualizando items en batch para orden ${orderId}:`, {
    itemIds,
    status,
    station,
  });

  // Verificar que la orden existe
  const { data: order, error: orderError } = await supabaseAdmin
    .from("delivery_orders")
    .select("id")
    .eq("id", orderId)
    .single();

  if (orderError || !order) {
    throw new Error("Orden de delivery no encontrada");
  }

  // Generar nuevo batch_id para esta tanda
  const batchId = `${station}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Actualizar los items
  const { error: updateError } = await supabaseAdmin
    .from("delivery_order_items")
    .update({
      status,
      batch_id: batchId,
      sent_to_station_at: new Date().toISOString(),
    })
    .in("id", itemIds)
    .eq("delivery_order_id", orderId);

  if (updateError) {
    console.error("❌ Error actualizando items:", updateError);
    throw new Error(`Error al actualizar items: ${updateError.message}`);
  }

  console.log(`✅ Items actualizados exitosamente (batch: ${batchId})`);
};
