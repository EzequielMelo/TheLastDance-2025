import React, { useEffect } from 'react';
import { usePaymentNotificationHandler } from '../Hooks/usePaymentNotificationHandler';
import { useNotifications } from '../auth/NotificationContext';

// Componente que configura los handlers de notificación DENTRO del NavigationContainer
export const NavigationNotificationHandler: React.FC = () => {
  const { setupPaymentNotificationHandler } = useNotifications();
  const { handlePaymentConfirmedNotification } = usePaymentNotificationHandler();

  useEffect(() => {
    console.log('🔔 Configurando handlers de notificación con navegación disponible');
    
    try {
      setupPaymentNotificationHandler(handlePaymentConfirmedNotification);
      console.log('✅ Handlers de notificación configurados correctamente');
    } catch (error) {
      console.error('❌ Error configurando handlers de notificación:', error);
    }
  }, [setupPaymentNotificationHandler, handlePaymentConfirmedNotification]);

  // Este componente no renderiza nada, solo configura los handlers
  return null;
};

export default NavigationNotificationHandler;