import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { NotificationService } from '../services/notificationService';
import { AuthContext } from './AuthContext';
import api from '../api/axios';

interface NotificationContextType {
  expoPushToken: string | null;
  sendTokenToBackend: () => Promise<void>;
  showTestNotification: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType>({
  expoPushToken: null,
  sendTokenToBackend: async () => {},
  showTestNotification: async () => {},
});

export const useNotifications = () => useContext(NotificationContext);

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const { user, token } = useContext(AuthContext);

  useEffect(() => {
    setupNotifications();
  }, []);

  useEffect(() => {
    // Enviar token al backend cuando CUALQUIER usuario se loguee
    // (no solo supervisores/dueños, para preparar futuras funcionalidades)
    console.log('=== NOTIFICATION DEBUG ===');
    console.log('User:', user?.first_name || 'No user');
    console.log('Token exists:', !!token);
    console.log('Push token:', expoPushToken || 'No push token');
    console.log('========================');
    
    if (user && token && expoPushToken) {
      console.log('✅ Enviando push token al backend...');
      sendTokenToBackend();
    } else {
      console.log('❌ No se envía token - falta:', {
        user: !user,
        token: !token, 
        expoPushToken: !expoPushToken
      });
    }
  }, [user, token, expoPushToken]);

  const setupNotifications = async () => {
    // Configurar canal de notificaciones
    await NotificationService.setupNotificationChannel();

    // Registrar para notificaciones push
    const token = await NotificationService.registerForPushNotifications();
    setExpoPushToken(token);
  };

  const sendTokenToBackend = async () => {
    if (!expoPushToken || !token) {
      console.log('❌ sendTokenToBackend: Missing requirements', {
        expoPushToken: !!expoPushToken,
        token: !!token
      });
      return;
    }

    try {
      console.log('🚀 Enviando push token al backend:', expoPushToken);
      await api.post('/auth/update-push-token', {
        pushToken: expoPushToken,
      });
      console.log('✅ Push token sent to backend successfully');
    } catch (error) {
      console.error('❌ Failed to send push token to backend:', error);
    }
  };

  const showTestNotification = async () => {
    await NotificationService.showLocalNotification(
      'Nuevo cliente registrado',
      'Un nuevo cliente se ha registrado y necesita aprobación',
      {
        type: 'new_client_registration',
        clientId: 'test123',
        clientName: 'Cliente de Prueba',
      }
    );
  };

  return (
    <NotificationContext.Provider 
      value={{
        expoPushToken,
        sendTokenToBackend,
        showTestNotification,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};