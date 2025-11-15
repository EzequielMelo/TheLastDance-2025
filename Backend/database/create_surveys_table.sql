-- Crear tabla de encuestas
CREATE TABLE IF NOT EXISTS surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id UUID NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  waiter_id UUID, -- No tiene foreign key, se obtiene de tables.id_waiter
  -- Calificaciones (1-5 estrellas)
  food_rating INTEGER NOT NULL CHECK (food_rating >= 1 AND food_rating <= 5),
  service_rating INTEGER NOT NULL CHECK (service_rating >= 1 AND service_rating <= 5),
  restaurant_rating INTEGER NOT NULL CHECK (restaurant_rating >= 1 AND restaurant_rating <= 5),
  -- Comentario opcional
  comment TEXT,
  -- Metadatos
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_surveys_table_id ON surveys(table_id);
CREATE INDEX IF NOT EXISTS idx_surveys_client_id ON surveys(client_id);
CREATE INDEX IF NOT EXISTS idx_surveys_waiter_id ON surveys(waiter_id);
CREATE INDEX IF NOT EXISTS idx_surveys_created_at ON surveys(created_at DESC);

-- Trigger para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_surveys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_surveys_updated_at
  BEFORE UPDATE ON surveys
  FOR EACH ROW
  EXECUTE FUNCTION update_surveys_updated_at();



create table public.tables (
  id uuid not null default gen_random_uuid (),
  number integer not null,
  capacity integer not null,
  type text not null,
  photo_url text not null,
  qr_url text not null,
  created_by uuid not null,
  created_at timestamp with time zone null default now(),
  is_occupied boolean not null default false,
  id_client uuid null,
  id_waiter uuid null,
  table_status character varying(20) null default 'pending'::character varying,
  constraint tables_pkey primary key (id),
  constraint tables_number_key unique (number),
  constraint tables_capacity_check check (
    (
      (capacity >= 1)
      and (capacity <= 22)
    )
  ),
  constraint tables_table_status_check check (
    (
      (table_status)::text = any (
        array[
          ('pending'::character varying)::text,
          ('confirmed'::character varying)::text,
          ('bill_requested'::character varying)::text,
          ('payment_pending'::character varying)::text
        ]
      )
    )
  ),
  constraint tables_type_check check (
    (
      type = any (
        array['vip'::text, 'estandar'::text, 'accesible'::text]
      )
    )
  )
) TABLESPACE pg_default;

create trigger cleanup_messages_on_table_unoccupied
after
update on tables for EACH row
execute FUNCTION cleanup_table_messages ();

create trigger trigger_complete_waiting_list_on_release
after
update on tables for EACH row
execute FUNCTION complete_waiting_list_on_table_release ();

create trigger trigger_payment_pending_waiting_list
after
update OF table_status on tables for EACH row
execute FUNCTION update_waiting_list_on_payment_pending ();