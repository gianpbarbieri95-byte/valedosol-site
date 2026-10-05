-- =============================================================================
-- Vale do Sol Imóveis — instalação completa do banco
--
-- Este arquivo é a CONCATENAÇÃO das migrations de supabase/migrations/, na
-- ordem correta, para ser colado de uma vez no SQL Editor do Supabase na
-- primeira instalação. A fonte da verdade continua sendo os arquivos
-- numerados; gere este aqui de novo se eles mudarem:
--
--   node scripts/build-setup-sql.mjs
--
-- É seguro rodar mais de uma vez: tudo usa "if not exists", "on conflict do
-- nothing" ou "create or replace". Nada é apagado.
-- =============================================================================


-- =========================================================================
-- 0001_schema.sql
-- =========================================================================

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


-- =========================================================================
-- 0002_rls.sql
-- =========================================================================

-- =============================================================================
-- Vale do Sol Imóveis — Row Level Security
--
-- Princípio: o frontend nunca decide acesso. Quem decide é o banco.
-- Visitante anônimo enxerga apenas imóveis publicados e conteúdo público.
-- Leads só existem para a equipe — nem leitura nem escrita direta pelo anon.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Funções auxiliares (SECURITY DEFINER para não recair em recursão de RLS
-- ao consultar public.profiles de dentro de uma policy de public.profiles)
-- ---------------------------------------------------------------------------
create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

revoke execute on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_staff() to authenticated, anon;
grant execute on function public.is_admin() to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Ativa RLS em tudo
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.property_types  enable row level security;
alter table public.regions         enable row level security;
alter table public.properties      enable row level security;
alter table public.property_images enable row level security;
alter table public.leads           enable row level security;
alter table public.favorites       enable row level security;
alter table public.site_settings   enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
  for insert to authenticated
  with check (public.is_admin());

drop policy if exists profiles_delete_admin on public.profiles;
create policy profiles_delete_admin on public.profiles
  for delete to authenticated
  using (public.is_admin());

-- Um editor não pode se promover a admin editando o próprio perfil.
create or replace function public.profiles_guard_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Apenas administradores podem alterar o papel de um usuário.';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.profiles_guard_role();

-- ---------------------------------------------------------------------------
-- property_types — leitura pública dos ativos, escrita para a equipe
-- ---------------------------------------------------------------------------
drop policy if exists property_types_select_public on public.property_types;
create policy property_types_select_public on public.property_types
  for select to anon, authenticated
  using (active or public.is_staff());

drop policy if exists property_types_write_staff on public.property_types;
create policy property_types_write_staff on public.property_types
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- regions
-- ---------------------------------------------------------------------------
drop policy if exists regions_select_public on public.regions;
create policy regions_select_public on public.regions
  for select to anon, authenticated
  using (active or public.is_staff());

drop policy if exists regions_write_staff on public.regions;
create policy regions_write_staff on public.regions
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- properties — o visitante só vê o que está publicado e não está inativo
-- ---------------------------------------------------------------------------
drop policy if exists properties_select_public on public.properties;
create policy properties_select_public on public.properties
  for select to anon, authenticated
  using (
    (publication_state = 'published' and status <> 'inativo')
    or public.is_staff()
  );

drop policy if exists properties_insert_staff on public.properties;
create policy properties_insert_staff on public.properties
  for insert to authenticated
  with check (public.is_staff());

drop policy if exists properties_update_staff on public.properties;
create policy properties_update_staff on public.properties
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- Excluir imóvel é ação de administrador: o histórico deve ser preservado
-- por status/arquivamento, não por exclusão.
drop policy if exists properties_delete_admin on public.properties;
create policy properties_delete_admin on public.properties
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- property_images — herdam a visibilidade do imóvel
-- ---------------------------------------------------------------------------
drop policy if exists property_images_select_public on public.property_images;
create policy property_images_select_public on public.property_images
  for select to anon, authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.properties p
      where p.id = property_images.property_id
        and p.publication_state = 'published'
        and p.status <> 'inativo'
    )
  );

