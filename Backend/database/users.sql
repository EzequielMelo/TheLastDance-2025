create table public.users (
  id uuid not null default gen_random_uuid (),
  created_at timestamp with time zone not null default now(),
  first_name text not null,
  last_name text not null,
  dni text null,
  profile_code text not null,
  position_code text null,
  profile_image text null,
  cuil text null,
  state character varying null default 'pendiente'::character varying,
  push_token text null,
  constraint users_pkey primary key (id),
  constraint users_position_code_fkey foreign KEY (position_code) references employee_positions (code) on update CASCADE,
  constraint users_profile_code_fkey foreign KEY (profile_code) references user_profiles (code) on update CASCADE,
  constraint users_employee_position_guard check (
    (
      (
        (profile_code = 'empleado'::text)
        and (position_code is not null)
      )
      or (
        (profile_code <> 'empleado'::text)
        and (position_code is null)
      )
    )
  )
) TABLESPACE pg_default;

create unique INDEX IF not exists users_dni_unique on public.users using btree (dni) TABLESPACE pg_default
where
  (dni is not null);

create index IF not exists idx_users_push_token on public.users using btree (push_token) TABLESPACE pg_default
where
  (push_token is not null);

create index IF not exists idx_users_notifications on public.users using btree (profile_code, state, push_token) TABLESPACE pg_default
where
  (
    ((state)::text = 'aprobado'::text)
    and (push_token is not null)
  );


  create table public.user_profiles (
  code text not null,
  name text not null,
  can_have_position boolean not null default false,
  constraint user_profiles_pkey primary key (code),
  constraint user_profiles_name_key unique (name)
) TABLESPACE pg_default;


create table public.employee_positions (
  code text not null,
  name text not null,
  constraint employee_positions_pkey primary key (code),
  constraint employee_positions_name_key unique (name)
) TABLESPACE pg_default;