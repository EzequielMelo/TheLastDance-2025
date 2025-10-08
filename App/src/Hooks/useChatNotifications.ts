import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth";
import { API_BASE_URL } from "../api/config";
import { Logger } from "../utils/Logger";

interface ChatNotification {
  tableId: string;
  unreadCount: number;
  lastMessage?: string;
  lastMessageTime?: string;
}

export const useChatNotifications = () => {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar notificaciones iniciales
  useEffect(() => {
    if (!token || !user || user.position_code !== "mozo") return;

    loadNotifications();

    // Actualizar cada 30 segundos
    const interval = setInterval(loadNotifications, 30000);

    return () => clearInterval(interval);
  }, [token, user]);

  const loadNotifications = async () => {
    if (!token || user?.position_code !== "mozo") return;

    try {
      setIsLoading(true);

      // Obtener chats activos del mesero
      const response = await fetch(`${API_BASE_URL}/chat/waiter/active`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const chats = data.data || [];

        // Convertir a notificaciones
        const chatNotifications: ChatNotification[] = chats.map(
          (chat: any) => ({
            tableId: chat.table_id,
            unreadCount: chat.unread_count || 0,
            lastMessage: chat.last_message,
            lastMessageTime: chat.updated_at,
          }),
        );

        setNotifications(chatNotifications);
        Logger.debug(
          "Notificaciones de chat cargadas:",
          chatNotifications.length,
        );
      }
    } catch (error) {
      Logger.error("Error cargando notificaciones de chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Obtener conteo de mensajes no leídos para una mesa específica
  const getUnreadCount = (tableId: string): number => {
    const notification = notifications.find(n => n.tableId === tableId);
    return notification?.unreadCount || 0;
  };

  // Verificar si hay mensajes no leídos en cualquier mesa
  const hasUnreadMessages = (): boolean => {
    return notifications.some(n => n.unreadCount > 0);
  };

  // Obtener total de mensajes no leídos
  const getTotalUnreadCount = (): number => {
    return notifications.reduce((total, n) => total + n.unreadCount, 0);
  };

  // Marcar mesa como leída (llamar cuando el mesero abra el chat)
  const markTableAsRead = (tableId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.tableId === tableId ? { ...n, unreadCount: 0 } : n)),
    );
  };

  // Refrescar notificaciones manualmente
  const refreshNotifications = () => {
    loadNotifications();
  };

  return {
    notifications,
    isLoading,
    getUnreadCount,
    hasUnreadMessages,
    getTotalUnreadCount,
    markTableAsRead,
    refreshNotifications,
  };
};
