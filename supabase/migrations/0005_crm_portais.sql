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
