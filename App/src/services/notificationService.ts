import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// Configurar cómo se manejan las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationData {
  type: 'new_client_registration';
  clientId: string;
  clientName: string;
}

export class NotificationService {
  private static expoPushToken: string | null = null;

  // Configurar permisos y obtener token
  static async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.log('Push notifications only work on physical devices');
      return null;
    }

    // Verificar permisos existentes
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Solicitar permisos si no los tiene
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Permission not granted for push notifications');
      return null;
    }

    try {
      // Obtener token de Expo Push
      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: undefined, // Usar el projectId del app.json automáticamente
      });
      
      this.expoPushToken = tokenData.data;
      console.log('✅ Expo push token obtenido:', this.expoPushToken);
      
      return this.expoPushToken;
    } catch (error) {
      console.error('❌ Error getting push token:', error);
      
      // Intento alternativo sin projectId específico
      try {
        console.log('🔄 Intentando obtener token sin projectId...');
        const tokenData = await Notifications.getExpoPushTokenAsync();
        this.expoPushToken = tokenData.data;
        console.log('✅ Token alternativo obtenido:', this.expoPushToken);
        return this.expoPushToken;
      } catch (alternativeError) {
        console.error('❌ Error en método alternativo:', alternativeError);
        return null;
      }
    }
  }

  // Configurar canal de notificaciones para Android
  static async setupNotificationChannel() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('client_registrations', {
        name: 'Registro de Clientes',
        description: 'Notificaciones de nuevos registros de clientes',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#d4af37',
      });
    }
  }

  // Obtener el token actual
  static getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

  // Mostrar notificación local (para testing)
  static async showLocalNotification(title: string, body: string, data?: any) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: 'default',
        ...(Platform.OS === 'android' && {
          channelId: 'client_registrations',
        }),
      },
      trigger: null, // Mostrar inmediatamente
    });
  }

  // Limpiar todas las notificaciones
  static async clearAllNotifications() {
    await Notifications.dismissAllNotificationsAsync();
  }

  // Configurar listener para cuando se toca una notificación
  static setupNotificationListener(onNotificationTap: (data: any) => void) {
    return Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data;
      onNotificationTap(data);
    });
  }

  // Configurar listener para notificaciones recibidas mientras la app está abierta
  static setupForegroundListener(onNotificationReceived: (notification: any) => void) {
    return Notifications.addNotificationReceivedListener(notification => {
      onNotificationReceived(notification);
    });
  }
}