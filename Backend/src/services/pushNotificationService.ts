import { supabaseAdmin } from "../config/supabase";

interface PushNotificationData {
  title: string;
  body: string;
  data?: any;
}

// Función para enviar notificaciones push usando Expo Push API
async function sendExpoPushNotification(
  expoPushTokens: string[],
  notificationData: PushNotificationData,
) {
  const messages = expoPushTokens.map(token => ({
    to: token,
    sound: "default",
    title: notificationData.title,
    body: notificationData.body,
    data: notificationData.data || {},
  }));

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();

    // Log detallado de resultados
    if (
      result &&
      typeof result === "object" &&
      "data" in result &&
      Array.isArray(result.data)
    ) {
      result.data.forEach((item: any) => {
        if (item.status === "error") {
        } else {
        }
      });
    }

    return result;
  } catch (error) {
    console.error("Error sending push notification:", error);
    throw error;
  }
}

// Función para obtener push tokens por tipo de perfil
async function getUserTokensByProfile(profiles: string[]): Promise<string[]> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .in("profile_code", profiles)
      .eq("state", "aprobado")
      .not("push_token", "is", null);

    if (error) {
      console.error("Error fetching user tokens by profile:", error);
      return [];
    }

    return users
      .map(user => user.push_token)
      .filter(token => token && token.trim() !== "");
  } catch (error) {
    console.error("Error in getUserTokensByProfile:", error);
    return [];
  }
}

// Función específica para obtener tokens de supervisores y dueños
async function getSupervisorAndOwnerTokens(): Promise<string[]> {
  return getUserTokensByProfile(["supervisor", "dueno"]);
}

// Función para obtener tokens de clientes (para futuro uso)
export async function getClientTokens(): Promise<string[]> {
  return getUserTokensByProfile(["cliente_registrado", "cliente_anonimo"]);
}

// Función para obtener tokens de empleados (para futuro uso)
export async function getEmployeeTokens(): Promise<string[]> {
  return getUserTokensByProfile(["empleado"]);
}

// Función principal para notificar sobre nuevo registro de cliente
export async function notifyNewClientRegistration(
  clientName: string,
  clientId: string,
) {
  try {
    // Obtener tokens de supervisores y dueños
    const tokens = await getSupervisorAndOwnerTokens();

    if (tokens.length === 0) {
      return;
    }

    // Preparar datos de la notificación
    const notificationData: PushNotificationData = {
      title: "Nuevo cliente registrado",
      body: `${clientName} se ha registrado y necesita aprobación`,
      data: {
        type: "new_client_registration",
        clientId: clientId,
        clientName: clientName,
      },
    };

    // Enviar notificación
    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("Error al enviar notificación de nuevo cliente:", error);
  }
}

// Función para notificar a clientes (ejemplo: pedido listo, promociones, etc.)
export async function notifyClients(title: string, body: string, data?: any) {
  try {
    const tokens = await getClientTokens();

    if (tokens.length === 0) {
      return;
    }

    const notificationData: PushNotificationData = {
      title,
      body,
      data: data || {},
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("Error al enviar notificación a clientes:", error);
  }
}

// Función para notificar a empleados (ejemplo: nuevos platos, cambios de turno, etc.)
export async function notifyEmployees(title: string, body: string, data?: any) {
  try {
    const tokens = await getEmployeeTokens();

    if (tokens.length === 0) {
      return;
    }

    const notificationData: PushNotificationData = {
      title,
      body,
      data: data || {},
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("Error al enviar notificación a empleados:", error);
  }
}

// Función para notificar al cliente recién registrado sobre el estado de su cuenta
export async function notifyClientAccountCreated(clientId: string) {
  try {
    // Obtener el push token del cliente específico
    const { data: client, error } = await supabaseAdmin
      .from("users")
      .select("push_token, name")
      .eq("id", clientId)
      .single();

    if (error) {
      console.error("Error obteniendo datos del cliente:", error);
      return;
    }

    if (!client?.push_token) {
      return;
    }

    // Preparar datos de la notificación para el cliente
    const notificationData: PushNotificationData = {
      title: "Cuenta creada exitosamente",
      body: "Para ingresar a la aplicación la cuenta debe ser aprobada",
      data: {
        type: "account_created",
        status: "pending_approval",
      },
    };

    // Enviar notificación al cliente específico
    await sendExpoPushNotification([client.push_token], notificationData);
  } catch (error) {
    console.error("Error al enviar notificación de cuenta creada:", error);
  }
}

// Función para actualizar el push token de un usuario
export async function updateUserPushToken(userId: string, pushToken: string | null) {
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ push_token: pushToken })
      .eq("id", userId);

    if (error) {
      console.error("❌ Supabase error updating push token:", error);
      throw new Error("Error actualizando token de notificaciones");
    }
  } catch (error) {
    console.error("❌ Error en updateUserPushToken:", error);
    throw error;
  }
}

