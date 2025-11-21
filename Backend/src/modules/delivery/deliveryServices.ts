import { supabaseAdmin } from "../../config/supabase";
import { RESTAURANT_CONFIG } from "../../config/restaurantConfig";
import type {
  Delivery,
  CreateDeliveryDTO,
  DeliveryStatus,
  DeliveryWithOrder,
} from "./delivery.types";

/**
 * Crear un nuevo delivery
 */
export async function createDelivery(
  userId: string,
  data: CreateDeliveryDTO,
): Promise<Delivery> {
  console.log("📦 Creando nuevo delivery para usuario:", userId);

  // Verificar que la orden de delivery existe y pertenece al usuario
  const { data: order, error: orderError } = await supabaseAdmin
    .from("delivery_orders") // 🔄 Cambiado de "orders"
    .select("*")
    .eq("id", data.delivery_order_id) // 🔄 Cambiado de order_id
    .eq("user_id", userId)
    .single();

  if (orderError || !order) {
    throw new Error(
      "Orden de delivery no encontrada o no pertenece al usuario",
    );
  }

  // Verificar que el usuario no tenga otro delivery activo
  const { data: activeDelivery } = await supabaseAdmin
    .from("deliveries")
    .select("id")
    .eq("user_id", userId)
    .neq("status", "delivered")
    .neq("status", "cancelled")
    .single();

  if (activeDelivery) {
    throw new Error(
      "Ya tienes un delivery activo. Completa o cancela el anterior antes de crear uno nuevo.",
    );
  }

  // Crear el delivery
  const { data: delivery, error: deliveryError } = await supabaseAdmin
    .from("deliveries")
    .insert({
      user_id: userId,
      delivery_order_id: data.delivery_order_id, // 🔄 Cambiado de order_id
      status: "pending",
      delivery_address: data.delivery_address,
      delivery_latitude: data.delivery_latitude,
      delivery_longitude: data.delivery_longitude,
      delivery_notes: data.delivery_notes || null,
      estimated_distance_km: data.estimated_distance_km || null,
      estimated_time_minutes: data.estimated_time_minutes || null,
      // 📍 Agregar ubicación del restaurante como origen
      origin_address: RESTAURANT_CONFIG.address,
      origin_latitude: RESTAURANT_CONFIG.location.latitude,
      origin_longitude: RESTAURANT_CONFIG.location.longitude,
    })
    .select()
    .single();

  if (deliveryError) {
    console.error("❌ Error creando delivery:", deliveryError);
    throw new Error("Error al crear el delivery");
  }

  console.log("✅ Delivery creado exitosamente:", delivery.id);
  return delivery;
}

/**
 * Obtener delivery activo de un usuario
 */
