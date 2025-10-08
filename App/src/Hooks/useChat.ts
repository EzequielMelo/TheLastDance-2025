import { useEffect, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useAuth } from "../auth/useAuth";
import { API_BASE_URL, SERVER_BASE_URL } from "../api/config";
import { Logger } from "../utils/Logger";

export interface ChatMessage {
  id: string;
  message: string;
  senderId: string;
  senderName: string;
  senderType: "client" | "waiter";
  timestamp: string;
  isRead: boolean;
}

export interface ChatInfo {
  id: string;
  table_id: string;
  client_id: string;
  waiter_id: string;
  client_name: string;
  waiter_name: string;
  table_number: number;
  is_active: boolean;
}

export interface UseChatProps {
  tableId: string;
  onError?: (error: string) => void;
  onUserJoined?: (user: {
    userName: string;
    userType: "client" | "waiter";
  }) => void;
}

export const useChat = ({ tableId, onError, onUserJoined }: UseChatProps) => {
  const { token, user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInfo, setChatInfo] = useState<ChatInfo | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Inicializar chat y conexión Socket.IO
  useEffect(() => {
    if (!token || !tableId || !user) return;

    const initializeChat = async () => {
      try {
        setIsLoading(true);
        setConnectionError(null);

        // Obtener o crear chat
        const response = await fetch(`${API_BASE_URL}/chat/table/${tableId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || "Error al inicializar chat");
        }

        const chatData = await response.json();
        setChatInfo(chatData.data);

        // Cargar mensajes existentes
        if (chatData.data?.id) {
          await loadMessages(chatData.data.id);
        }

        // Conectar Socket.IO
        const socketInstance = io(SERVER_BASE_URL, {
          auth: { token },
          // Configuración para evitar reconexiones no deseadas
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          timeout: 20000,
          forceNew: true, // Crear nueva conexión en lugar de reutilizar
        });

        // Eventos de conexión
        socketInstance.on("connect", () => {
          Logger.info("Conectado al chat");
          setIsConnected(true);
          setConnectionError(null);

          // Unirse al chat de la mesa
          socketInstance.emit("join_table_chat", tableId);
        });

        socketInstance.on("disconnect", () => {
          Logger.info("Desconectado del chat");
          setIsConnected(false);
        });

        socketInstance.on("connect_error", error => {
          Logger.error("Error de conexión:", error);
          setConnectionError("Error de conexión al chat");
          setIsConnected(false);
          onError?.("Error de conexión al chat");
        });

        // Eventos de chat
        socketInstance.on("new_message", (message: ChatMessage) => {
          Logger.debug("Nuevo mensaje recibido:", message);
          setMessages(prev => [...prev, message]);
        });

        socketInstance.on(
          "user_joined",
          (data: { userName: string; userType: "client" | "waiter" }) => {
            Logger.info(`${data.userName} se unió al chat`);
            onUserJoined?.(data);
          },
        );

        socketInstance.on(
          "messages_read",
          (data: { readByUserId: string; readByName: string }) => {
            Logger.debug(`Mensajes leídos por ${data.readByName}`);
            if (data.readByUserId !== user.id) {
              setMessages(prev =>
                prev.map(msg =>
                  msg.senderId === user.id ? { ...msg, isRead: true } : msg,
                ),
              );
            }
          },
        );

        socketInstance.on("error", (error: { message: string }) => {
          Logger.error("Error del socket:", error);
          onError?.(error.message);
        });

        setSocket(socketInstance);
      } catch (error) {
        Logger.error("Error inicializando chat:", error);
        const errorMessage =
          error instanceof Error ? error.message : "Error desconocido";
        setConnectionError(errorMessage);
        onError?.(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    initializeChat();

    // Cleanup
    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [token, tableId, user]);

  // Cargar mensajes existentes
  const loadMessages = async (chatId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/chat/${chatId}/messages`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const formattedMessages = data.data.map((msg: any) => ({
          id: msg.id,
          message: msg.message_text,
          senderId: msg.sender_id,
          senderName: msg.sender_name,
          senderType: msg.sender_type,
          timestamp: msg.created_at,
          isRead: msg.is_read,
        }));
        setMessages(formattedMessages);
      }
    } catch (error) {
      Logger.error("Error cargando mensajes:", error);
    }
  };

  // Enviar mensaje
  const sendMessage = useCallback(
    (message: string) => {
      if (!socket || !isConnected || !chatInfo || !message.trim()) {
        Logger.warn(
          "No se puede enviar mensaje: socket no conectado o mensaje vacío",
        );
        return false;
      }

      socket.emit("send_message", {
        chatId: chatInfo.id,
        message: message.trim(),
        tableId: tableId,
      });

      return true;
    },
    [socket, isConnected, chatInfo, tableId],
  );

  // Marcar mensajes como leídos
  const markAsRead = useCallback(() => {
    if (!socket || !isConnected || !chatInfo) return;

    socket.emit("mark_as_read", {
      chatId: chatInfo.id,
      tableId: tableId,
    });
  }, [socket, isConnected, chatInfo, tableId]);

  // Obtener mensajes no leídos
  const unreadCount = messages.filter(
    msg => !msg.isRead && msg.senderId !== user?.id,
  ).length;

  return {
    // Estado
    messages,
    chatInfo,
    isConnected,
    isLoading,
    connectionError,
    unreadCount,

    // Acciones
    sendMessage,
    markAsRead,

    // Utilidades
    isClient:
      user?.profile_code === "cliente_anonimo" ||
      user?.profile_code === "cliente_registrado",
    isWaiter: user?.position_code === "mozo",
  };
};
