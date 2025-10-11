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
      result.data.forEach((item: any, index: number) => {
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
export async function updateUserPushToken(userId: string, pushToken: string) {
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
      .eq("position", "maitre")
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
      .eq("position", "mozo")
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

// Función para obtener token de un cliente específico
async function getClientToken(clientId: string): Promise<string | null> {
  try {
    const { data: user, error } = await supabaseAdmin
      .from("users")
      .select("push_token")
      .eq("id", clientId)
      .eq("state", "aprobado")
      .not("push_token", "is", null)
      .single();

    if (error || !user) {
      return null;
    }

    return user.push_token && user.push_token.trim() !== ""
      ? user.push_token
      : null;
  } catch (error) {
    console.error("Error in getClientToken:", error);
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