// ========== NUEVAS FUNCIONES PARA WAITING LIST Y MESAS ==========

// Función para obtener tokens de maîtres
async function getMaitreTokens(): Promise<string[]> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("profile_code", "empleado")
      .eq("position_code", "maitre")
      .eq("state", "aprobado")
      .not("push_token", "is", null);

    if (error) {
      console.error("Error fetching maitre tokens:", error);
      return [];
    }

    return users
      .map(user => user.push_token)
      .filter(token => token && token.trim() !== "");
  } catch (error) {
    console.error("Error in getMaitreTokens:", error);
    return [];
  }
}

// Función para obtener tokens de mozos
async function getWaiterTokens(): Promise<string[]> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("profile_code", "empleado")
      .eq("position_code", "mozo")
      .eq("state", "aprobado")
      .not("push_token", "is", null);

    if (error) {
      console.error("Error fetching waiter tokens:", error);
      return [];
    }

    return users
      .map(user => user.push_token)
      .filter(token => token && token.trim() !== "");
  } catch (error) {
    console.error("Error in getWaiterTokens:", error);
    return [];
  }
}

// Función para obtener tokens de repartidores
async function getDriverTokens(): Promise<string[]> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("profile_code", "repartidor")
      .eq("state", "aprobado")
      .not("push_token", "is", null);

    if (error) {
      console.error("Error fetching driver tokens:", error);
      return [];
    }

    return users
      .map(user => user.push_token)
      .filter(token => token && token.trim() !== "");
  } catch (error) {
    console.error("Error in getDriverTokens:", error);
    return [];
  }
}

// Función para obtener token de un cliente específico
async function getClientToken(clientId: string): Promise<string | null> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("id", clientId)
      .single();

    if (error || !user) {
      return null;
    }

    return user.push_token && user.push_token.trim() !== ""
      ? user.push_token
      : null;
  } catch (error) {
    return null;
  }
}

// Función genérica para obtener tokens por position_code
async function getRoleTokens(positionCode: string): Promise<string[]> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("profile_code", "empleado")
      .eq("position_code", positionCode)
      .eq("state", "aprobado")
      .not("push_token", "is", null);

    if (error) {
      console.error(`Error fetching ${positionCode} tokens:`, error);
      return [];
    }

    return users
      .map(user => user.push_token)
      .filter(token => token && token.trim() !== "");
  } catch (error) {
    console.error(`Error in getRoleTokens for ${positionCode}:`, error);
    return [];
  }
}

// Función para obtener token de un mozo específico
async function getWaiterToken(waiterId: string): Promise<string | null> {
  try {
    console.log(`🔍 Buscando token para mozo: ${waiterId}`);
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("push_token, name, state, profile_code, position_code")
      .eq("id", waiterId)
      .single();

    if (error) {
      console.error(`❌ Error buscando mozo ${waiterId}:`, error.message);
      return null;
    }

    if (!user) {
      console.warn(`⚠️ Mozo ${waiterId} no encontrado en BD`);
      return null;
    }

    console.log(`👤 Mozo encontrado: ${user.name}, profile: ${user.profile_code}, position: ${user.position_code}, state: ${user.state}`);

    if (user.profile_code !== "empleado") {
      console.warn(`⚠️ Usuario ${waiterId} no es empleado (es ${user.profile_code})`);
      return null;
    }

    if (user.position_code !== "mozo") {
      console.warn(`⚠️ Empleado ${waiterId} no es mozo (es ${user.position_code})`);
      return null;
    }

    if (user.state !== "aprobado") {
      console.warn(`⚠️ Mozo ${waiterId} no está aprobado (estado: ${user.state})`);
      return null;
    }

    if (!user.push_token || user.push_token.trim() === "") {
      console.warn(`⚠️ Mozo ${waiterId} (${user.name}) no tiene push token registrado`);
      return null;
    }

    console.log(`✅ Push token encontrado para mozo ${user.name}`);
    return user.push_token;
  } catch (error) {
    console.error("Error in getWaiterToken:", error);
    return null;
  }
}

