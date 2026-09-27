-- =============================================================================
-- Vale do Sol Imóveis — endurecimento de segurança para produção
--
-- 1. Só entra na equipe quem foi CONVIDADO.
--    Até aqui, handle_new_user dava papel 'editor' a todo usuário novo do
--    Supabase Auth. Com o cadastro público do Supabase ligado (o padrão do
--    projeto), qualquer pessoa com a anon key — que está no JavaScript do
--    site — podia chamar supabase.auth.signUp() e, na hora, ler contatos,
--    clientes, tokens dos XMLs e editar imóveis. Agora:
--      - o primeiro usuário do projeto continua virando admin (instalação);
--      - os seguintes só ganham perfil se o e-mail estiver em
--        public.staff_invites, e só depois de o e-mail estar confirmado.
--    Conta sem perfil não entra no painel (actions/auth.ts já encerra a
--    sessão) e não enxerga nada pela RLS (is_staff() = false).
--
-- 2. Os buckets públicos de imagem deixam de ser listáveis pelo anônimo.
--    As fotos continuam abrindo pela URL pública (/object/public/...), que
--    não passa pela RLS; o que sai é a listagem de todos os arquivos, que
--    revelava fotos de imóveis ainda em rascunho.
--
-- 3. search_path fixo nas funções de trigger (aviso do Security Advisor).
--
-- Migration aditiva: não apaga dados nem perfis existentes. Pode ser rodada
-- mais de uma vez.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- staff_invites — e-mails autorizados a entrar na equipe
-- ---------------------------------------------------------------------------
create table if not exists public.staff_invites (
  email       text primary key check (email = lower(btrim(email)) and position('@' in email) > 1),
  role        public.user_role not null default 'editor',
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null
);

comment on table public.staff_invites is
  'E-mails autorizados a virar equipe. O perfil só é criado para quem está aqui (ou para o primeiro usuário do projeto). O convite é consumido quando o perfil nasce.';

alter table public.staff_invites enable row level security;

drop policy if exists staff_invites_admin on public.staff_invites;
create policy staff_invites_admin on public.staff_invites
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

revoke all on public.staff_invites from anon;

-- ---------------------------------------------------------------------------
-- handle_new_user — perfil só para o primeiro usuário ou para convidado
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  invited public.user_role;
  normalized text := lower(btrim(coalesce(new.email, '')));
begin
  -- E-mail ainda não confirmado: nada a fazer. O trigger roda de novo quando
  -- email_confirmed_at for preenchido (convite aceito, confirmação por link).
  if new.email_confirmed_at is null or normalized = '' then
    return new;
  end if;

  if exists (select 1 from public.profiles where id = new.id) then
    return new;
  end if;

  -- Instalação: o primeiro usuário do projeto vira administrador.
  if not exists (select 1 from public.profiles) then
    insert into public.profiles (id, email, name, role)
    values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), 'admin')
    on conflict (id) do nothing;
    return new;
  end if;

  -- Depois disso, só quem foi convidado.
  delete from public.staff_invites where email = normalized returning role into invited;
  if invited is null then
    return new;
  end if;

  insert into public.profiles (id, email, name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)), invited)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row
  when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage: listagem dos buckets públicos só para a equipe
-- ---------------------------------------------------------------------------
drop policy if exists storage_public_images_read on storage.objects;
drop policy if exists storage_images_read_staff on storage.objects;
create policy storage_images_read_staff on storage.objects
  for select to authenticated
  using (
    bucket_id in ('property-images', 'site-images', 'region-images')
    and public.is_staff()
  );

-- ---------------------------------------------------------------------------
-- search_path fixo nas funções de trigger
-- ---------------------------------------------------------------------------
alter function public.set_updated_at() set search_path = public;
alter function public.properties_sync_published_at() set search_path = public;
alter function public.deals_sync_closed_at() set search_path = public;
alter function public.activities_sync_done_at() set search_path = public;
