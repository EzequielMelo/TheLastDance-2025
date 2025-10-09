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
  senderImage?: string;
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
  client_image?: string;
  waiter_image?: string;
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
  const [forceUpdate, setForceUpdate] = useState(0);

  // Cargar mensajes existentes
  const loadMessages = useCallback(
    async (chatId: string) => {
      try {
        Logger.info(`🔄 Cargando mensajes para chat: ${chatId}`);
        const response = await fetch(
          `${API_BASE_URL}/chat/${chatId}/messages`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          const formattedMessages = data.data.map((msg: any) => ({
            id: msg.id,
            message: msg.message_text,
            senderId: msg.sender_id,
            senderName: msg.sender_name,
            senderImage: msg.sender_image,
            senderType: msg.sender_type,
            timestamp: msg.created_at,
            isRead: msg.is_read,
          }));
          Logger.info(
            `📥 Mensajes cargados desde BD: ${formattedMessages.length}`,
          );
          setMessages(formattedMessages);
          return formattedMessages;
        }
      } catch (error) {
        Logger.error("Error cargando mensajes:", error);
        return [];
      }
    },
    [token],
  );

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
          Logger.info(`🚪 Intentando unirse al chat de mesa: ${tableId}`);
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
          Logger.info("📨 Nuevo mensaje recibido:", message);
          Logger.info(`💬 De: ${message.senderName} (${message.senderType})`);
          Logger.info(
            `📝 Contenido: "${message.message.substring(0, 50)}${message.message.length > 50 ? "..." : ""}"`,
          );

          // Usar callback para asegurar que se base en el estado más actual
          setMessages(prevMessages => {
            // Verificar si el mensaje ya existe para evitar duplicados
            const messageExists = prevMessages.some(
              msg => msg.id === message.id,
            );
            if (messageExists) {
              Logger.warn("⚠️ Mensaje duplicado ignorado:", message.id);
              return prevMessages;
            }

            const newMessages = [...prevMessages, message];
            Logger.info(
              `📊 Total mensajes después de agregar: ${newMessages.length}`,
            );
            return newMessages;
          });
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
          Logger.error("❌ Error del socket:", error);
          onError?.(error.message);
        });

        // Evento de confirmación de unión exitosa
        socketInstance.on(
          "joined_room",
          (data: { roomName: string; userCount: number }) => {
            Logger.info(
              `✅ Te uniste exitosamente a la sala: ${data.roomName} con ${data.userCount} usuarios`,
            );
          },
        );

        // Confirmación de mensaje enviado
        socketInstance.on(
          "message_sent",
          (data: { messageId: string; success: boolean }) => {
            Logger.info(`✅ Mensaje enviado confirmado: ${data.messageId}`);
          },
        );

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

  // Polling de respaldo para sincronizar mensajes cada 5 segundos
  useEffect(() => {
    if (!chatInfo?.id || !isConnected) return;

    const interval = setInterval(async () => {
      try {
        const freshMessages = await loadMessages(chatInfo.id);
        if (freshMessages && freshMessages.length !== messages.length) {
          Logger.info("🔄 Sincronización por polling: mensajes actualizados");
        }
      } catch (error) {
        Logger.warn("⚠️ Error en polling de mensajes:", error);
      }
    }, 5000); // Cada 5 segundos

    return () => clearInterval(interval);
  }, [chatInfo?.id, isConnected, messages.length, loadMessages]);

  // Enviar mensaje
  const sendMessage = useCallback(
    (message: string) => {
      if (!socket || !isConnected || !chatInfo || !message.trim()) {
        Logger.warn(
          "No se puede enviar mensaje: socket no conectado o mensaje vacío",
        );
        return false;
      }

      Logger.info("📤 Enviando mensaje:", {
        chatId: chatInfo.id,
        message: message.trim(),
        tableId: tableId,
        socketConnected: isConnected,
        socketId: socket.id,
      });

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

  // Refrescar mensajes manualmente
  const refreshMessages = useCallback(async () => {
    if (!chatInfo?.id) return;
    Logger.info("🔄 Refrescando mensajes manualmente...");
    await loadMessages(chatInfo.id);
    setForceUpdate(prev => prev + 1);
  }, [chatInfo?.id, loadMessages]);

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
    forceUpdate,

    // Acciones
    sendMessage,
    markAsRead,
    refreshMessages,

    // Utilidades
    isClient:
      user?.profile_code === "cliente_anonimo" ||
      user?.profile_code === "cliente_registrado",
    isWaiter: user?.position_code === "mozo",
  };
};
