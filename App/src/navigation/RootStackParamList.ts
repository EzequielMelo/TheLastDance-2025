import type { StackNavigationProp } from "@react-navigation/stack";

export type RootStackParamList = {
  Login: undefined;
  Registro: undefined;
  RegistroAnonimo: undefined;
  CompleteOAuthRegistration: {
    session_id: string;
    user_preview: {
      email: string;
      first_name: string;
      last_name: string;
      profile_image?: string | null;
    };
  }; // Pantalla para completar registro OAuth con DNI y CUIL
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
  DeliveryChat: { deliveryId: string }; // Chat entre cliente y repartidor
  BillPayment: { tableNumber?: number; tableId?: string }; // Pantalla de pago de cuenta
  DeliveryOrdersManagement: undefined; // Gestión de pedidos de delivery (admin/supervisor)
  InvoiceView: {
    invoiceData: {
      generated: boolean;
      filePath?: string;
      fileName?: string;
      message?: string;
      error?: string;
    };
    paymentAmount?: number;
  }; // Pantalla para ver la factura generada
  KitchenDashboard: undefined; // Panel de cocina para cocineros
  KitchenMenu: undefined; // Menú de platos para cocineros (solo vista)
  BartenderDashboard: undefined; // Panel de bar para bartenders
  BarMenu: undefined; // Menú de bebidas para bartenders (solo vista)

  // Sistema de Reservas
  MakeReservation: undefined; // Crear nueva reserva (clientes registrados)
  MyReservations: undefined; // Ver mis reservas (clientes registrados)
  ManageReservations: undefined; // Gestionar reservas (dueño/supervisor)
  ReservationDetails: { reservationId: string }; // Ver detalles de una reserva

  // Sistema de Delivery
  DeliveryLocation: undefined; // Seleccionar ubicación en mapa para delivery
  DeliveryTracking: { deliveryId: string }; // Seguimiento en tiempo real del delivery
  DeliveryHistory: undefined; // Historial de deliveries del usuario
  DriverDeliveries: undefined; // Pantalla de pedidos disponibles para repartidor (empleado)
  MyDeliveries: undefined; // Pantalla de entregas activas del repartidor

  // Sistema de Pago para Deliveries
  DeliveryPaymentQR: {
    deliveryId: string;
    paymentData: {
      totalAmount: number;
      tipAmount: number;
      tipPercentage: number;
      satisfactionLevel: string;
    };
  }; // Mostrar QR para pago de delivery
  DeliveryCashConfirm: {
    deliveryId: string;
    paymentData: {
      totalAmount: number;
      tipAmount: number;
      tipPercentage: number;
      satisfactionLevel: string;
    };
  }; // Confirmar pago en efectivo
  PaymentQRScanner: undefined; // Scanner QR para cliente pagar delivery
};

export type RootStackNavigationProp = StackNavigationProp<RootStackParamList>;
