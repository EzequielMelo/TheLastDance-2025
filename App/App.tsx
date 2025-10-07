import { AuthProvider } from "./src/auth/AuthContext";
import { NotificationProvider } from "./src/auth/NotificationContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { StatusBar } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#151F2E" />
      <AuthProvider>
        <NotificationProvider>
          <RootNavigator />
        </NotificationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
