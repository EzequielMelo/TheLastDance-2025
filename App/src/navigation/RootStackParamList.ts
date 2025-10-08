import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Login: undefined;
  Registro: undefined;
  RegistroAnonimo: undefined;
  Home: undefined;
  Splash: undefined;
  CreateMenuItem: { initialCategory?: "plato" | "bebida" } | undefined;
  AddStaff: { userRole: "dueno" | "supervisor" };
  Clients: undefined; // Agregamos la ruta Clients
  CreateTable: undefined; // Nueva ruta para crear mesas
  ManageWaitingList: undefined; // Nueva ruta para gestionar lista de espera
  GenerateWaitingListQR: undefined; // Generar QR para maitre
  ScanQR: undefined; // Escanear QR para clientes
  JoinWaitingList: { qrData?: any }; // Formulario con datos del QR
  MyWaitingPosition: undefined; // Ver posición en lista de espera
  ScanTableQR: undefined; // Escanear QR de mesa para confirmar llegada
  Menu: { tableId?: string } | undefined; // Menú para clientes
  WaiterDashboard: undefined; // Panel del mesero
  AllWaiters: undefined; // Gestión de meseros (admin/supervisor)
  TableChat: { tableId: string }; // Chat entre cliente y mesero
};

export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
