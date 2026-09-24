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
