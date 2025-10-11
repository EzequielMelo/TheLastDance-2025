import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Login: undefined;
  Registro: undefined;
  RegistroAnonimo: undefined;
  Home: { refresh?: number } | undefined;
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
  Menu:
    | {
        mode?: "normal" | "modify-rejected";
        rejectedItems?: any[];
        orderId?: string;
      }
    | undefined; // Menú para clientes
  WaiterDashboard: undefined; // Panel del mesero
  WaiterOrders: undefined; // Gestión de órdenes del mesero
  AllWaiters: undefined; // Gestión de meseros (admin/supervisor)
  TableChat: { tableId: string }; // Chat entre cliente y mesero
  KitchenDashboard: undefined; // Panel de cocina para cocineros
  BartenderDashboard: undefined; // Panel de bar para bartenders
};

export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
