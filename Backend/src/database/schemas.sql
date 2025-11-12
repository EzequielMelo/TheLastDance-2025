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



create table public.waiting_list (
  id uuid not null default gen_random_uuid (),
  client_id uuid null,
  party_size integer not null,
  preferred_table_type text null,
  special_requests text null,
  status text not null default 'waiting'::text,
  priority integer null default 0,
  joined_at timestamp with time zone null default now(),
  seated_at timestamp with time zone null,
  cancelled_at timestamp with time zone null,
  updated_at timestamp with time zone null default now(),
  constraint waiting_list_pkey primary key (id),
  constraint waiting_list_party_size_check check ((party_size > 0)),
  constraint waiting_list_preferred_table_type_check check (
    (
      preferred_table_type = any (
        array['vip'::text, 'estandar'::text, 'accesible'::text]
      )
    )
  ),
  constraint waiting_list_status_check check (
    (
      status = any (
        array[
          'waiting'::text,
          'seated'::text,
          'cancelled'::text,
          'displaced'::text,
          'confirm_pending'::text,
          'completed'::text
        ]
      )
    )
  )
) TABLESPACE pg_default;



create table public.reservations (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  table_id uuid not null,
  date date not null,
  time time without time zone not null,
  party_size integer not null,
  status character varying(20) not null default 'pending'::character varying,
  notes text null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  approved_by uuid null,
  approved_at timestamp with time zone null,
  constraint reservations_pkey primary key (id),
  constraint reservations_unique_table_datetime unique (table_id, date, "time"),
  constraint reservations_user_id_fkey foreign KEY (user_id) references users (id) on delete CASCADE,
  constraint reservations_approved_by_fkey foreign KEY (approved_by) references users (id) on delete set null,
  constraint reservations_table_id_fkey foreign KEY (table_id) references tables (id) on delete CASCADE,
  constraint reservations_status_check check (
    (
      (status)::text = any (
        array[
          ('pending'::character varying)::text,
          ('approved'::character varying)::text,
          ('rejected'::character varying)::text,
          ('cancelled'::character varying)::text,
          ('completed'::character varying)::text
        ]
      )
    )
  ),
  constraint reservations_party_size_check check (
    (
      (party_size >= 1)
      and (party_size <= 12)
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_reservations_user_id on public.reservations using btree (user_id) TABLESPACE pg_default;

create index IF not exists idx_reservations_table_id on public.reservations using btree (table_id) TABLESPACE pg_default;

create index IF not exists idx_reservations_date on public.reservations using btree (date) TABLESPACE pg_default;

create index IF not exists idx_reservations_status on public.reservations using btree (status) TABLESPACE pg_default;

create index IF not exists idx_reservations_date_time on public.reservations using btree (date, "time") TABLESPACE pg_default;

create trigger trigger_update_reservations_updated_at BEFORE
update on reservations for EACH row
execute FUNCTION update_reservations_updated_at ();