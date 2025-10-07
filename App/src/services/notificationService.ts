import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Configurar handler solo si no estamos en Expo Go
if (Constants.executionEnvironment !== 'storeClient') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export interface NotificationData {
  type: 'new_client_registration';
  clientId: string;
  clientName: string;
}

export class NotificationService {
  private static expoPushToken: string | null = null;

  static async registerForPushNotifications(): Promise<string | null> {
    if (Constants.executionEnvironment === 'storeClient' || !Device.isDevice) {
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      this.expoPushToken = tokenData.data;
      return this.expoPushToken;
    } catch (error) {
      return null;
    }
  }

  static async setupNotificationChannel() {
    if (Constants.executionEnvironment === 'storeClient' || Platform.OS !== 'android') {
      return;
    }

    await Notifications.setNotificationChannelAsync('client_registrations', {
      name: 'Registro de Clientes',
      description: 'Notificaciones de nuevos registros de clientes',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#d4af37',
    });
  }

  static getExpoPushToken(): string | null {
    return this.expoPushToken;
  }

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
      trigger: null,
    });
  }
}