drop policy if exists property_images_write_staff on public.property_images;
create policy property_images_write_staff on public.property_images
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- leads — tabela sensível.
-- Nenhuma policy para anon: nem leitura, nem escrita.
-- Os formulários públicos gravam pelo servidor (service role), depois de
-- validação e rate limiting. Isso impede flood direto pela chave anônima.
-- ---------------------------------------------------------------------------
drop policy if exists leads_select_staff on public.leads;
create policy leads_select_staff on public.leads
  for select to authenticated
  using (public.is_staff());

drop policy if exists leads_update_staff on public.leads;
create policy leads_update_staff on public.leads
  for update to authenticated
  using (public.is_staff())
  with check (public.is_staff());

drop policy if exists leads_delete_admin on public.leads;
create policy leads_delete_admin on public.leads
  for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- favorites — cada usuário enxerga e altera apenas os próprios
-- ---------------------------------------------------------------------------
drop policy if exists favorites_select_own on public.favorites;
create policy favorites_select_own on public.favorites
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists favorites_insert_own on public.favorites;
create policy favorites_insert_own on public.favorites
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists favorites_delete_own on public.favorites;
create policy favorites_delete_own on public.favorites
  for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- site_settings — leitura pública apenas das chaves marcadas como públicas
-- ---------------------------------------------------------------------------
drop policy if exists site_settings_select_public on public.site_settings;
create policy site_settings_select_public on public.site_settings
  for select to anon, authenticated
  using (is_public or public.is_staff());

-- Configurações são área de administrador (editor não acessa).
drop policy if exists site_settings_write_admin on public.site_settings;
create policy site_settings_write_admin on public.site_settings
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());


-- =========================================================================
-- 0003_storage.sql
-- =========================================================================

