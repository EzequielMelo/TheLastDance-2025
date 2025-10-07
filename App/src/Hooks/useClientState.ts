import { useState, useEffect } from "react";
import api from "../api/axios";
import { useAuth } from "../auth/useAuth";

export type ClientState =
  | "not_in_queue" // No está en lista de espera
  | "in_queue" // En lista de espera
  | "assigned" // Mesa asignada pero no confirmada
  | "seated" // Mesa confirmada (sentado)
  | "displaced" // Removido de mesa por staff
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
  };
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
  }>();
  const { user } = useAuth();

  const checkClientState = async () => {
    if (!user) {
      setState("error");
      return;
    }

    try {
      setState("loading");

      // Usar el nuevo endpoint que nos da el estado completo
      const response = await api.get("/tables/my-status");
      const status = response.data.status;

      // Limpiar estado anterior
      setWaitingPosition(undefined);
      setWaitingId(undefined);
      setAssignedTable(undefined);
      setOccupiedTable(undefined);

      switch (status) {
        case "seated":
          setOccupiedTable(response.data.table);
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

        case "not_in_queue":
        default:
          setState("not_in_queue");
          break;
      }
    } catch (error) {
      console.error("Error checking client state:", error);
      setState("error");
    }
  };

  useEffect(() => {
    checkClientState();
  }, [user]);

  return {
    state,
    waitingPosition,
    waitingId,
    assignedTable,
    occupiedTable,
    refresh: checkClientState,
  };
};
