-- ============================================================
-- GeoIntel Admin — esquema Supabase
-- Ejecutar en el SQL Editor del proyecto Supabase.
-- ============================================================

-- Temas / categorías temáticas
create table if not exists public.topics (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Usuarios administradores (contraseñas cifradas con bcrypt, hasheadas en el backend)
create table if not exists public.admin_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text,
  password_hash text not null,
  role          text not null default 'admin' check (role in ('admin', 'editor', 'viewer')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- Registros de inteligencia (noticias, reportes, datos recopilados)
create table if not exists public.entries (
  id            uuid primary key default gen_random_uuid(),
  topic_id      uuid references public.topics(id) on delete set null,
  title         text not null,
  summary       text,
  url           text,
  source_name   text,
  published_at  timestamptz,
  relevance     text not null default 'media' check (relevance in ('alta', 'media', 'baja')),
  created_by    uuid references public.admin_users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists entries_topic_idx on public.entries(topic_id);
create index if not exists entries_published_idx on public.entries(published_at desc);

-- Análisis / notas del panel
create table if not exists public.analyses (
  id          uuid primary key default gen_random_uuid(),
  topic_id    uuid references public.topics(id) on delete set null,
  title       text not null,
  body        text not null,
  created_by  uuid references public.admin_users(id),
  created_at  timestamptz not null default now()
);

-- updated_at automático en entries
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at
  before update on public.entries
  for each row execute function public.set_updated_at();

-- ============================================================
-- RLS: el backend usa service_role (bypassa RLS). Se bloquea
-- acceso anónimo/cliente por seguridad.
-- ============================================================
alter table public.topics      enable row level security;
alter table public.admin_users enable row level security;
alter table public.entries     enable row level security;
alter table public.analyses    enable row level security;

-- Sin políticas = denegado por defecto para anon/authenticated.
-- Solo service_role (backend) accede.

-- ============================================================
-- Datos iniciales de temas
-- ============================================================
insert into public.topics (name, description) values
  ('Política Mexicana',       'Gobierno, elecciones, instituciones y actores políticos de México'),
  ('Geopolítica Mundial',     'Relaciones internacionales, bloques, conflictos y equilibrios globales'),
  ('Economía',                'Indicadores macroeconómicos, comercio, política fiscal y monetaria'),
  ('Geoeconomía',             'Cadenas de suministro, recursos, infraestructura y competencia económica entre estados'),
  ('Finanzas',                'Mercados, banca, inversión, deuda y sistema financiero'),
  ('Geofinanzas',             'Sanciones, FMI/BM, flujos de capital, criptomonedas y finanzas Interestatales')
on conflict (name) do nothing;