-- =============================================================================
-- Vale do Sol Imóveis — Storage
--
-- Três buckets públicos de imagem (as fotos existem para serem vistas) e um
-- bucket PRIVADO para anexos enviados por visitantes no "Venda seu imóvel":
-- arquivo enviado por terceiro nunca vira URL pública.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-images', 'property-images', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('site-images', 'site-images', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/svg+xml']),
  ('region-images', 'region-images', true, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('lead-uploads', 'lead-uploads', false, 10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Leitura pública dos buckets de imagem
-- ---------------------------------------------------------------------------
drop policy if exists storage_public_images_read on storage.objects;
create policy storage_public_images_read on storage.objects
  for select to anon, authenticated
  using (bucket_id in ('property-images', 'site-images', 'region-images'));

-- ---------------------------------------------------------------------------
-- Escrita nos buckets de imagem: somente equipe autenticada
-- ---------------------------------------------------------------------------
drop policy if exists storage_images_insert_staff on storage.objects;
create policy storage_images_insert_staff on storage.objects
  for insert to authenticated
  with check (
    bucket_id in ('property-images', 'site-images', 'region-images')
    and public.is_staff()
  );

drop policy if exists storage_images_update_staff on storage.objects;
create policy storage_images_update_staff on storage.objects
  for update to authenticated
  using (
    bucket_id in ('property-images', 'site-images', 'region-images')
    and public.is_staff()
  )
  with check (
    bucket_id in ('property-images', 'site-images', 'region-images')
    and public.is_staff()
  );

drop policy if exists storage_images_delete_staff on storage.objects;
create policy storage_images_delete_staff on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('property-images', 'site-images', 'region-images')
    and public.is_staff()
  );

-- ---------------------------------------------------------------------------
-- lead-uploads: privado.
-- O upload do visitante acontece pelo servidor (service role), depois de
-- validar tipo e tamanho. A equipe lê; ninguém mais enxerga.
-- ---------------------------------------------------------------------------
drop policy if exists storage_lead_uploads_read_staff on storage.objects;
create policy storage_lead_uploads_read_staff on storage.objects
  for select to authenticated
  using (bucket_id = 'lead-uploads' and public.is_staff());

drop policy if exists storage_lead_uploads_delete_admin on storage.objects;
create policy storage_lead_uploads_delete_admin on storage.objects
  for delete to authenticated
  using (bucket_id = 'lead-uploads' and public.is_admin());


-- =========================================================================
-- 0004_seed.sql
-- =========================================================================

-- =============================================================================
-- Vale do Sol Imóveis — dados iniciais
--
-- Só entra aqui o que é comprovadamente real: os tipos de imóvel que a
-- imobiliária já usa no site atual e os dados de contato publicados por ela.
-- Nada de imóvel, cliente, depoimento ou número inventado.
-- Campos que ainda não conhecemos ficam vazios e aparecem no admin como
-- configuração pendente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos de imóvel (taxonomia real do site atual)
-- ---------------------------------------------------------------------------
insert into public.property_types (name, slug, sort_order) values
  ('Casa em Bairro',        'casa-bairro',         10),
  ('Casa em Condomínio',    'casa-condominio',     20),
  ('Apartamento',           'apartamento',         30),
  ('Terreno em Bairro',     'terreno-bairro',      40),
  ('Terreno em Condomínio', 'terreno-condominio',  50),
  ('Terreno Comercial',     'terreno-comercial',   60),
  ('Chácara / Sítio',       'chacara-sitio',       70),
  ('Imóvel Comercial',      'comercial',           80),
  ('Galpão Industrial',     'galpao-industrial',   90),
  ('Área Industrial',       'area-industrial',    100),
  ('Imóvel no Litoral',     'imovel-litoral',     110)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Configurações do site
-- Fonte: página /contato/ e /sobre/ do site atual da Vale do Sol.
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value, is_public) values
  ('contact', jsonb_build_object(
      'phone',            '(11) 4655-3399',
      'phone_secondary',  '(11) 99987-6642',
      'whatsapp',         '5511999876642',
      'email',            'contato@valedosolimoveis.com.br',
      'email_secondary',  'franco@valedosolimoveis.com.br',
      'address',          'Avenida Antônio Afonso de Lima, 704',
      'district',         'Centro',
      'city',             'Arujá',
      'state',            'SP',
      'zip',              '07400-560',
      -- Horário de atendimento ainda não confirmado pela imobiliária.
      'hours',            '',
      -- Coordenadas do escritório: em branco até serem confirmadas.
      -- Enquanto vazias, a página de contato não desenha mapa nenhum, em vez
      -- de marcar um ponto aproximado e mandar o cliente ao lugar errado.
      'latitude',         '',
      'longitude',        ''
    ), true),

  ('social', jsonb_build_object(
      'facebook',  'https://www.facebook.com/Vale-do-Sol-Im%C3%B3veis-e-Consultoria-731877396834804/',
      'instagram', ''
    ), true),

  ('hero', jsonb_build_object(
      'title',      'Encontre seu próximo lugar em Arujá.',
      'subtitle',   'Casas, terrenos, condomínios, chácaras e imóveis comerciais selecionados por quem conhece Arujá.',
      'image_path', ''
    ), true),

  ('about', jsonb_build_object(
      'tagline', 'Desde 1975, construindo relações, negócios e histórias no mercado imobiliário.',
      'intro', 'Fundada em 1975, na cidade de Arujá, São Paulo, a Vale do Sol Empreendimentos Imobiliários nasceu da experiência de seu fundador, Leonardo Barbieri, italiano e veterano no mercado de vendas.',
      -- E'...' permite quebras de linha: os parágrafos são separados por linha em branco.
      'history', E'Ao longo de mais de cinco décadas, a empresa acompanhou o crescimento e a transformação de Arujá e região, construindo sua trajetória com base em conhecimento do mercado, relacionamento próximo com seus clientes e experiência em diferentes segmentos imobiliários.

Hoje, a Vale do Sol é conduzida pela segunda geração da família, Maria Barbieri, advogada, e Francisco Barbieri, o Franco, engenheiro mecânico especializado em corretagem de imóveis.

A união entre tradição e conhecimento continua sendo parte essencial da nossa forma de trabalhar. Mantemos os valores que deram origem à empresa, ao mesmo tempo em que acompanhamos a evolução do mercado e as novas necessidades de quem compra, vende, investe ou busca administrar um imóvel.',
      'specialties', 'Atuamos na compra, venda e intermediação de imóveis, oferecendo conhecimento e acompanhamento em diferentes tipos de propriedades.',
      -- Um segmento por linha, no formato: Título | descrição.
      'segments', E'Terrenos e áreas | Oportunidades para construção, investimento e desenvolvimento.
Casas e imóveis residenciais | Imóveis para diferentes momentos e necessidades.
Chácaras e sítios | Propriedades para moradia, lazer ou investimento.
Galpões e áreas industriais | Espaços destinados a empresas, operações e expansão de negócios.
Condomínios fechados | Imóveis e terrenos em empreendimentos residenciais.
Administração e locação | Gestão e intermediação de imóveis para proprietários e locatários.',
      'closing', E'Mais do que intermediar imóveis, construímos relações que atravessam gerações.

São décadas conhecendo Arujá, seus bairros, suas transformações e o mercado imobiliário da região.',
      'communication', 'Procuramos utilizar as mais diversas e avançadas formas de comunicação para oferecer nossos produtos e encontrar os melhores negócios para nossos clientes, com um padrão de qualidade e excelência especial para satisfazê-los e fidelizá-los.',
      'mission', 'Com atendimento personalizado, entender o cliente e ajudá-lo a realizar seus sonhos, deixando-os felizes e satisfeitos com seu imóvel, objetivando fidelizar o cliente e até nos tornar amigos fiéis.',
      'vision', 'Promover a alegria e satisfação dos clientes, aprimorando cada vez mais o atendimento personalizado, com total suporte até o final da negociação, e, com acompanhamento pós venda.',
      'values', 'Entender o cliente, para melhor atender, através de total dedicação, respeito, valorização, honestidade, transparência, clareza e dignidade. Além de todo o suporte após a compra ou locação de um imóvel.'
    ), true),

  ('seo', jsonb_build_object(
      'title',       'Vale do Sol Imóveis — Imóveis em Arujá desde 1975',
      'description', 'Casas, terrenos, condomínios, chácaras e imóveis comerciais em Arujá e região. Tradição em Arujá desde 1975. CRECI J-14.578.'
    ), true),

  ('analytics', jsonb_build_object(
      -- Preenchidos quando a imobiliária fornecer os IDs.
      'ga_measurement_id', '',
      'gsc_verification',  ''
    ), true)
