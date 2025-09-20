import { AuthProvider } from "./src/auth/AuthContext";
import RootNavigator from "./src/navigation/RootNavigator";
import { StatusBar } from "react-native";

export default function App() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#151F2E" />
      <AuthProvider>
        <RootNavigator />
      </AuthProvider>
    </>
  );
}
