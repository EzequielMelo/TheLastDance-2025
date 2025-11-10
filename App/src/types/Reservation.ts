export interface Reservation {
  id: string;
  user_id: string;
  table_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  party_size: number; // Cantidad de personas
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes?: string; // Notas adicionales del cliente
  created_at: string;
  updated_at: string;
  approved_by?: string;
  approved_at?: string;
  rejection_reason?: string;
  
  // Datos relacionados que se pueden incluir en las consultas
  user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  table?: {
    id: string;
    number: number;
    capacity: number;
    type?: string;
  };
  approved_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface CreateReservationRequest {
  table_id: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  party_size: number;
  notes?: string;
}

export interface ReservationSlot {
  time: string; // HH:MM
  available: boolean;
  table_id?: string;
  table_number?: number;
}

export interface AvailableTablesResponse {
  date: string;
  slots: ReservationSlot[];
}