// Función para notificar al maître cuando un cliente se une a la lista de espera
export async function notifyMaitreNewWaitingClient(
  clientName: string,
  partySize: number,
  tableType?: string,
) {
  try {
    const tokens = await getMaitreTokens();

    if (tokens.length === 0) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: "Nuevo cliente en lista de espera",
      body: `${clientName} (${partySize} personas) se unió a la lista${tableType ? ` - Prefiere: ${tableType}` : ""}`,
      data: {
        type: "new_waiting_client",
        clientName,
        partySize,
        tableType,
        screen: "ManageWaitingList",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación al maître:", error);
  }
}

// Función para notificar al cliente cuando se le asigna una mesa
export async function notifyClientTableAssigned(
  clientId: string,
  tableNumber: string,
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: "¡Tu mesa está lista!",
      body: `Se te ha asignado la mesa #${tableNumber}. Ve al restaurante y escanea el código QR para confirmar tu llegada.`,
      data: {
        type: "table_assigned",
        tableNumber,
        screen: "ScanTableQR",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de mesa asignada:", error);
  }
}

// ========== FUNCIONES DE CHAT MEJORADAS (TIPO WHATSAPP) ==========

// Función para notificar a todos los mozos sobre una nueva consulta de cliente (solo el primer mensaje)
export async function notifyWaitersNewClientMessage(
  clientName: string,
  tableNumber: string,
  message: string,
) {
  try {
    const tokens = await getWaiterTokens();

    if (tokens.length === 0) {
      return;
    }

    // Truncar mensaje si es muy largo
    const truncatedMessage =
      message.length > 50 ? message.substring(0, 47) + "..." : message;

    const notificationData: PushNotificationData = {
      title: `Consulta - Mesa #${tableNumber}`,
      body: `${clientName}: ${truncatedMessage}`,
      data: {
        type: "client_message",
        tableNumber,
        clientName,
        message,
        screen: "TableChat",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de consulta a mozos:",
      error,
    );
  }
}

// Función para notificar al cliente cuando un mozo responde su consulta
export async function notifyClientWaiterResponse(
  clientId: string,
  waiterName: string,
  tableNumber: string,
  message: string,
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    // Truncar mensaje si es muy largo
    const truncatedMessage =
      message.length > 50 ? message.substring(0, 47) + "..." : message;

    const notificationData: PushNotificationData = {
      title: `Respuesta del mesero - Mesa #${tableNumber}`,
      body: `${waiterName}: ${truncatedMessage}`,
      data: {
        type: "waiter_response",
        tableNumber,
        waiterName,
        message,
        screen: "TableChat",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de respuesta de mozo:",
      error,
    );
  }
}

// NUEVA: Función para notificar al mozo específico cuando el cliente le envía un mensaje (tipo WhatsApp)
export async function notifyWaiterClientMessage(
  waiterId: string,
  clientName: string,
  tableNumber: string,
  message: string,
  chatId: string,
) {
  try {
    const token = await getWaiterToken(waiterId);

    if (!token) {
      return;
    }

    // Truncar mensaje si es muy largo
    const truncatedMessage =
      message.length > 50 ? message.substring(0, 47) + "..." : message;

    const notificationData: PushNotificationData = {
      title: `${clientName} - Mesa #${tableNumber}`,
      body: truncatedMessage,
      data: {
        type: "chat_message_client",
        tableNumber,
        clientName,
        message,
        chatId,
        waiterId,
        screen: "WaiterChat",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de mensaje de cliente al mozo:",
      error,
    );
  }
}

// NUEVA: Función para notificar al cliente cuando el mozo le envía un mensaje (tipo WhatsApp)
export async function notifyClientWaiterMessage(
  clientId: string,
  waiterName: string,
  tableNumber: string,
  message: string,
  chatId: string,
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    // Truncar mensaje si es muy largo
    const truncatedMessage =
      message.length > 50 ? message.substring(0, 47) + "..." : message;

    const notificationData: PushNotificationData = {
      title: `${waiterName} - Mesa #${tableNumber}`,
      body: truncatedMessage,
      data: {
        type: "chat_message_waiter",
        tableNumber,
        waiterName,
        message,
        chatId,
        screen: "ClientChat",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de mensaje de mozo al cliente:",
      error,
    );
  }
}

// Función para notificar al mozo cuando un cliente realiza un nuevo pedido
export async function notifyWaiterNewOrder(
  _waiterId: string, // Mantenido por compatibilidad, pero se notifica a todos los mozos
  clientName: string,
  tableNumber: string,
  itemsCount: number,
  totalAmount: number,
) {
  try {
    const tokens = await getWaiterTokens();

    if (tokens.length === 0) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: `Nuevo pedido - Mesa #${tableNumber}`,
      body: `${clientName} realizó un pedido (${itemsCount} items - $${totalAmount.toFixed(2)})`,
      data: {
        type: "new_order",
        tableNumber,
        clientName,
        itemsCount,
        totalAmount,
        screen: "WaiterPendingOrders",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de nuevo pedido a mozos:",
      error,
    );
  }
}

// Función para notificar al cliente cuando el mozo rechaza su pedido para modificación
export async function notifyClientOrderRejectedForModification(
  clientId: string,
  waiterName: string,
  tableNumber: string,
  rejectedItemsCount: number,
  totalItemsCount: number,
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: `Pedido devuelto - Mesa #${tableNumber}`,
      body: `${waiterName} devolvió ${rejectedItemsCount} de ${totalItemsCount} items para modificación`,
      data: {
        type: "order_rejected_for_modification",
        tableNumber,
        waiterName,
        rejectedItemsCount,
        totalItemsCount,
        screen: "ModifyOrder",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de pedido rechazado:",
      error,
    );
  }
}

// Función para notificar a la cocina cuando hay nuevos platos
export async function notifyKitchenNewItems(
  tableNumber: string,
  dishItems: Array<{ name: string; quantity: number }>,
  clientName?: string,
) {
  try {
    const tokens = await getRoleTokens("cocinero");

    if (!tokens.length) {
      return;
    }

    const totalItems = dishItems.reduce((sum, item) => sum + item.quantity, 0);
    const itemsText = dishItems
      .map(item => `${item.quantity}x ${item.name}`)
      .join(", ");

    const notificationData: PushNotificationData = {
      title: `Nuevo pedido - Mesa #${tableNumber}`,
      body: `${totalItems} platos: ${itemsText}`,
      data: {
        type: "kitchen_new_items",
        tableNumber,
        clientName,
        itemsCount: totalItems,
        items: dishItems,
        screen: "KitchenOrders",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación a la cocina:", error);
  }
}

// Función para notificar al bartender cuando hay nuevas bebidas
export async function notifyBartenderNewItems(
  tableNumber: string,
  drinkItems: Array<{ name: string; quantity: number }>,
  clientName?: string,
) {
  try {
    const tokens = await getRoleTokens("bartender");

    if (!tokens.length) {
      return;
    }

    const totalItems = drinkItems.reduce((sum, item) => sum + item.quantity, 0);
    const itemsText = drinkItems
      .map(item => `${item.quantity}x ${item.name}`)
      .join(", ");

    const notificationData: PushNotificationData = {
      title: `Nuevo pedido - Mesa #${tableNumber}`,
      body: `${totalItems} bebidas: ${itemsText}`,
      data: {
        type: "bartender_new_items",
        tableNumber,
        clientName,
        itemsCount: totalItems,
        items: drinkItems,
        screen: "BartenderOrders",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación al bartender:", error);
  }
}

// Función para notificar al mozo cuando los platos están listos desde cocina
export async function notifyWaiterKitchenItemsReady(
  waiterId: string,
  tableNumber: string,
  dishItems: Array<{ name: string; quantity: number }>,
) {
  try {
    const token = await getWaiterToken(waiterId);

    if (!token) {
      return;
    }

    const totalItems = dishItems.reduce((sum, item) => sum + item.quantity, 0);
    const itemsText = dishItems
      .map(item => `${item.quantity}x ${item.name}`)
      .join(", ");

    const notificationData: PushNotificationData = {
      title: `🍽️ Platos listos - Mesa #${tableNumber}`,
      body: `${totalItems} platos terminados: ${itemsText}`,
      data: {
        type: "kitchen_items_ready",
        tableNumber,
        itemsCount: totalItems,
        items: dishItems,
        screen: "WaiterPendingOrders",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de platos listos al mozo:",
      error,
    );
  }
}

// Función para notificar al mozo cuando las bebidas están listas desde bar
export async function notifyWaiterBartenderItemsReady(
  waiterId: string,
  tableNumber: string,
  drinkItems: Array<{ name: string; quantity: number }>,
) {
  try {
    const token = await getWaiterToken(waiterId);

    if (!token) {
      return;
    }

    const totalItems = drinkItems.reduce((sum, item) => sum + item.quantity, 0);
    const itemsText = drinkItems
      .map(item => `${item.quantity}x ${item.name}`)
      .join(", ");

    const notificationData: PushNotificationData = {
      title: `🍹 Bebidas listas - Mesa #${tableNumber}`,
      body: `${totalItems} bebidas terminadas: ${itemsText}`,
      data: {
        type: "bartender_items_ready",
        tableNumber,
        itemsCount: totalItems,
        items: drinkItems,
        screen: "WaiterPendingOrders",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de bebidas listas al mozo:",
      error,
    );
  }
}

// Función para notificar al mozo cuando TODO el pedido está completo (cocina + bar)
export async function notifyWaiterOrderFullyReady(
  waiterId: string,
  tableNumber: string,
  clientName: string,
  totalItems: number,
) {
  try {
    const specificToken = await getWaiterToken(waiterId);
    let tokens: string[] = [];
    
    if (specificToken) {
      tokens = [specificToken];
    } else {
      tokens = await getWaiterTokens();
    }

    if (tokens.length === 0) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: `✅ Pedido completo - Mesa #${tableNumber}`,
      body: `${clientName}: Todo el pedido (${totalItems} items) está listo para servir`,
      data: {
        type: "order_fully_ready",
        tableNumber,
        clientName,
        totalItems,
        screen: "WaiterPendingOrders",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de pedido completo:",
      error,
    );
  }
}

// Función para notificar al mozo cuando el cliente solicita la cuenta
export async function notifyWaiterPaymentRequest(
  waiterId: string,
  clientName: string,
  tableNumber: string,
  totalAmount: number,
) {
  try {
    const token = await getWaiterToken(waiterId);

    if (!token) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: `💳 Solicitud de cuenta - Mesa #${tableNumber}`,
      body: `${clientName} solicita la cuenta: $${totalAmount.toLocaleString()}`,
      data: {
        type: "payment_request",
        tableNumber,
        clientName,
        totalAmount,
        waiterId,
        screen: "WaiterPayments",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de solicitud de cuenta:",
      error,
    );
  }
}

// Función para notificar al mozo cuando el cliente realiza el pago
export async function notifyWaiterPaymentCompleted(
  waiterId: string,
  clientName: string,
  tableNumber: string,
  totalAmount: number,
) {
  try {
    const token = await getWaiterToken(waiterId);

    if (!token) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: `✅ Pago realizado - Mesa #${tableNumber}`,
      body: `${clientName} completó el pago de $${totalAmount.toLocaleString()}. Confirma para liberar la mesa.`,
      data: {
        type: "payment_completed",
        tableNumber,
        clientName,
        totalAmount,
        waiterId,
        screen: "WaiterPaymentConfirmations",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de pago completado:", error);
  }
}

// Función para notificar al cliente cuando el mozo confirma el pago
export async function notifyClientPaymentConfirmation(
  clientId: string,
  waiterName: string,
  tableNumber: string,
  totalAmount: number,
  invoiceData?: {
    generated: boolean;
    filePath?: string;
    fileName?: string;
    message?: string;
    error?: string;
  },
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: `✅ Pago confirmado - Mesa #${tableNumber}`,
      body: `${waiterName} confirmó tu pago de $${totalAmount.toLocaleString()}. ${invoiceData?.generated ? "¡Tu factura está lista!" : "Gracias por tu visita!"}`,
      data: {
        type: "payment_confirmed",
        tableNumber,
        waiterName,
        totalAmount,
        screen: "InvoiceView",
        invoiceData: invoiceData || { generated: false },
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de confirmación de pago:",
      error,
    );
  }
}

// Función ESPECÍFICA para usuarios anónimos: envía notificación con enlace de descarga
export async function notifyAnonymousClientInvoiceReady(
  clientId: string,
  tableNumber: string,
  totalAmount: number,
  invoiceData: {
    generated: boolean;
    filePath?: string;
    fileName?: string;
    message?: string;
    error?: string;
  },
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    if (!invoiceData.generated || !invoiceData.fileName) {
      return;
    }

    // Crear URL de descarga para el usuario anónimo
    const downloadUrl = `${process.env["API_URL"] || "http://localhost:3000"}/api/invoices/download/${invoiceData.fileName}`;

    const notificationData: PushNotificationData = {
      title: `🧾 Tu factura está lista - Mesa #${tableNumber}`,
      body: `Tu pago de $${totalAmount.toLocaleString()} fue confirmado. Toca aquí para descargar tu factura oficial AFIP.`,
      data: {
        type: "anonymous_invoice_ready",
        tableNumber,
        totalAmount,
        downloadUrl,
        fileName: invoiceData.fileName,
        screen: "InvoiceDownload",
        invoiceData,
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de factura a usuario anónimo:",
      error,
    );
  }
}

// Función para notificar al cliente cuando el mozo confirma su pedido
export async function notifyClientOrderConfirmed(
  clientId: string,
  waiterName: string,
  tableNumber: string,
  itemsCount: number,
  estimatedTime?: number,
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    const timeText = estimatedTime
      ? ` Tiempo estimado: ${estimatedTime} minutos.`
      : "";

    const notificationData: PushNotificationData = {
      title: `✅ Pedido confirmado - Mesa #${tableNumber}`,
      body: `${waiterName} confirmó tu pedido (${itemsCount} items).${timeText} ¡Ya está siendo preparado!`,
      data: {
        type: "order_confirmed",
        tableNumber,
        waiterName,
        itemsCount,
        estimatedTime,
        screen: "OrderStatus",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error(
      "❌ Error al enviar notificación de pedido confirmado:",
      error,
    );
  }
}

// Función para notificar al dueño y supervisor cuando se realiza un pago
export async function notifyManagementPaymentReceived(
  clientName: string,
  tableNumber: string,
  totalAmount: number,
  waiterName: string,
  paymentMethod?: string,
) {
  try {
    const tokens = await getSupervisorAndOwnerTokens();

    if (!tokens.length) {
      return;
    }

    const paymentInfo = paymentMethod ? ` (${paymentMethod})` : "";

    const notificationData: PushNotificationData = {
      title: `💰 Pago recibido - Mesa #${tableNumber}`,
      body: `${clientName} pagó $${totalAmount.toLocaleString()}${paymentInfo} - Atendido por ${waiterName}`,
      data: {
        type: "payment_received",
        tableNumber,
        clientName,
        totalAmount,
        waiterName,
        paymentMethod,
        screen: "PaymentReports",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de pago a gerencia:", error);
  }
}

// Función para notificar al cliente cuando su cuenta es aprobada
export async function notifyClientAccountApproved(
  clientId: string,
  clientName: string,
  approvedBy: string,
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: "¡Cuenta aprobada! 🎉",
      body: `${clientName}, tu cuenta ha sido aprobada. Ya puedes acceder a todas las funciones de la app.`,
      data: {
        type: "account_approved",
        clientId,
        clientName,
        approvedBy,
        screen: "Home",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de cuenta aprobada:", error);
  }
}

// Función para notificar a dueños y supervisores cuando se crea una nueva reserva
export async function notifyNewReservation(
  clientName: string,
  reservationId: string,
  date: string,
  time: string,
  partySize: number,
  tableNumber: string,
  tableType: string,
) {
  try {
    const tokens = await getSupervisorAndOwnerTokens();

    if (tokens.length === 0) {
      return;
    }

    // Formatear la fecha para mostrar de forma más legible
    const dateObj = new Date(date + 'T00:00:00');
    const formattedDate = dateObj.toLocaleDateString('es-AR', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });

    // Formatear hora (remover segundos si los tiene)
    const timeFormatted = time.substring(0, 5);

    const notificationData: PushNotificationData = {
      title: "📅 Nueva reserva recibida",
      body: `${clientName} - Mesa #${tableNumber} (${tableType}) - ${formattedDate} ${timeFormatted} - ${partySize} personas`,
      data: {
        type: "new_reservation",
        reservationId,
        clientName,
        date,
        time: timeFormatted,
        partySize,
        tableNumber,
        tableType,
        screen: "ManageReservations",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de nueva reserva:", error);
  }
}

// Función para notificar a dueños y supervisores cuando se crea un pedido de delivery
export async function notifyNewDeliveryOrder(
  clientName: string,
  deliveryId: string,
  deliveryAddress: string,
  totalAmount: number,
  itemsCount: number,
) {
  try {
    const tokens = await getSupervisorAndOwnerTokens();

    if (tokens.length === 0) {
      return;
    }

    const notificationData: PushNotificationData = {
      title: "🛵 Nuevo pedido de delivery",
      body: `${clientName} - $${totalAmount.toLocaleString()} (${itemsCount} items) - ${deliveryAddress}`,
      data: {
        type: "new_delivery_order",
        deliveryId,
        clientName,
        deliveryAddress,
        totalAmount,
        itemsCount,
        screen: "ManageDeliveries",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de nuevo delivery:", error);
  }
}

// Función para notificar a todos los repartidores cuando un delivery está listo para ser tomado
export async function notifyDeliveryReadyForDrivers(
  deliveryId: string,
  deliveryAddress: string,
  totalAmount: number,
  estimatedDistanceKm?: number | null,
) {
  try {
    const tokens = await getDriverTokens();

    if (tokens.length === 0) {
      return;
    }

    const distanceText = estimatedDistanceKm 
      ? ` - ${estimatedDistanceKm.toFixed(1)} km`
      : "";

    const notificationData: PushNotificationData = {
      title: "🚀 Nuevo viaje disponible",
      body: `$${totalAmount.toLocaleString()}${distanceText} - ${deliveryAddress}`,
      data: {
        type: "delivery_ready",
        deliveryId,
        deliveryAddress,
        totalAmount,
        estimatedDistanceKm,
        screen: "AvailableDeliveries",
      },
    };

    await sendExpoPushNotification(tokens, notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de delivery listo a repartidores:", error);
  }
}

// Función para notificar al repartidor cuando el cliente le envía un mensaje
export async function notifyDriverNewMessage(
  driverId: string,
  clientName: string,
  message: string,
  deliveryId: string,
) {
  try {
    const token = await getClientToken(driverId); // Reutilizamos esta función genérica

    if (!token) {
      return;
    }

    // Truncar mensaje si es muy largo
    const truncatedMessage =
      message.length > 50 ? message.substring(0, 47) + "..." : message;

    const notificationData: PushNotificationData = {
      title: `📦 ${clientName}`,
      body: truncatedMessage,
      data: {
        type: "delivery_chat_message",
        deliveryId,
        clientName,
        message,
        screen: "DeliveryChat",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de mensaje al repartidor:", error);
  }
}

// Función para notificar al cliente cuando el repartidor le envía un mensaje
export async function notifyClientDriverMessage(
  clientId: string,
  driverName: string,
  message: string,
  deliveryId: string,
) {
  try {
    const token = await getClientToken(clientId);

    if (!token) {
      return;
    }

    // Truncar mensaje si es muy largo
    const truncatedMessage =
      message.length > 50 ? message.substring(0, 47) + "..." : message;

    const notificationData: PushNotificationData = {
      title: `🚗 ${driverName}`,
      body: truncatedMessage,
      data: {
        type: "delivery_chat_message",
        deliveryId,
        driverName,
        message,
        screen: "DeliveryChat",
      },
    };

    await sendExpoPushNotification([token], notificationData);
  } catch (error) {
    console.error("❌ Error al enviar notificación de mensaje al cliente:", error);
  }
}
