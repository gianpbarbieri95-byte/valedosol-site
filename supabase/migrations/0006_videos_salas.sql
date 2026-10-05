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
