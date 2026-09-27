-- =============================================================================
-- Vale do Sol Imóveis — vídeos do imóvel
--
-- Vídeos enviados pelo painel (inclusive pelo celular) aparecem na página do
-- imóvel junto com as fotos. Mesmo desenho das fotos:
--   - arquivo no Storage, bucket público "property-videos" (o vídeo existe
--     para ser visto), com a capa (JPG gerada no aparelho) ao lado;
--   - registro em public.property_videos, que herda a visibilidade do imóvel;
--   - só a equipe envia, reordena e apaga.
--
-- Migration aditiva: só cria. Pode ser rodada mais de uma vez.
-- =============================================================================

create table if not exists public.property_videos (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references public.properties(id) on delete cascade,
  storage_path      text not null,
  -- Quadro do vídeo em JPG, gerado no navegador na hora do envio.
  poster_path       text,
  mime_type         text,
  size_bytes        bigint check (size_bytes is null or size_bytes >= 0),
  duration_seconds  numeric(8,2) check (duration_seconds is null or duration_seconds >= 0),
  width             integer check (width is null or width > 0),
  height            integer check (height is null or height > 0),
  sort_order        integer not null default 0,
  created_at        timestamptz not null default now()
);

comment on table public.property_videos is
  'Vídeos do imóvel (bucket property-videos). Visíveis ao público só quando o imóvel está publicado.';

create index if not exists property_videos_property_idx on public.property_videos (property_id, sort_order);

alter table public.property_videos enable row level security;

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
-- Storage
--
-- 500 MB por arquivo. O limite que vale é o MENOR entre este e o limite
-- global do projeto (Storage › Settings › "Upload file size limit"): no plano
-- gratuito do Supabase o global não passa de 50 MB.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('property-videos', 'property-videos', true, 524288000,
    array['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_videos_read_staff on storage.objects;
create policy storage_videos_read_staff on storage.objects
  for select to authenticated
  using (bucket_id = 'property-videos' and public.is_staff());

drop policy if exists storage_videos_insert_staff on storage.objects;
create policy storage_videos_insert_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'property-videos' and public.is_staff());

drop policy if exists storage_videos_update_staff on storage.objects;
create policy storage_videos_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'property-videos' and public.is_staff())
  with check (bucket_id = 'property-videos' and public.is_staff());

drop policy if exists storage_videos_delete_staff on storage.objects;
create policy storage_videos_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'property-videos' and public.is_staff());
