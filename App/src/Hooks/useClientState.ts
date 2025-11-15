import { useState, useEffect, useCallback } from "react";
import api from "../api/axios";
import { useAuth } from "../auth/useAuth";
import { ReservationsService } from "../services/reservations/reservationsService";

export type ClientState =
  | "not_in_queue" // No está en lista de espera
  | "in_queue" // En lista de espera
  | "assigned" // Mesa asignada pero no confirmada
  | "seated" // Mesa confirmada (sentado)
  | "displaced" // Removido de mesa por staff
  | "confirm_pending" // Pago realizado, esperando confirmación del mozo
  | "loading" // Cargando estado
  | "error"; // Error al obtener estado

export interface ClientStateData {
  state: ClientState;
  waitingPosition?: number;
  waitingId?: string;
  assignedTable?: {
    id: string;
    number: number;
  };
  occupiedTable?: {
    id: string;
    number: number;
    id_waiter?: string;
  };
  deliveryConfirmationStatus?: 'pending' | 'confirmed' | 'bill_requested';
  refresh: () => Promise<void>;
}

export const useClientState = (): ClientStateData => {
  const [state, setState] = useState<ClientState>("loading");
  const [waitingPosition, setWaitingPosition] = useState<number>();
  const [waitingId, setWaitingId] = useState<string>();
  const [assignedTable, setAssignedTable] = useState<{
    id: string;
    number: number;
  }>();
  const [occupiedTable, setOccupiedTable] = useState<{
    id: string;
    number: number;
    id_waiter?: string;
  }>();
  const [deliveryConfirmationStatus, setDeliveryConfirmationStatus] = useState<'pending' | 'confirmed' | 'bill_requested'>();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { user } = useAuth();

  const checkClientState = useCallback(async () => {
    if (!user?.id || isRefreshing) {
      if (!user?.id) setState("error");
      return;
    }

    try {
      setIsRefreshing(true);
      setState("loading");

      // Primero verificar el estado actual
      const response = await api.get("/tables/my-status");
      const status = response.data.status;

      // Solo verificar reservas si NO está seated (optimización para evitar llamadas innecesarias)
      if (status !== "seated" && status !== "confirm_pending") {
        await ReservationsService.checkAndActivateReservation();
        
        // Re-verificar estado después de activar reserva (por si cambió)
        const updatedResponse = await api.get("/tables/my-status");
        response.data = updatedResponse.data;
      }

      // Limpiar estado anterior
      setWaitingPosition(undefined);
      setWaitingId(undefined);
      setAssignedTable(undefined);
      setOccupiedTable(undefined);
      setDeliveryConfirmationStatus(undefined);

      switch (response.data.status) {
        case "seated":
          setOccupiedTable(response.data.table);
          setDeliveryConfirmationStatus(response.data.table_status);
          setState("seated");
          break;

        case "assigned":
          setAssignedTable(response.data.table);
          setState("assigned");
          break;

        case "in_queue":
          setWaitingPosition(response.data.position);
          setWaitingId(response.data.waitingListId);
          setState("in_queue");
          break;

        case "displaced":
          setWaitingId(response.data.waitingListId);
          setState("displaced");
          break;

        case "confirm_pending":
          setWaitingId(response.data.waitingListId);
          setState("confirm_pending");
          break;

        case "not_in_queue":
        default:
          setState("not_in_queue");
          break;
      }
    } catch (error) {
      console.error("Error checking client state:", error);
      setState("error");
    } finally {
      setIsRefreshing(false);
    }
  }, [user?.id, isRefreshing]);

  useEffect(() => {
    if (user?.id) {
      checkClientState();
    }
  }, [user?.id]);

  return {
    state,
    waitingPosition,
    waitingId,
    assignedTable,
    occupiedTable,
    deliveryConfirmationStatus,
    refresh: checkClientState,
  };
};
