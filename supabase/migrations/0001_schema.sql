-- =============================================================================
-- Vale do Sol Imóveis — esquema base
-- Migration aditiva. Não remove nem sobrescreve dados existentes.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('admin', 'editor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_purpose as enum ('venda', 'locacao');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.property_status as enum ('disponivel', 'reservado', 'vendido', 'alugado', 'inativo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.publication_state as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('novo', 'em_atendimento', 'concluido', 'arquivado');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- updated_at automático
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles — espelha auth.users e carrega o papel (role)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text,
  role        public.user_role not null default 'editor',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.profiles is
  'Usuários administrativos. O papel nunca é lido do frontend para decidir acesso: quem decide é a RLS.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- O primeiro usuário criado vira admin; os seguintes entram como editor.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first boolean;
begin
  select count(*) = 0 into is_first from public.profiles;

  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    case when is_first then 'admin'::public.user_role else 'editor'::public.user_role end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- property_types — dinâmico, o administrador pode adicionar
-- ---------------------------------------------------------------------------
create table if not exists public.property_types (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  sort_order  integer not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

drop trigger if exists property_types_set_updated_at on public.property_types;
create trigger property_types_set_updated_at
  before update on public.property_types
  for each row execute function public.set_updated_at();

create index if not exists property_types_active_idx on public.property_types (active, sort_order);

-- ---------------------------------------------------------------------------
-- regions — bairros e regiões reais, cadastrados pelo administrador
-- ---------------------------------------------------------------------------
create table if not exists public.regions (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  city            text not null default 'Arujá',
  description     text,
  image_path      text,
  sort_order      integer not null default 0,
  active          boolean not null default true,
  seo_title       text,
  seo_description text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists regions_set_updated_at on public.regions;
create trigger regions_set_updated_at
  before update on public.regions
  for each row execute function public.set_updated_at();

create index if not exists regions_active_idx on public.regions (active, sort_order);
create index if not exists regions_city_idx on public.regions (city);

-- ---------------------------------------------------------------------------
-- properties
-- ---------------------------------------------------------------------------
create table if not exists public.properties (
  id                uuid primary key default gen_random_uuid(),
  title             text not null,
  slug              text not null unique,
  code              text not null unique,
  purpose           public.property_purpose not null default 'venda',
  property_type_id  uuid references public.property_types(id) on delete restrict,
  status            public.property_status not null default 'disponivel',
  publication_state public.publication_state not null default 'draft',

  price             numeric(14,2) check (price is null or price >= 0),
  price_on_request  boolean not null default false,
  condo_fee         numeric(12,2) check (condo_fee is null or condo_fee >= 0),
  iptu              numeric(12,2) check (iptu is null or iptu >= 0),

  city              text not null default 'Arujá',
  neighborhood      text,
  address           text,
  zip_code          text,
  region_id         uuid references public.regions(id) on delete set null,
  latitude          double precision check (latitude is null or latitude between -90 and 90),
  longitude         double precision check (longitude is null or longitude between -180 and 180),

  area_total        numeric(10,2) check (area_total is null or area_total >= 0),
  area_built        numeric(10,2) check (area_built is null or area_built >= 0),
  bedrooms          smallint check (bedrooms is null or bedrooms >= 0),
  suites            smallint check (suites is null or suites >= 0),
  bathrooms         smallint check (bathrooms is null or bathrooms >= 0),
  parking_spaces    smallint check (parking_spaces is null or parking_spaces >= 0),

  description       text,
  -- Composição dos ambientes: lista de strings vinda do conteúdo oficial.
  highlights        jsonb not null default '[]'::jsonb,

  is_featured       boolean not null default false,
  is_furnished      boolean not null default false,
  in_condo          boolean not null default false,
  condo_name        text,

  seo_title         text,
  seo_description   text,

  -- Origem do registro (ex.: 'wordpress' para os imóveis migrados).
  legacy_source     text,
  legacy_id         text,

  published_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.profiles(id) on delete set null
);

comment on column public.properties.highlights is
  'Composição dos ambientes / características, como array JSON de strings.';
comment on column public.properties.publication_state is
  'Somente published aparece no site público. draft e archived ficam restritos ao admin.';

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at
  before update on public.properties
  for each row execute function public.set_updated_at();

-- published_at é preenchido automaticamente na primeira publicação
create or replace function public.properties_sync_published_at()
returns trigger
language plpgsql
as $$
begin
  if new.publication_state = 'published' and new.published_at is null then
    new.published_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists properties_sync_published_at on public.properties;
create trigger properties_sync_published_at
  before insert or update on public.properties
  for each row execute function public.properties_sync_published_at();

-- Busca textual em português (título, código, bairro, cidade, descrição)
alter table public.properties drop column if exists search_tsv;

alter table public.properties
  add column search_tsv tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(code, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(neighborhood, '') || ' ' || coalesce(city, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(condo_name, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(description, '')), 'C')
  ) stored;

create index if not exists properties_search_idx       on public.properties using gin (search_tsv);
create index if not exists properties_slug_idx         on public.properties (slug);
create index if not exists properties_code_idx         on public.properties (code);
create index if not exists properties_status_idx       on public.properties (status);
create index if not exists properties_purpose_idx      on public.properties (purpose);
create index if not exists properties_type_idx         on public.properties (property_type_id);
create index if not exists properties_region_idx       on public.properties (region_id);
create index if not exists properties_city_idx         on public.properties (city);
create index if not exists properties_neighborhood_idx on public.properties (neighborhood);
create index if not exists properties_price_idx        on public.properties (price);
create index if not exists properties_area_idx         on public.properties (area_total);
create index if not exists properties_created_at_idx   on public.properties (created_at desc);
create index if not exists properties_featured_idx     on public.properties (is_featured) where is_featured;
-- Índice que serve a listagem pública (o caminho mais quente do site)
create index if not exists properties_public_idx
  on public.properties (publication_state, status, published_at desc);

-- ---------------------------------------------------------------------------
-- property_images
-- ---------------------------------------------------------------------------
create table if not exists public.property_images (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  storage_path  text not null,
  alt_text      text,
  width         integer,
  height        integer,
  sort_order    integer not null default 0,
  is_cover      boolean not null default false,
  created_at    timestamptz not null default now()
);

create index if not exists property_images_property_idx on public.property_images (property_id, sort_order);
-- No máximo uma capa por imóvel
create unique index if not exists property_images_single_cover_idx
  on public.property_images (property_id) where is_cover;

-- ---------------------------------------------------------------------------
-- leads — caixa de entrada única de todos os formulários do site
-- ---------------------------------------------------------------------------
create table if not exists public.leads (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text,
  phone          text not null,
  message        text,
  property_id    uuid references public.properties(id) on delete set null,
  -- Preserva a referência mesmo que o imóvel saia do ar depois
  property_code  text,
  source         text not null default 'site',
  status         public.lead_status not null default 'novo',
  details        jsonb not null default '{}'::jsonb,
  attachments    jsonb not null default '[]'::jsonb,
  page_url       text,
  notes          text,
  handled_by     uuid references public.profiles(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.leads is
  'Caixa única de contatos do site (contato, interesse em imóvel, venda seu imóvel). A coluna source distingue a origem — evita duas caixas de entrada separadas para a mesma equipe.';

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

create index if not exists leads_created_at_idx on public.leads (created_at desc);
create index if not exists leads_status_idx     on public.leads (status, created_at desc);
create index if not exists leads_property_idx   on public.leads (property_id);
create index if not exists leads_source_idx     on public.leads (source);

-- ---------------------------------------------------------------------------
-- favorites — usuários autenticados
-- ---------------------------------------------------------------------------
create table if not exists public.favorites (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  property_id  uuid not null references public.properties(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (user_id, property_id)
);

create index if not exists favorites_user_idx on public.favorites (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- site_settings — conteúdo editável pelo administrador
-- ---------------------------------------------------------------------------
create table if not exists public.site_settings (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  is_public   boolean not null default true,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

comment on column public.site_settings.is_public is
  'Chaves com is_public = false nunca são lidas pelo cliente anônimo. Segredos não pertencem a esta tabela.';

drop trigger if exists site_settings_set_updated_at on public.site_settings;
create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();
