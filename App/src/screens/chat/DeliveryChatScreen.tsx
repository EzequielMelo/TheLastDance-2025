/**
 * DeliveryChatScreen - Chat entre cliente y repartidor
 * Basado en TableChatScreen pero adaptado para deliveries
 */

import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ToastAndroid,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { MessageCircle, Send, ArrowLeft, Package } from "lucide-react-native";
import { useAuth } from "../../auth/useAuth";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import Avatar from "../../components/chat/Avatar";
import type {
  DeliveryChatMessageWithSender,
  DeliveryChatWithDetails,
} from "../../types/DeliveryChat";
import {
  getOrCreateDeliveryChat,
  getDeliveryChatMessages,
  sendDeliveryMessage,
  markDeliveryMessagesAsRead,
} from "../../api/deliveryChat";
import { io, Socket } from "socket.io-client";
import { SERVER_BASE_URL } from "../../api/config";

type DeliveryChatRouteProp = RouteProp<RootStackParamList, "DeliveryChat">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function DeliveryChatScreen() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const route = useRoute<DeliveryChatRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { user, token } = useAuth();
  const { deliveryId } = route.params;

  const [inputMessage, setInputMessage] = useState("");
  const [messages, setMessages] = useState<DeliveryChatMessageWithSender[]>([]);
  const [chatInfo, setChatInfo] = useState<DeliveryChatWithDetails | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isChatClosed, setIsChatClosed] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const socketRef = useRef<Socket | null>(null);

  // Determinar si el usuario es cliente o repartidor
  const isClient = user?.profile_code !== "empleado";
  const isDriver = user?.profile_code === "empleado";

  // Inicializar chat y socket
  useEffect(() => {
    let mounted = true;

    const initializeChat = async () => {
      try {
        setIsLoading(true);

        // Obtener o crear chat
        const chat = await getOrCreateDeliveryChat(deliveryId);
        if (mounted) {
          setChatInfo(chat);

          // Obtener mensajes
          const msgs = await getDeliveryChatMessages(chat.id);
          setMessages(msgs);

          // Conectar socket
          connectSocket(chat.id);

          setIsLoading(false);
        }
      } catch (error: any) {
        console.error("Error al inicializar chat de delivery:", error);
        ToastAndroid.show(
          error.message || "Error al cargar chat",
          ToastAndroid.LONG,
        );
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeChat();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [deliveryId]);

  // Conectar Socket.IO
  const connectSocket = (chatId: string) => {
    if (socketRef.current?.connected) {
      console.log("Socket ya conectado");
      return;
    }

    if (!token) {
      console.error("No hay token disponible");
      return;
    }

    const socket = io(SERVER_BASE_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
    });

    socket.on("connect", () => {
      console.log("✅ Socket conectado para delivery chat");
      setIsConnected(true);
      socket.emit("join_delivery_chat", chatId);
    });

    socket.on("disconnect", reason => {
      console.log("🔴 Socket desconectado:", reason);
      setIsConnected(false);
    });

    socket.on("joined_delivery_room", data => {
      console.log("✅ Unido a sala de delivery:", data);
      markDeliveryMessagesAsRead(chatId).catch(console.error);
    });

    socket.on("new_delivery_message", (msg: any) => {
      console.log("📨 Nuevo mensaje de delivery:", msg);
      const newMessage: DeliveryChatMessageWithSender = {
        id: msg.id,
        delivery_chat_id: chatId,
        sender_id: msg.senderId,
        message: msg.message,
        is_read: msg.isRead,
        created_at: msg.timestamp,
        sender_name: msg.senderName,
        sender_first_name: msg.senderFirstName,
        sender_last_name: msg.senderLastName,
        sender_image: msg.senderImage,
        sender_type: msg.senderType,
      };

      setMessages(prev => [...prev, newMessage]);

      // Marcar como leído si no es mi mensaje
      if (msg.senderId !== user?.id) {
        setTimeout(() => {
          markDeliveryMessagesAsRead(chatId).catch(console.error);
        }, 500);
      }
    });

    socket.on("delivery_message_sent", data => {
      console.log("✅ Mensaje enviado:", data);
    });

    socket.on("delivery_messages_read", data => {
      console.log("👁️ Mensajes leídos por:", data.readByName);
    });

    socket.on("delivery_chat_closed", data => {
      console.log("📪 Chat cerrado:", data);
      setIsChatClosed(true);
      ToastAndroid.show(
        "El pedido fue entregado. Este chat ya no está disponible.",
        ToastAndroid.LONG,
      );
    });

    socket.on("user_joined_delivery", data => {
      console.log("👤 Usuario se unió:", data.userName);
    });

    socket.on("error", error => {
      console.error("❌ Socket error:", error);
      ToastAndroid.show(
        error.message || "Error de conexión",
        ToastAndroid.SHORT,
      );
    });

    socketRef.current = socket;
  };

  // Desconectar socket
  const disconnectSocket = () => {
    if (socketRef.current) {
      if (chatInfo?.id) {
        socketRef.current.emit("leave_delivery_chat", chatInfo.id);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  };

  // Auto-scroll al final cuando lleguen nuevos mensajes
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Marcar como leído cuando la pantalla está activa
  useEffect(() => {
    const unsubscribe = navigation.addListener("focus", () => {
      if (chatInfo?.id) {
        markDeliveryMessagesAsRead(chatInfo.id).catch(console.error);
      }
    });

    return unsubscribe;
  }, [navigation, chatInfo?.id]);

  // Detectar altura del teclado
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      "keyboardDidShow",
      e => {
        setKeyboardHeight(e.endCoordinates.height);
      },
    );
    const keyboardDidHideListener = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      },
    );

    return () => {
      keyboardDidHideListener?.remove();
      keyboardDidShowListener?.remove();
    };
  }, []);

  const handleSendMessage = () => {
    if (!inputMessage.trim() || !chatInfo?.id || !isConnected || isChatClosed) {
      if (isChatClosed) {
        ToastAndroid.show(
          "Este chat ya no está disponible",
          ToastAndroid.SHORT,
        );
      }
      return;
    }

    // Emitir mensaje por socket
    socketRef.current?.emit("send_delivery_message", {
      deliveryChatId: chatInfo.id,
      message: inputMessage.trim(),
    });

    setInputMessage("");
  };

  const renderMessage = ({ item }: { item: DeliveryChatMessageWithSender }) => {
    const isMyMessage = item.sender_id === user?.id;
    const messageTime = new Date(item.created_at).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const senderDisplayName =
      item.sender_name ||
      `${item.sender_first_name} ${item.sender_last_name}`.trim();

    return (
      <View
        style={[
          styles.messageContainer,
          isMyMessage ? styles.myMessage : styles.otherMessage,
        ]}
      >
        {/* Avatar solo para mensajes de otros */}
        {!isMyMessage && (
          <Avatar
            imageUrl={item.sender_image || undefined}
            name={senderDisplayName}
            size="small"
            style={styles.messageAvatar}
          />
        )}

        {/* Burbuja del mensaje */}
        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          {/* Nombre del remitente dentro de la burbuja */}
          {!isMyMessage && (
            <Text style={styles.senderName}>
              {senderDisplayName}
              {item.sender_type === "driver" && " 🚗"}
            </Text>
          )}

          {/* Texto del mensaje */}
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.message}
          </Text>

          {/* Footer con hora */}
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
              ]}
            >
              {messageTime}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#d4af37" />
          <Text style={styles.loadingText}>Cargando chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const otherUser = isClient
    ? {
        name:
          chatInfo?.driver_name ||
          `${chatInfo?.driver_first_name} ${chatInfo?.driver_last_name}`.trim(),
        image: chatInfo?.driver_image,
        type: "Repartidor",
      }
    : {
        name:
          chatInfo?.client_name ||
          `${chatInfo?.client_first_name} ${chatInfo?.client_last_name}`.trim(),
        image: chatInfo?.client_image,
        type: "Cliente",
      };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <ArrowLeft size={24} color="#d4af37" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Avatar
              imageUrl={otherUser.image || undefined}
              name={otherUser.name}
              size="small"
            />
            <View style={styles.headerText}>
              <Text style={styles.headerTitle}>{otherUser.name}</Text>
              <View style={styles.headerSubtitle}>
                <Package size={14} color="#ccc" />
                <Text style={styles.headerSubtitleText}>
                  {otherUser.type} • {isConnected ? "En línea" : "Desconectado"}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Indicador de chat cerrado */}
        {isChatClosed && (
          <View style={styles.closedBanner}>
            <Text style={styles.closedBannerText}>
              📦 Pedido entregado - Este chat ya no está disponible
            </Text>
          </View>
        )}

        {/* Lista de mensajes */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MessageCircle size={48} color="#666" />
              <Text style={styles.emptyText}>
                Aún no hay mensajes. {"\n"}
                ¡Envía el primero!
              </Text>
            </View>
          }
        />

        {/* Input de mensaje */}
        <View
          style={[
            styles.inputContainer,
            { marginBottom: Platform.OS === "ios" ? keyboardHeight : 0 },
            isChatClosed && styles.inputContainerDisabled,
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder={
              isChatClosed ? "Chat cerrado" : "Escribe un mensaje..."
            }
            placeholderTextColor="#666"
            value={inputMessage}
            onChangeText={setInputMessage}
            multiline
            maxLength={500}
            editable={!isChatClosed}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!inputMessage.trim() || !isConnected || isChatClosed) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputMessage.trim() || !isConnected || isChatClosed}
          >
            <Send
              size={20}
              color={
                inputMessage.trim() && isConnected && !isChatClosed
                  ? "#1a1a1a"
                  : "#666"
              }
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1a1a1a",
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#ccc",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2d2d2d",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  backButton: {
    padding: 4,
    marginRight: 8,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  headerText: {
    marginLeft: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#d4af37",
  },
  headerSubtitle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  headerSubtitleText: {
    fontSize: 12,
    color: "#ccc",
    marginLeft: 4,
  },
  closedBanner: {
    backgroundColor: "rgba(212, 175, 55, 0.2)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#d4af37",
  },
  closedBannerText: {
    fontSize: 14,
    color: "#d4af37",
    textAlign: "center",
  },
  messagesList: {
    padding: 16,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: "#ccc",
    textAlign: "center",
  },
  messageContainer: {
    marginBottom: 16,
    flexDirection: "row",
  },
  myMessage: {
    justifyContent: "flex-end",
  },
  otherMessage: {
    justifyContent: "flex-start",
    alignItems: "flex-end",
  },
  messageAvatar: {
    marginRight: 8,
  },
  senderName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#d4af37",
    marginBottom: 4,
  },
  messageBubble: {
    maxWidth: "80%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: "#d4af37",
    borderTopRightRadius: 4,
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: "#333",
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#1a1a1a",
  },
  otherMessageText: {
    color: "#ffffff",
  },
  messageFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
  },
  myMessageTime: {
    color: "#1a1a1a",
    opacity: 0.7,
  },
  otherMessageTime: {
    color: "#ccc",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#2d2d2d",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  inputContainerDisabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 15,
    maxHeight: 100,
    marginRight: 8,
    color: "#ffffff",
  },
  sendButton: {
    backgroundColor: "#d4af37",
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#333",
  },
});
