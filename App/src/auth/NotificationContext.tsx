import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import Constants from 'expo-constants';
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
    if (user && token && expoPushToken) {
      sendTokenToBackend();
    }
  }, [user, token, expoPushToken]);

  const generateToken = () => {
    const timestamp = Date.now().toString(36);
    const randomPart = Math.random().toString(36).substr(2, 15);
    const tokenId = (timestamp + randomPart).substr(0, 22);
    return `ExponentPushToken[${tokenId}]`;
  };

  const setupNotifications = async () => {
    const isExpoGo = Constants.executionEnvironment === 'storeClient';
    
    if (isExpoGo) {
      setExpoPushToken(generateToken());
      return;
    }

    try {
      await NotificationService.setupNotificationChannel();
      let token = await NotificationService.registerForPushNotifications();
      
      if (!token && __DEV__) {
        token = generateToken();
      }
      
      setExpoPushToken(token);
    } catch (error) {
      if (__DEV__) {
        setExpoPushToken(generateToken());
      }
    }
  };

  const sendTokenToBackend = async () => {
    if (!expoPushToken || !token) {
      return;
    }

    try {   
      await api.post('/auth/update-push-token', {
        pushToken: expoPushToken,
      });
    } catch (error: any) {
      console.error('Error enviando token:', error);
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