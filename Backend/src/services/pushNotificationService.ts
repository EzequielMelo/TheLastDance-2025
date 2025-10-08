import { supabaseAdmin } from "../config/supabase";

interface PushNotificationData {
  title: string;
  body: string;
  data?: any;
}

// Función para enviar notificaciones push usando Expo Push API
async function sendExpoPushNotification(
  expoPushTokens: string[],
  notificationData: PushNotificationData
) {
  const messages = expoPushTokens.map(token => ({
    to: token,
    sound: 'default',
    title: notificationData.title,
    body: notificationData.body,
    data: notificationData.data || {},
  }));

  console.log('📨 Sending push notifications to tokens:', expoPushTokens);

  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messages),
    });

    const result = await response.json();
    console.log('📱 Push notification response:', result);
    
    // Log detallado de resultados
    if (result && typeof result === 'object' && 'data' in result && Array.isArray(result.data)) {
      result.data.forEach((item: any, index: number) => {
        if (item.status === 'error') {
          console.log(`❌ Token ${index + 1} error:`, item.message);
        } else {
          console.log(`✅ Token ${index + 1} sent successfully`);
        }
      });
    }
    
    return result;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

// Función para obtener push tokens por tipo de perfil
async function getUserTokensByProfile(profiles: string[]): Promise<string[]> {
  try {
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('push_token')
      .in('profile_code', profiles)
      .eq('state', 'aprobado')
      .not('push_token', 'is', null);

    if (error) {
      console.error('Error fetching user tokens by profile:', error);
      return [];
    }

    return users
      .map(user => user.push_token)
      .filter(token => token && token.trim() !== '');
  } catch (error) {
    console.error('Error in getUserTokensByProfile:', error);
    return [];
  }
}

// Función específica para obtener tokens de supervisores y dueños
async function getSupervisorAndOwnerTokens(): Promise<string[]> {
  return getUserTokensByProfile(['supervisor', 'dueno']);
}

// Función para obtener tokens de clientes (para futuro uso)
export async function getClientTokens(): Promise<string[]> {
  return getUserTokensByProfile(['cliente_registrado', 'cliente_anonimo']);
}

// Función para obtener tokens de empleados (para futuro uso)
export async function getEmployeeTokens(): Promise<string[]> {
  return getUserTokensByProfile(['empleado']);
}

// Función principal para notificar sobre nuevo registro de cliente
export async function notifyNewClientRegistration(clientName: string, clientId: string) {
  try {
    console.log(`Enviando notificación de nuevo cliente: ${clientName}`);
    
    // Obtener tokens de supervisores y dueños
    const tokens = await getSupervisorAndOwnerTokens();
    
    if (tokens.length === 0) {
      console.log('No hay supervisores/dueños con push tokens para notificar');
      return;
    }

    console.log(`Enviando notificación a ${tokens.length} supervisores/dueños`);

    // Preparar datos de la notificación
    const notificationData: PushNotificationData = {
      title: 'Nuevo cliente registrado',
      body: `${clientName} se ha registrado y necesita aprobación`,
      data: {
        type: 'new_client_registration',
        clientId: clientId,
        clientName: clientName,
      },
    };

    // Enviar notificación
    await sendExpoPushNotification(tokens, notificationData);
    
    console.log('Notificación enviada exitosamente');
  } catch (error) {
    console.error('Error al enviar notificación de nuevo cliente:', error);
  }
}

// Función para notificar a clientes (ejemplo: pedido listo, promociones, etc.)
export async function notifyClients(title: string, body: string, data?: any) {
  try {
    console.log(`Enviando notificación a clientes: ${title}`);
    
    const tokens = await getClientTokens();
    
    if (tokens.length === 0) {
      console.log('No hay clientes con push tokens para notificar');
      return;
    }

    console.log(`Enviando notificación a ${tokens.length} clientes`);

    const notificationData: PushNotificationData = {
      title,
      body,
      data: data || {},
    };

    await sendExpoPushNotification(tokens, notificationData);
    console.log('Notificación a clientes enviada exitosamente');
  } catch (error) {
    console.error('Error al enviar notificación a clientes:', error);
  }
}

// Función para notificar a empleados (ejemplo: nuevos platos, cambios de turno, etc.)
export async function notifyEmployees(title: string, body: string, data?: any) {
  try {
    console.log(`Enviando notificación a empleados: ${title}`);
    
    const tokens = await getEmployeeTokens();
    
    if (tokens.length === 0) {
      console.log('No hay empleados con push tokens para notificar');
      return;
    }

    console.log(`Enviando notificación a ${tokens.length} empleados`);

    const notificationData: PushNotificationData = {
      title,
      body,
      data: data || {},
    };

    await sendExpoPushNotification(tokens, notificationData);
    console.log('Notificación a empleados enviada exitosamente');
  } catch (error) {
    console.error('Error al enviar notificación a empleados:', error);
  }
}

// Función para notificar al cliente recién registrado sobre el estado de su cuenta
export async function notifyClientAccountCreated(clientId: string) {
  try {
    console.log(`Enviando notificación de cuenta creada al cliente: ${clientId}`);
    
    // Obtener el push token del cliente específico
    const { data: client, error } = await supabaseAdmin
      .from('users')
      .select('push_token, name')
      .eq('id', clientId)
      .single();

    if (error) {
      console.error('Error obteniendo datos del cliente:', error);
      return;
    }

    if (!client?.push_token) {
      console.log('Cliente no tiene push token registrado');
      return;
    }

    console.log(`Enviando notificación de cuenta creada a: ${client.name}`);

    // Preparar datos de la notificación para el cliente
    const notificationData: PushNotificationData = {
      title: 'Cuenta creada exitosamente',
      body: 'Para ingresar a la aplicación la cuenta debe ser aprobada',
      data: {
        type: 'account_created',
        status: 'pending_approval',
      },
    };

    // Enviar notificación al cliente específico
    await sendExpoPushNotification([client.push_token], notificationData);
    
    console.log('Notificación de cuenta creada enviada exitosamente');
  } catch (error) {
    console.error('Error al enviar notificación de cuenta creada:', error);
  }
}

// Función para actualizar el push token de un usuario
export async function updateUserPushToken(userId: string, pushToken: string) {
  try {
    console.log('🔄 updateUserPushToken called with:', { userId, pushToken });
    
    const { error } = await supabaseAdmin
      .from('users')
      .update({ push_token: pushToken })
      .eq('id', userId);

    if (error) {
      console.error('❌ Supabase error updating push token:', error);
      throw new Error('Error actualizando token de notificaciones');
    }

    console.log('✅ Push token actualizado exitosamente para usuario:', userId);
  } catch (error) {
    console.error('❌ Error en updateUserPushToken:', error);
    throw error;
  }
}