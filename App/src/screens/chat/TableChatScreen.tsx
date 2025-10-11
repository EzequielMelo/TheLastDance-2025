import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useRoute, useNavigation } from "@react-navigation/native";
import { MessageCircle, Send, ArrowLeft, Users } from "lucide-react-native";
import { useChat, ChatMessage } from "../../Hooks/useChat";
import { useAuth } from "../../auth/useAuth";
import { RootStackParamList } from "../../navigation/RootStackParamList";
import Avatar from "../../components/chat/Avatar";

type TableChatRouteProp = RouteProp<RootStackParamList, "TableChat">;

export default function TableChatScreen() {
  const route = useRoute<TableChatRouteProp>();
  const navigation = useNavigation();
  const { user } = useAuth();
  const { tableId, autoMessage } = route.params;

  const [inputMessage, setInputMessage] = useState("");
  const [userJoinedMessage, setUserJoinedMessage] = useState<string | null>(
    null,
  );
  const [autoMessageSent, setAutoMessageSent] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const {
    messages,
    chatInfo,
    isConnected,
    isLoading,
    connectionError,
    unreadCount,
    sendMessage,
    markAsRead,
    refreshMessages,
    isClient,
    isWaiter,
  } = useChat({
    tableId,
    onError: (error: string) => {
      Alert.alert("Error de Chat", error);
    },
    onUserJoined: (userData: {
      userName: string;
      userType: "client" | "waiter";
    }) => {
      setUserJoinedMessage(`${userData.userName} se unió al chat`);
      setTimeout(() => setUserJoinedMessage(null), 3000);
    },
  });

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
      markAsRead();
    });

    return unsubscribe;
  }, [navigation, markAsRead]);

  // Enviar mensaje automático si se proporciona
  useEffect(() => {
    if (autoMessage && !autoMessageSent && isConnected && !isLoading) {
      console.log("🤖 Enviando mensaje automático:", autoMessage);
      const success = sendMessage(autoMessage);
      if (success) {
        setAutoMessageSent(true);
      }
    }
  }, [autoMessage, autoMessageSent, isConnected, isLoading, sendMessage]);

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const success = sendMessage(inputMessage);
    if (success) {
      setInputMessage("");
    } else {
      Alert.alert("Error", "No se pudo enviar el mensaje");
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMyMessage = item.senderId === user?.id;
    const messageTime = new Date(item.timestamp).toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    });

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
            imageUrl={item.senderImage}
            name={item.senderName}
            size="small"
            style={styles.messageAvatar}
          />
        )}

        <View
          style={[
            styles.messageBubble,
            isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble,
          ]}
        >
          {!isMyMessage && (
            <Text style={styles.senderName}>{item.senderName}</Text>
          )}
          <Text
            style={[
              styles.messageText,
              isMyMessage ? styles.myMessageText : styles.otherMessageText,
            ]}
          >
            {item.message}
          </Text>
          <View style={styles.messageFooter}>
            <Text
              style={[
                styles.messageTime,
                isMyMessage ? styles.myMessageTime : styles.otherMessageTime,
              ]}
            >
              {messageTime}
            </Text>
            {isMyMessage && (
              <Text style={styles.readStatus}>{item.isRead ? "✓✓" : "✓"}</Text>
            )}
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
          <Text style={styles.loadingText}>Conectando al chat...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (connectionError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MessageCircle size={64} color="#e53e3e" />
          <Text style={styles.errorTitle}>Error de Conexión</Text>
          <Text style={styles.errorText}>{connectionError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.retryButtonText}>Volver</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={24} color="#d4af37" />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle}>
              Chat Mesa {chatInfo?.table_number}
            </Text>
            <View style={styles.connectionStatus}>
              <View
                style={[
                  styles.statusDot,
                  isConnected ? styles.connectedDot : styles.disconnectedDot,
                ]}
              />
              <Text style={styles.statusText}>
                {isConnected ? "Conectado" : "Desconectado"}
              </Text>
            </View>
          </View>

          <View style={styles.participantsInfo}>
            <Avatar
              imageUrl={
                isClient ? chatInfo?.waiter_image : chatInfo?.client_image
              }
              name={
                isClient
                  ? chatInfo?.waiter_name || ""
                  : chatInfo?.client_name || ""
              }
              size="small"
              style={styles.headerAvatar}
            />
            <Text style={styles.participantsText}>
              {isClient ? chatInfo?.waiter_name : chatInfo?.client_name}
            </Text>
          </View>
        </View>

        {/* Mensaje de usuario que se unió */}
        {userJoinedMessage && (
          <View style={styles.joinedMessageContainer}>
            <Text style={styles.joinedMessageText}>{userJoinedMessage}</Text>
          </View>
        )}

        {/* Lista de mensajes */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          style={styles.messagesList}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        {/* Input de mensaje */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={inputMessage}
            onChangeText={setInputMessage}
            placeholder={
              isClient ? "Escribe al mesero..." : "Escribe al cliente..."
            }
            placeholderTextColor="#666"
            multiline
            maxLength={500}
            editable={isConnected}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!isConnected || !inputMessage.trim()) &&
                styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!isConnected || !inputMessage.trim()}
          >
            <Send
              size={20}
              color={!isConnected || !inputMessage.trim() ? "#666" : "#1a1a1a"}
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    marginTop: 16,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    color: "#e53e3e",
    fontSize: 24,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: "#d4af37",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: "#1a1a1a",
    fontWeight: "bold",
    fontSize: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333",
    backgroundColor: "#2d2d2d",
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    color: "#d4af37",
    fontSize: 18,
    fontWeight: "bold",
  },
  connectionStatus: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectedDot: {
    backgroundColor: "#22c55e",
  },
  disconnectedDot: {
    backgroundColor: "#e53e3e",
  },
  statusText: {
    color: "#ccc",
    fontSize: 12,
  },
  participantsInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  participantsText: {
    color: "#d4af37",
    fontSize: 12,
    marginLeft: 4,
  },
  joinedMessageContainer: {
    backgroundColor: "#d4af37",
    margin: 16,
    padding: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  joinedMessageText: {
    color: "#1a1a1a",
    fontSize: 14,
    fontWeight: "bold",
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  messageContainer: {
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  myMessage: {
    alignItems: "flex-end",
  },
  otherMessage: {
    flexDirection: "row",
    alignItems: "flex-end",
  },
  messageBubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 16,
  },
  myMessageBubble: {
    backgroundColor: "#d4af37",
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: "#333",
    borderBottomLeftRadius: 4,
  },
  senderName: {
    color: "#d4af37",
    fontSize: 12,
    fontWeight: "bold",
    marginBottom: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  myMessageText: {
    color: "#1a1a1a",
  },
  otherMessageText: {
    color: "#fff",
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
  readStatus: {
    color: "#1a1a1a",
    fontSize: 12,
    marginLeft: 8,
  },
  inputContainer: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: "#2d2d2d",
    alignItems: "flex-end",
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#555",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 16,
    maxHeight: 100,
    marginRight: 12,
  },
  sendButton: {
    backgroundColor: "#d4af37",
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: "#555",
  },
  messageAvatar: {
    marginRight: 8,
    marginBottom: 4,
  },
  headerAvatar: {
    marginRight: 8,
  },
});
