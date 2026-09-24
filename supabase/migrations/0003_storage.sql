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
