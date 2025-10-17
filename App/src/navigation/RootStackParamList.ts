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
  ScanOrderQR: undefined; // Escanear QR para confirmar pedido entregado
  QRScanner: { 
    mode: "order_status" | "confirm_arrival" | "confirm_delivery" | "payment";
    onScanSuccess: (data: string) => void;
  }; // Scanner QR genérico

  Games: undefined; // Pantalla de juegos
  Memory: undefined; // Juego de la memoria
  FastMath: undefined; // Juego de
  Puzzle: undefined; // Juego de puzzle

  Survey: undefined; // Pantalla de encuesta
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
  TableChat: { tableId: string; autoMessage?: string }; // Chat entre cliente y mesero
  BillPayment: { tableNumber?: number; tableId?: string }; // Pantalla de pago de cuenta
  KitchenDashboard: undefined; // Panel de cocina para cocineros
  BartenderDashboard: undefined; // Panel de bar para bartenders
};

export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