export async function getActiveDelivery(
  userId: string,
): Promise<DeliveryWithOrder | null> {
  console.log("🔍 Buscando delivery activo para usuario:", userId);

  const { data: delivery, error } = await supabaseAdmin
    .from("deliveries")
    .select(
      `
      *,
      delivery_order:delivery_orders (
        id,
        total_amount,
        is_paid,
        delivery_order_items (
          *,
          menu_item:menu_items (*)
        )
      ),
      user:users!deliveries_user_id_fkey (
        id,
        first_name,
        last_name,
        profile_image
      ),
      driver:users!deliveries_driver_id_fkey (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .eq("user_id", userId)
    .neq("status", "delivered")
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("❌ Error obteniendo delivery activo:", error);
    return null;
  }

  return delivery || null;
}

/**
 * Obtener todos los deliveries pendientes (para dueño/supervisor)
 */
export async function getPendingDeliveries(): Promise<DeliveryWithOrder[]> {
  console.log("📋 Obteniendo deliveries pendientes");

  const { data: deliveries, error } = await supabaseAdmin
    .from("deliveries")
    .select(
      `
      *,
      delivery_order:delivery_orders (
        id,
        total_amount,
        is_paid,
        delivery_order_items (
          *,
          menu_item:menu_items (*)
        )
      ),
      user:users!deliveries_user_id_fkey (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Error obteniendo deliveries pendientes:", error);
    throw new Error("Error al obtener deliveries pendientes");
  }

  // Mapear delivery_order_items a items para consistencia con el frontend
  const normalizedDeliveries = (deliveries || []).map((delivery: any) => {
    const itemCount =
      delivery.delivery_order?.delivery_order_items?.length || 0;
    console.log(`📦 Delivery ${delivery.id}: ${itemCount} items`);

    return {
      ...delivery,
      delivery_order: delivery.delivery_order
        ? {
            ...delivery.delivery_order,
            items: delivery.delivery_order.delivery_order_items || [],
          }
        : undefined,
    };
  });

  return normalizedDeliveries;
}

/**
 * Obtener todos los deliveries con estado "ready" (para repartidores)
 * Estos son los pedidos que están listos para ser recogidos y entregados
 */
export async function getReadyDeliveries(): Promise<DeliveryWithOrder[]> {
  console.log("📋 Obteniendo deliveries listos para repartidores");

  const { data: deliveries, error } = await supabaseAdmin
    .from("deliveries")
    .select(
      `
      *,
      delivery_order:delivery_orders (
        id,
        total_amount,
        is_paid,
        delivery_order_items (
          *,
          menu_item:menu_items (*)
        )
      ),
      user:users!deliveries_user_id_fkey (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .eq("status", "ready")
    .is("driver_id", null)
    .order("ready_at", { ascending: true });

  if (error) {
    console.error("❌ Error obteniendo deliveries ready:", error);
    throw new Error("Error al obtener deliveries listos");
  }

  // Mapear delivery_order_items a items para consistencia con el frontend
  const normalizedDeliveries = (deliveries || []).map((delivery: any) => ({
    ...delivery,
    delivery_order: delivery.delivery_order
      ? {
          ...delivery.delivery_order,
          items: delivery.delivery_order.delivery_order_items || [],
        }
      : undefined,
  }));

  console.log(
    `✅ Encontrados ${normalizedDeliveries.length} deliveries listos`,
  );
  return normalizedDeliveries;
}

/**
 * Obtener todos los deliveries confirmados (para asignar repartidor)
 */
export async function getConfirmedDeliveries(): Promise<DeliveryWithOrder[]> {
  console.log("📋 Obteniendo deliveries confirmados sin asignar");

  const { data: deliveries, error } = await supabaseAdmin
    .from("deliveries")
    .select(
      `
      *,
      delivery_order:delivery_orders (
        id,
        total_amount,
        is_paid,
        delivery_order_items (
          *,
          menu_item:menu_items (*)
        )
      ),
      user:users!deliveries_user_id_fkey (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .eq("status", "confirmed")
    .is("driver_id", null)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Error obteniendo deliveries confirmados:", error);
    throw new Error("Error al obtener deliveries confirmados");
  }

  // Mapear delivery_order_items a items para consistencia con el frontend
  const normalizedDeliveries = (deliveries || []).map((delivery: any) => {
    const itemCount =
      delivery.delivery_order?.delivery_order_items?.length || 0;
    console.log(`📦 Delivery confirmado ${delivery.id}: ${itemCount} items`);

    return {
      ...delivery,
      delivery_order: delivery.delivery_order
        ? {
            ...delivery.delivery_order,
            items: delivery.delivery_order.delivery_order_items || [],
          }
        : undefined,
    };
  });

  return normalizedDeliveries;
}

/**
 * Obtener deliveries asignados a un repartidor (en camino)
 */
export async function getDriverDeliveries(
  driverId: string,
): Promise<DeliveryWithOrder[]> {
  console.log("🚚 Obteniendo deliveries activos del repartidor:", driverId);

  const { data: deliveries, error } = await supabaseAdmin
    .from("deliveries")
    .select(
      `
      *,
      delivery_order:delivery_orders (
        id,
        total_amount,
        is_paid,
        delivery_order_items (
          *,
          menu_item:menu_items (*)
        )
      ),
      user:users!deliveries_user_id_fkey (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .eq("driver_id", driverId)
    .eq("status", "on_the_way")
    .order("on_the_way_at", { ascending: true });

  if (error) {
    console.error("❌ Error obteniendo deliveries del repartidor:", error);
    throw new Error("Error al obtener deliveries del repartidor");
  }

  // Mapear delivery_order_items a items para consistencia con el frontend
  const normalizedDeliveries = (deliveries || []).map((delivery: any) => ({
    ...delivery,
    delivery_order: delivery.delivery_order
      ? {
          ...delivery.delivery_order,
          items: delivery.delivery_order.delivery_order_items || [],
        }
      : undefined,
  }));

  console.log(
    `✅ Encontrados ${normalizedDeliveries.length} deliveries activos`,
  );
  return normalizedDeliveries;
}

/**
 * Distribuir automáticamente items a cocina y bar
 */
async function autoDistributeItemsToStations(
  deliveryOrderId: string,
): Promise<void> {
  console.log(
    `📋 Distribuyendo automáticamente items de la orden ${deliveryOrderId}`,
  );

  // Obtener todos los items de la orden
  const { data: items, error: itemsError } = await supabaseAdmin
    .from("delivery_order_items")
    .select(
      `
      id,
      status,
      menu_item:menu_items (
        category
      )
    `,
    )
    .eq("delivery_order_id", deliveryOrderId)
    .eq("status", "pending");

  if (itemsError) {
    console.error("❌ Error obteniendo items:", itemsError);
    return;
  }

  console.log(`📊 Items encontrados: ${items?.length || 0}`);
  if (items && items.length > 0) {
    console.log(`📦 Detalles de items:`, JSON.stringify(items, null, 2));
  }

  if (!items || items.length === 0) {
    console.log("⚠️ No hay items pendientes para distribuir");
    return;
  }

  // Separar items por estación
  const kitchenItems = items.filter(
    (item: any) => item.menu_item?.category === "plato",
  );
  const barItems = items.filter(
    (item: any) => item.menu_item?.category === "bebida",
  );

  console.log(`🍳 Items para cocina (plato): ${kitchenItems.length}`);
  console.log(`🍷 Items para bar (bebida): ${barItems.length}`);

  // Simplemente cambiar todos los items a 'accepted' para que aparezcan en cocina/bar
  const allItemIds = items.map((item: any) => item.id);

  console.log(`🔄 Actualizando ${allItemIds.length} items a 'accepted'...`);

  const { data: updatedData, error: updateError } = await supabaseAdmin
    .from("delivery_order_items")
    .update({
      status: "accepted",
    })
    .in("id", allItemIds)
    .select();

  if (updateError) {
    console.error("❌ Error actualizando items:", updateError);
  } else {
    console.log(`✅ ${allItemIds.length} items actualizados a 'accepted'`);
    console.log(`📊 Items actualizados:`, JSON.stringify(updatedData, null, 2));
  }
}

/**
 * Actualizar estado de un delivery (para dueño/supervisor)
 */
export async function updateDeliveryStatus(
  deliveryId: string,
  status: DeliveryStatus,
  userId: string,
  userProfile: string,
): Promise<Delivery> {
  console.log(
    `🔄 Actualizando delivery ${deliveryId} a estado: ${status} por usuario: ${userId}`,
  );

  // Verificar que el usuario sea dueño o supervisor
  if (userProfile !== "dueno" && userProfile !== "supervisor") {
    throw new Error(
      "No tienes permisos para actualizar el estado del delivery",
    );
  }

  const updateData: any = { status };

  // Agregar timestamp según el estado
  const now = new Date().toISOString();
  switch (status) {
    case "confirmed":
      updateData.confirmed_at = now;
      break;
    case "preparing":
      updateData.preparing_at = now;
      break;
    case "ready":
      updateData.ready_at = now;
      break;
    case "on_the_way":
      updateData.on_the_way_at = now;
      break;
    case "delivered":
      updateData.delivered_at = now;
      break;
    case "cancelled":
      updateData.cancelled_at = now;
      break;
  }

  const { data: delivery, error } = await supabaseAdmin
    .from("deliveries")
    .update(updateData)
    .eq("id", deliveryId)
    .select()
    .single();

  if (error) {
    console.error("❌ Error actualizando estado del delivery:", error);
    throw new Error("Error al actualizar estado del delivery");
  }

  // 🔄 Si el estado es "confirmed", enviar automáticamente los items a sus estaciones
  if (status === "confirmed" && delivery.delivery_order_id) {
    console.log("🍳🍷 Enviando items automáticamente a cocina y bar...");
    await autoDistributeItemsToStations(delivery.delivery_order_id);
  }

  // 📦 Si el estado es "delivered", actualizar delivery_orders y delivery_order_items
  if (status === "delivered") {
    console.log(
      "📦 Delivery marcado como entregado, actualizando pedido e items...",
    );

    // Actualizar delivery_orders: marcar como pagado
    console.log(
      "📦 Intentando actualizar delivery_orders con id:",
      delivery.delivery_order_id,
    );
    const { error: orderUpdateError } = await supabaseAdmin
      .from("delivery_orders")
      .update({
        is_paid: true,
        updated_at: now,
      })
      .eq("id", delivery.delivery_order_id);

    if (orderUpdateError) {
      console.error("❌ Error actualizando delivery_orders:", orderUpdateError);
      console.warn(
        "⚠️ El delivery se marcó como entregado pero hubo error actualizando el pedido",
      );
    } else {
      console.log(
        "✅ delivery_orders actualizado: is_paid = true para id:",
        delivery.delivery_order_id,
      );
    }

    // Actualizar delivery_order_items: marcar todos como entregados
    console.log(
      "📦 Intentando actualizar delivery_order_items con delivery_order_id:",
      delivery.delivery_order_id,
    );
    const { error: itemsUpdateError } = await supabaseAdmin
      .from("delivery_order_items")
      .update({
        status: "delivered",
        updated_at: now,
      })
      .eq("delivery_order_id", delivery.delivery_order_id);

    if (itemsUpdateError) {
      console.error(
        "❌ Error actualizando delivery_order_items:",
        itemsUpdateError,
      );
      console.warn(
        "⚠️ El delivery se marcó como entregado pero hubo error actualizando los items",
      );
    } else {
      console.log(
        "✅ delivery_order_items actualizados: status = 'delivered' para delivery_order_id:",
        delivery.delivery_order_id,
      );
    }
  }

  console.log("✅ Delivery actualizado exitosamente");
  return delivery;
}

/**
 * Repartidor toma un pedido (acepta un delivery con estado "ready")
 * Cambia el estado automáticamente a "on_the_way" y asigna el driver_id
 */
export async function takeDelivery(
  deliveryId: string,
  driverId: string,
): Promise<Delivery> {
  console.log(`🚚 Repartidor ${driverId} tomando delivery ${deliveryId}`);

  // Verificar que el delivery existe, está en estado "ready" y no tiene driver asignado
  const { data: existingDelivery, error: checkError } = await supabaseAdmin
    .from("deliveries")
    .select("id, status, driver_id")
    .eq("id", deliveryId)
    .single();

  if (checkError || !existingDelivery) {
    throw new Error("Delivery no encontrado");
  }

  if (existingDelivery.status !== "ready") {
    throw new Error("Este pedido no está listo para ser tomado");
  }

  if (existingDelivery.driver_id) {
    throw new Error("Este pedido ya fue tomado por otro repartidor");
  }

  // Actualizar el delivery: asignar driver y cambiar estado a "on_the_way"
  const now = new Date().toISOString();
  const { data: delivery, error } = await supabaseAdmin
    .from("deliveries")
    .update({
      driver_id: driverId,
      status: "on_the_way",
      on_the_way_at: now,
    })
    .eq("id", deliveryId)
    .eq("status", "ready") // Verificación adicional de race condition
    .is("driver_id", null) // Verificación adicional de race condition
    .select()
    .single();

  if (error) {
    console.error("❌ Error tomando delivery:", error);
    throw new Error("Error al tomar el pedido");
  }

  if (!delivery) {
    throw new Error("El pedido ya fue tomado por otro repartidor");
  }

  console.log("✅ Delivery tomado exitosamente por repartidor");

  // Emitir evento Socket.IO al cliente para notificar cambio de estado
  try {
    const { getIOInstance } = await import("../../socket/chatSocket");
    const io = getIOInstance();

    if (io && delivery.user_id) {
      const userRoom = `user_${delivery.user_id}`;
      io.to(userRoom).emit("delivery_status_changed", {
        deliveryId: delivery.id,
        oldStatus: "ready",
        newStatus: "on_the_way",
        driverId: driverId,
        timestamp: now,
      });
      console.log(
        `📡 Evento Socket.IO emitido a room ${userRoom}: delivery tomado por repartidor`,
      );
    }
  } catch (socketError) {
    console.error("⚠️ Error emitiendo evento Socket.IO:", socketError);
    // No lanzar error, el delivery ya se actualizó correctamente
  }

  return delivery;
}

/**
 * Asignar repartidor a un delivery (para dueño/supervisor)
 */
export async function assignDriver(
  deliveryId: string,
  driverId: string,
  userId: string,
  userProfile: string,
): Promise<Delivery> {
  console.log(
    `🚚 Asignando repartidor ${driverId} al delivery ${deliveryId} por usuario ${userId}`,
  );

  // Verificar que el usuario sea dueño o supervisor
  if (userProfile !== "dueno" && userProfile !== "supervisor") {
    throw new Error("No tienes permisos para asignar repartidores");
  }

  // Verificar que el repartidor existe y es empleado
  const { data: driver, error: driverError } = await supabaseAdmin
    .from("users")
    .select("id, profile_code, position_code")
    .eq("id", driverId)
    .single();

  if (driverError || !driver) {
    throw new Error("Repartidor no encontrado");
  }

  if (driver.profile_code !== "empleado" || driver.position_code !== "mozo") {
    throw new Error("El usuario seleccionado no es un repartidor válido");
  }

  const { data: delivery, error } = await supabaseAdmin
    .from("deliveries")
    .update({ driver_id: driverId })
    .eq("id", deliveryId)
    .select()
    .single();

  if (error) {
    console.error("❌ Error asignando repartidor:", error);
    throw new Error("Error al asignar repartidor");
  }

  console.log("✅ Repartidor asignado exitosamente");
  return delivery;
}

/**
 * Cancelar un delivery
 */
export async function cancelDelivery(
  deliveryId: string,
  userId: string,
): Promise<Delivery> {
  console.log(`❌ Cancelando delivery ${deliveryId} por usuario ${userId}`);

  // Verificar que el delivery existe y pertenece al usuario
  const { data: existingDelivery, error: checkError } = await supabaseAdmin
    .from("deliveries")
    .select("user_id, status")
    .eq("id", deliveryId)
    .single();

  if (checkError || !existingDelivery) {
    throw new Error("Delivery no encontrado");
  }

  if (existingDelivery.user_id !== userId) {
    throw new Error("No tienes permisos para cancelar este delivery");
  }

  // No permitir cancelar si ya está en camino o entregado
  if (
    existingDelivery.status === "on_the_way" ||
    existingDelivery.status === "delivered"
  ) {
    throw new Error("No puedes cancelar un delivery que ya está en camino");
  }

  const { data: delivery, error } = await supabaseAdmin
    .from("deliveries")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", deliveryId)
    .select()
    .single();

  if (error) {
    console.error("❌ Error cancelando delivery:", error);
    throw new Error("Error al cancelar delivery");
  }

  console.log("✅ Delivery cancelado exitosamente");
  return delivery;
}

/**
 * Obtener historial de deliveries de un usuario
 */
export async function getDeliveryHistory(
  userId: string,
): Promise<DeliveryWithOrder[]> {
  console.log("📜 Obteniendo historial de deliveries para usuario:", userId);

  const { data: deliveries, error } = await supabaseAdmin
    .from("deliveries")
    .select(
      `
      *,
      delivery_order:delivery_orders (
        id,
        total_amount,
        is_paid,
        delivery_order_items (
          *,
          menu_item:menu_items (*)
        )
      ),
      driver:users!deliveries_driver_id_fkey (
        id,
        first_name,
        last_name,
        profile_image
      )
    `,
    )
    .eq("user_id", userId)
    .in("status", ["delivered", "cancelled"])
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("❌ Error obteniendo historial de deliveries:", error);
    throw new Error("Error al obtener historial de deliveries");
  }

  return deliveries || [];
}

/**
 * Establecer método de pago para un delivery
 */
export async function setPaymentMethod(
  deliveryId: string,
  driverId: string,
  paymentMethod: "qr" | "cash",
  tipPercentage?: number,
  satisfactionLevel?: string,
): Promise<Delivery> {
  console.log(
    `💳 Estableciendo método de pago ${paymentMethod} para delivery:`,
    deliveryId,
  );

  // Verificar que el delivery existe y el usuario es el driver
  const { data: delivery, error: fetchError } = await supabaseAdmin
    .from("deliveries")
    .select("*")
    .eq("id", deliveryId)
    .eq("driver_id", driverId)
    .single();

  if (fetchError || !delivery) {
    throw new Error("Delivery no encontrado o no eres el repartidor asignado");
  }

  if (delivery.status !== "on_the_way") {
    throw new Error(
      "El delivery debe estar en camino para establecer el método de pago",
    );
  }

  // Actualizar método de pago
  const updateData: any = {
    payment_method: paymentMethod,
  };

  if (tipPercentage !== undefined) {
    updateData.tip_percentage = tipPercentage;
  }

  if (satisfactionLevel) {
    updateData.satisfaction_level = satisfactionLevel;
  }

  const { data: updatedDelivery, error: updateError } = await supabaseAdmin
    .from("deliveries")
    .update(updateData)
    .eq("id", deliveryId)
    .select()
    .single();

  if (updateError || !updatedDelivery) {
    console.error("❌ Error actualizando método de pago:", updateError);
    throw new Error("Error al establecer método de pago");
  }

  console.log("✅ Método de pago establecido");
  return updatedDelivery;
}

/**
 * Confirmar pago recibido y marcar delivery como entregado
 */
export async function confirmPayment(
  deliveryId: string,
  userId: string,
  paymentData: {
    payment_method: "qr" | "cash";
    tip_amount: number;
    tip_percentage: number;
    satisfaction_level?: string;
  },
  invoiceInfo?: {
    generated: boolean;
    filePath?: string;
    fileName?: string;
    htmlContent?: string;
    isRegistered?: boolean;
    message?: string;
    error?: string;
  },
): Promise<Delivery> {
  console.log("💰 Confirmando pago para delivery:", deliveryId);

  // Verificar que el delivery existe
  const { data: delivery, error: fetchError } = await supabaseAdmin
    .from("deliveries")
    .select("*")
    .eq("id", deliveryId)
    .single();

  if (fetchError || !delivery) {
    throw new Error("Delivery no encontrado");
  }

  // Verificar que el usuario tiene permiso (repartidor o cliente)
  if (delivery.driver_id !== userId && delivery.user_id !== userId) {
    throw new Error("No tienes permiso para confirmar este pago");
  }

  // Para pago con QR, el cliente debe ser quien confirma
  // Para pago en efectivo, el repartidor confirma
  if (paymentData.payment_method === "qr" && delivery.user_id !== userId) {
    throw new Error("Solo el cliente puede confirmar pago con QR");
  }

  if (paymentData.payment_method === "cash" && delivery.driver_id !== userId) {
    throw new Error("Solo el repartidor puede confirmar pago en efectivo");
  }

  const now = new Date().toISOString();

  // Actualizar delivery: pago confirmado y estado a delivered
  const { data: updatedDelivery, error: updateError } = await supabaseAdmin
    .from("deliveries")
    .update({
      payment_status: "paid",
      payment_method: paymentData.payment_method,
      tip_amount: paymentData.tip_amount,
      tip_percentage: paymentData.tip_percentage,
      satisfaction_level: paymentData.satisfaction_level,
      paid_at: now,
      status: "delivered",
      delivered_at: now,
    })
    .eq("id", deliveryId)
    .select()
    .single();

  if (updateError || !updatedDelivery) {
    console.error("❌ Error confirmando pago:", updateError);
    throw new Error("Error al confirmar pago");
  }

  // Actualizar delivery_orders: marcar como pagado (is_paid = true)
  console.log(
    "📦 Intentando actualizar delivery_orders con id:",
    delivery.delivery_order_id,
  );
  const { error: orderUpdateError } = await supabaseAdmin
    .from("delivery_orders")
    .update({
      is_paid: true,
      updated_at: now,
    })
    .eq("id", delivery.delivery_order_id);

  if (orderUpdateError) {
    console.error("❌ Error actualizando delivery_orders:", orderUpdateError);
    // No lanzar error, pero loguear advertencia
    console.warn(
      "⚠️ El delivery se marcó como entregado pero hubo error actualizando el pedido",
    );
  } else {
    console.log(
      "✅ delivery_orders actualizado: is_paid = true para id:",
      delivery.delivery_order_id,
    );
  }

  // Actualizar delivery_order_items: marcar todos los items como entregados
  console.log(
    "📦 Intentando actualizar delivery_order_items con delivery_order_id:",
    delivery.delivery_order_id,
  );
  const { error: itemsUpdateError } = await supabaseAdmin
    .from("delivery_order_items")
    .update({
      status: "delivered",
      updated_at: now,
    })
    .eq("delivery_order_id", delivery.delivery_order_id);

  if (itemsUpdateError) {
    console.error(
      "❌ Error actualizando delivery_order_items:",
      itemsUpdateError,
    );
    console.warn(
      "⚠️ El delivery se marcó como entregado pero hubo error actualizando los items",
    );
  } else {
    console.log(
      "✅ delivery_order_items actualizados: status = 'delivered' para delivery_order_id:",
      delivery.delivery_order_id,
    );
  }

  // ENTREGA DIFERENCIADA DE FACTURA (igual que en mesas)
  if (invoiceInfo?.generated) {
    try {
      // Obtener datos del cliente
      const { data: clientData, error: clientError } = await supabaseAdmin
        .from("users")
        .select("first_name, last_name")
        .eq("id", delivery.user_id)
        .single();

      const clientName = clientData && !clientError
        ? `${clientData.first_name} ${clientData.last_name}`.trim()
        : "Cliente";

      if (invoiceInfo.isRegistered && invoiceInfo.htmlContent) {
        // USUARIO REGISTRADO: Enviar factura por email (HTML embebido)
        console.log(`📧 Enviando factura por email a usuario registrado del delivery`);

        // Obtener email del cliente desde Firebase Auth
        const { getAuthEmailById } = await import("../admin/adminServices");
        const clientEmail = await getAuthEmailById(delivery.user_id);

        if (!clientEmail) {
          throw new Error("No se pudo obtener email del cliente registrado");
        }

        const { InvoiceEmailService } = await import(
          "../../services/invoiceEmailService"
        );
        const totalAmount = (updatedDelivery as any).delivery_order?.total_amount || 0;
        const emailResult = await InvoiceEmailService.sendInvoiceByEmail(
          clientEmail,
          invoiceInfo.htmlContent,
          {
            clientName,
            tableNumber: "DELIVERY",
            invoiceNumber: `INV-DEL-${Date.now()}`,
            totalAmount,
            invoiceDate: new Date().toLocaleDateString("es-AR"),
          },
        );

        if (emailResult.success) {
          console.log(
            `✅ Factura de delivery enviada por email exitosamente a: ${clientEmail}`,
          );
        } else {
          console.error(
            `❌ Error enviando factura de delivery por email: ${emailResult.error}`,
          );
        }
      } else if (
        !invoiceInfo.isRegistered &&
        invoiceInfo.filePath &&
        invoiceInfo.fileName
      ) {
        // USUARIO ANÓNIMO: Enviar notificación push con enlace de descarga
        console.log(
          `📱 Enviando notificación push con enlace de descarga a usuario anónimo del delivery`,
        );

        const { notifyAnonymousClientInvoiceReady } = await import(
          "../../services/pushNotificationService"
        );
        const totalAmount = (updatedDelivery as any).delivery_order?.total_amount || 0;
        await notifyAnonymousClientInvoiceReady(
          delivery.user_id,
          "DELIVERY",
          totalAmount,
          {
            generated: true,
            filePath: invoiceInfo.filePath,
            fileName: invoiceInfo.fileName,
            message: invoiceInfo.message || "Factura generada exitosamente",
          },
        );
      } else {
        console.warn(
          `⚠️ Factura generada pero faltan datos para entrega en delivery: isRegistered=${invoiceInfo.isRegistered}, hasHTML=${!!invoiceInfo.htmlContent}, hasFile=${!!invoiceInfo.filePath}`,
        );
      }
    } catch (deliveryError) {
      console.error(
        `❌ Error en entrega diferenciada de factura de delivery:`,
        deliveryError,
      );
      // Continúa sin fallar
    }
  }

  console.log("✅ Pago confirmado y delivery marcado como entregado");
  return updatedDelivery;
}

/**
 * Actualizar ubicación en tiempo real del repartidor
 */
export async function updateDriverLocation(
  deliveryId: string,
  driverId: string,
  location: { latitude: number; longitude: number },
): Promise<Delivery> {
  console.log(
    `📍 Actualizando ubicación del repartidor para delivery: ${deliveryId}`,
  );

  // Verificar que el delivery existe
  const { data: delivery, error: fetchError } = await supabaseAdmin
    .from("deliveries")
    .select("*")
    .eq("id", deliveryId)
    .single();

  if (fetchError || !delivery) {
    throw new Error("Delivery no encontrado");
  }

  // Verificar que el usuario es el repartidor asignado
  if (delivery.driver_id !== driverId) {
    throw new Error("No eres el repartidor asignado a este delivery");
  }

  // Solo actualizar ubicación si está on_the_way
  if (delivery.status !== "on_the_way") {
    throw new Error(
      "Solo se puede actualizar ubicación cuando el delivery está en camino",
    );
  }

  const now = new Date().toISOString();

  // Actualizar ubicación del repartidor
  const { data: updatedDelivery, error: updateError } = await supabaseAdmin
    .from("deliveries")
    .update({
      driver_current_latitude: location.latitude,
      driver_current_longitude: location.longitude,
      driver_location_updated_at: now,
    })
    .eq("id", deliveryId)
    .select()
    .single();

  if (updateError || !updatedDelivery) {
    console.error("❌ Error actualizando ubicación:", updateError);
    throw new Error("Error al actualizar ubicación");
  }

  console.log("✅ Ubicación del repartidor actualizada");
  return updatedDelivery;
}