on conflict (key) do nothing;


-- =========================================================================
-- 0005_crm_portais.sql
-- =========================================================================

-- =============================================================================
-- Vale do Sol Imóveis — CRM (clientes, negócios, atividades) e portais
--
-- Migration aditiva: só cria tabelas, funções e policies novas. Nenhuma
-- tabela existente é alterada e nenhum dado é apagado. Pode ser rodada mais
-- de uma vez ("if not exists", "create or replace", "drop policy if exists").
--
-- Mesmo princípio das anteriores: quem decide acesso é a RLS. Tudo aqui é
-- dado interno da equipe — visitante anônimo não lê nem grava nada.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- clients — compradores, locatários, proprietários
-- ---------------------------------------------------------------------------
create table if not exists public.clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null check (char_length(name) between 2 and 160),
  email        text,
  phone        text,
  phone_secondary text,
  document     text,
  -- Um cliente pode ser comprador e proprietário ao mesmo tempo.
  kinds        text[] not null default '{}'::text[]
               check (kinds <@ array['comprador', 'locatario', 'proprietario', 'investidor']::text[]),
  source       text,
  notes        text,
  -- Contato do site que originou o cliente, quando houver.
  lead_id      uuid references public.leads(id) on delete set null,
  assigned_to  uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.clients is
  'Clientes do CRM. Separados de leads: lead é a mensagem que chegou pelo site; cliente é a pessoa com quem a equipe trabalha.';

drop trigger if exists clients_set_updated_at on public.clients;
create trigger clients_set_updated_at
  before update on public.clients
  for each row execute function public.set_updated_at();

create index if not exists clients_name_idx       on public.clients (lower(name));
create index if not exists clients_created_at_idx on public.clients (created_at desc);
create index if not exists clients_assigned_idx   on public.clients (assigned_to);
create index if not exists clients_lead_idx       on public.clients (lead_id);
create index if not exists clients_kinds_idx      on public.clients using gin (kinds);

