// Tipos para el sistema de mesas y lista de espera

export interface WaitingListEntry {
  id: string;
  client_id: string;
  party_size: number;
  preferred_table_type: "vip" | "estandar" | "accesible" | null;
  special_requests: string | null;
  status: "waiting" | "seated" | "cancelled" | "no_show" | "displaced" | "confirm_pending" | "completed";
  priority: number;
  joined_at: string;
  seated_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  users: {
    first_name: string;
    last_name: string;
    profile_image?: string;
    profile_code: string;
  };
  waiting_minutes?: number;
  estimated_position?: number;
}

export interface WaitingListResponse {
  waiting_list: WaitingListEntry[];
  total_waiting: number;
  average_wait_time?: number;
}

export interface TableStatus {
  id: string;
  number: number;
  capacity: number;
  type: "vip" | "estandar" | "accesible";
  is_occupied: boolean;
  client_id: string | null;
  photo_url: string;
  qr_url: string;
  created_at: string;
  client?: {
    first_name: string;
    last_name: string;
    profile_image?: string;
    profile_code: string;
  };
}

export interface TablesStatusResponse {
  tables: TableStatus[];
  occupied_count: number;
  available_count: number;
  total_capacity: number;
  occupied_capacity: number;
}

export interface AssignTableRequest {
  waiting_list_id: string;
  table_id: string;
}