-- ---------------------------------------------------------------------------
-- deals — negócios no funil
-- ---------------------------------------------------------------------------
create table if not exists public.deals (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 2 and 200),
  client_id    uuid not null references public.clients(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete set null,
  lead_id      uuid references public.leads(id) on delete set null,
  purpose      public.property_purpose not null default 'venda',
  stage        text not null default 'qualificando'
               check (stage in ('qualificando', 'conhecendo', 'agendando', 'negociando', 'ganho', 'perdido')),
  -- Ordem dentro da coluna do funil.
  position     double precision not null default 0,
  value        numeric(14,2) check (value is null or value >= 0),
  temperature  text check (temperature is null or temperature in ('fria', 'morna', 'quente')),
  lost_reason  text,
  notes        text,
  assigned_to  uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  closed_at    timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists deals_set_updated_at on public.deals;
create trigger deals_set_updated_at
  before update on public.deals
  for each row execute function public.set_updated_at();

-- closed_at acompanha o estágio: preenche ao ganhar/perder, limpa ao reabrir.
create or replace function public.deals_sync_closed_at()
returns trigger
language plpgsql
as $$
begin
  if new.stage in ('ganho', 'perdido') then
    if tg_op = 'INSERT' or old.stage is distinct from new.stage then
      new.closed_at = now();
    end if;
  else
    new.closed_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists deals_sync_closed_at on public.deals;
create trigger deals_sync_closed_at
  before insert or update on public.deals
  for each row execute function public.deals_sync_closed_at();

create index if not exists deals_stage_idx    on public.deals (stage, position);
create index if not exists deals_client_idx   on public.deals (client_id);
create index if not exists deals_property_idx on public.deals (property_id);
create index if not exists deals_assigned_idx on public.deals (assigned_to);

-- ---------------------------------------------------------------------------
-- activities — agenda da equipe (ligações, visitas, reuniões, tarefas)
-- ---------------------------------------------------------------------------
create table if not exists public.activities (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 2 and 200),
  kind         text not null default 'tarefa'
               check (kind in ('ligacao', 'whatsapp', 'email', 'visita', 'reuniao', 'tarefa')),
  starts_at    timestamptz not null,
  ends_at      timestamptz,
  all_day      boolean not null default false,
  done         boolean not null default false,
  done_at      timestamptz,
  client_id    uuid references public.clients(id) on delete cascade,
  deal_id      uuid references public.deals(id) on delete cascade,
  property_id  uuid references public.properties(id) on delete set null,
  notes        text,
  assigned_to  uuid references public.profiles(id) on delete set null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

drop trigger if exists activities_set_updated_at on public.activities;
create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

create or replace function public.activities_sync_done_at()
returns trigger
language plpgsql
as $$
begin
  if new.done and (tg_op = 'INSERT' or not old.done) then
    new.done_at = now();
  elsif not new.done then
    new.done_at = null;
  end if;
  return new;
end;
$$;

drop trigger if exists activities_sync_done_at on public.activities;
create trigger activities_sync_done_at
  before insert or update on public.activities
  for each row execute function public.activities_sync_done_at();

create index if not exists activities_starts_idx   on public.activities (starts_at);
create index if not exists activities_pending_idx  on public.activities (done, starts_at);
create index if not exists activities_client_idx   on public.activities (client_id);
create index if not exists activities_deal_idx     on public.activities (deal_id);
create index if not exists activities_assigned_idx on public.activities (assigned_to);

-- ---------------------------------------------------------------------------
-- property_owners — proprietários de cada imóvel (pode haver mais de um)
-- ---------------------------------------------------------------------------
create table if not exists public.property_owners (
  property_id  uuid not null references public.properties(id) on delete cascade,
  client_id    uuid not null references public.clients(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (property_id, client_id)
);

create index if not exists property_owners_client_idx on public.property_owners (client_id);

-- ---------------------------------------------------------------------------
-- Portais — em quais portais cada imóvel é anunciado
-- ---------------------------------------------------------------------------
create table if not exists public.portal_listings (
  property_id  uuid not null references public.properties(id) on delete cascade,
  portal       text not null check (portal in ('vrsync', 'chavesnamao')),
  -- Destaque contratado no portal (VRSync: PREMIUM; Chaves na Mão: destaque).
  highlight    boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (property_id, portal)
);

drop trigger if exists portal_listings_set_updated_at on public.portal_listings;
create trigger portal_listings_set_updated_at
  before update on public.portal_listings
  for each row execute function public.set_updated_at();

create index if not exists portal_listings_portal_idx on public.portal_listings (portal);

-- Uma linha por portal: liga/desliga o feed e guarda o segredo da URL.
create table if not exists public.portal_settings (
  portal      text primary key check (portal in ('vrsync', 'chavesnamao')),
  enabled     boolean not null default false,
  -- Parte secreta da URL do XML. Trocar o token invalida o link antigo.
  feed_token  text not null default encode(gen_random_bytes(18), 'hex'),
  -- Tipo do imóvel no portal, por property_types.id: {"<uuid>": "Residential / Home"}.
  type_map    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references public.profiles(id) on delete set null
);

comment on column public.portal_settings.feed_token is
  'Segredo da URL pública do XML. Nunca é lido pelo cliente anônimo (RLS); o feed confere pelo servidor.';

drop trigger if exists portal_settings_set_updated_at on public.portal_settings;
create trigger portal_settings_set_updated_at
  before update on public.portal_settings
  for each row execute function public.set_updated_at();

insert into public.portal_settings (portal) values ('vrsync'), ('chavesnamao')
on conflict (portal) do nothing;

-- ---------------------------------------------------------------------------
-- Equipe para atribuição (corretor responsável)
--
-- A policy de profiles só deixa o editor ver o próprio perfil. Para escolher
-- o responsável por um negócio, a equipe precisa da lista de nomes — e só
-- dela. Esta função entrega id, nome e e-mail, e apenas para quem é equipe.
-- ---------------------------------------------------------------------------
create or replace function public.staff_directory()
returns table (id uuid, name text, email text)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, coalesce(p.name, split_part(p.email, '@', 1)), p.email
  from public.profiles p
  where public.is_staff()
  order by 2;
$$;

revoke execute on function public.staff_directory() from public;
grant execute on function public.staff_directory() to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.clients          enable row level security;
alter table public.deals            enable row level security;
alter table public.activities       enable row level security;
alter table public.property_owners  enable row level security;
alter table public.portal_listings  enable row level security;
alter table public.portal_settings  enable row level security;

-- clients: equipe lê e grava; excluir é de administrador.
drop policy if exists clients_select_staff on public.clients;
create policy clients_select_staff on public.clients
  for select to authenticated using (public.is_staff());

drop policy if exists clients_insert_staff on public.clients;
create policy clients_insert_staff on public.clients
  for insert to authenticated with check (public.is_staff());

drop policy if exists clients_update_staff on public.clients;
create policy clients_update_staff on public.clients
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists clients_delete_admin on public.clients;
create policy clients_delete_admin on public.clients
  for delete to authenticated using (public.is_admin());

-- deals: idem.
drop policy if exists deals_select_staff on public.deals;
create policy deals_select_staff on public.deals
  for select to authenticated using (public.is_staff());

drop policy if exists deals_insert_staff on public.deals;
create policy deals_insert_staff on public.deals
  for insert to authenticated with check (public.is_staff());

drop policy if exists deals_update_staff on public.deals;
create policy deals_update_staff on public.deals
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists deals_delete_admin on public.deals;
create policy deals_delete_admin on public.deals
  for delete to authenticated using (public.is_admin());

-- activities: a agenda é do dia a dia de todos — a equipe inteira gerencia.
drop policy if exists activities_all_staff on public.activities;
create policy activities_all_staff on public.activities
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- property_owners e portal_listings: seguem quem edita imóvel (a equipe).
drop policy if exists property_owners_all_staff on public.property_owners;
create policy property_owners_all_staff on public.property_owners
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists portal_listings_all_staff on public.portal_listings;
create policy portal_listings_all_staff on public.portal_listings
  for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- portal_settings: a equipe vê os links; só administrador liga, desliga,
-- troca o token ou muda o mapeamento de tipos.
drop policy if exists portal_settings_select_staff on public.portal_settings;
create policy portal_settings_select_staff on public.portal_settings
  for select to authenticated using (public.is_staff());

drop policy if exists portal_settings_write_admin on public.portal_settings;
create policy portal_settings_write_admin on public.portal_settings
  for all to authenticated using (public.is_admin()) with check (public.is_admin());


-- =========================================================================
-- 0006_videos_salas.sql
-- =========================================================================

-- =============================================================================
-- Vale do Sol Imóveis — vídeos do imóvel, imóvel comercial (salas) e limite
-- de 35 fotos.
--
-- Pode rodar mais de uma vez: nada é apagado.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Imóvel comercial: no lugar de dormitórios, o anúncio mostra salas.
-- ---------------------------------------------------------------------------
alter table public.properties
  add column if not exists is_commercial boolean not null default false,
  add column if not exists rooms smallint check (rooms is null or rooms >= 0);

comment on column public.properties.is_commercial is
  'Imóvel comercial: o formulário e o site mostram salas (rooms) em vez de dormitórios e suítes.';
comment on column public.properties.rooms is
  'Quantidade de salas — usada nos imóveis comerciais.';

-- ---------------------------------------------------------------------------
-- property_videos — até 3 vídeos por imóvel, ao lado das fotos.
-- ---------------------------------------------------------------------------
create table if not exists public.property_videos (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  storage_path  text not null,
  sort_order    integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists property_videos_property_idx on public.property_videos (property_id, sort_order);

alter table public.property_videos enable row level security;

-- Mesma visibilidade das fotos: herdam a do imóvel.
drop policy if exists property_videos_select_public on public.property_videos;
create policy property_videos_select_public on public.property_videos
  for select to anon, authenticated
  using (
    public.is_staff()
    or exists (
      select 1 from public.properties p
      where p.id = property_videos.property_id
        and p.publication_state = 'published'
        and p.status <> 'inativo'
    )
  );

drop policy if exists property_videos_write_staff on public.property_videos;
create policy property_videos_write_staff on public.property_videos
  for all to authenticated
  using (public.is_staff())
  with check (public.is_staff());

-- ---------------------------------------------------------------------------
-- Limites no próprio banco (o painel já confere, isto é a garantia final):
-- 35 fotos e 3 vídeos por imóvel. Imóveis antigos com mais fotos continuam
-- como estão; só não recebem fotos novas.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_property_media_limit()
returns trigger
language plpgsql
as $$
declare
  current_count integer;
  max_count integer := case when tg_table_name = 'property_videos' then 3 else 35 end;
begin
  execute format('select count(*) from public.%I where property_id = $1', tg_table_name)
    into current_count
    using new.property_id;
  if current_count >= max_count then
    raise exception 'media_limit: no máximo % por imóvel', max_count;
  end if;
  return new;
end;
$$;

drop trigger if exists property_images_limit on public.property_images;
create trigger property_images_limit
  before insert on public.property_images
  for each row execute function public.enforce_property_media_limit();

drop trigger if exists property_videos_limit on public.property_videos;
create trigger property_videos_limit
  before insert on public.property_videos
  for each row execute function public.enforce_property_media_limit();

-- ---------------------------------------------------------------------------
-- Storage: bucket público de vídeos (50 MB por arquivo — teto do plano grátis
-- do Supabase; no plano pago dá para subir aqui e no limite global).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-videos', 'property-videos', true, 52428800,
    array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_property_videos_read on storage.objects;
create policy storage_property_videos_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'property-videos');

drop policy if exists storage_property_videos_insert_staff on storage.objects;
create policy storage_property_videos_insert_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-videos' and public.is_staff());

drop policy if exists storage_property_videos_update_staff on storage.objects;
create policy storage_property_videos_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'property-videos' and public.is_staff())
  with check (bucket_id = 'property-videos' and public.is_staff());

drop policy if exists storage_property_videos_delete_staff on storage.objects;
create policy storage_property_videos_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-videos' and public.is_staff());
