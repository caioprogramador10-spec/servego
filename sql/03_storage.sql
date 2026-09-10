-- =====================================================================
-- ServeGo — Marketplace de serviços
-- Arquivo: 03_storage.sql
-- Objetivo: criar os buckets do Supabase Storage e as policies de acesso
--           sobre storage.objects.
--
-- CONVENÇÃO DE CAMINHO (obrigatória no front-end):
--     <bucket>/<auth.uid()>/<arquivo>
-- ou  <bucket>/<auth.uid()>/<subpasta>/<arquivo>
-- O primeiro segmento do path é sempre o id do usuário que enviou, o que
-- permite escrever as policies com (storage.foldername(name))[1].
-- Ex.: service-photos/4b1f.../pedido-123/foto1.jpg
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Buckets
--    file_size_limit em bytes; on conflict para permitir reexecução.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  -- Foto de perfil de clientes e profissionais
  ('avatars', 'avatars', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/gif']),

  -- Fotos do problema anexadas à solicitação de serviço
  ('service-photos', 'service-photos', true, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic']),

  -- Imagens trocadas no chat
  ('chat-images', 'chat-images', true, 10485760,
   array['image/jpeg','image/png','image/webp','image/heic']),

  -- Documentos de verificação (RG, CNH, comprovantes) — PRIVADO
  ('professional-documents', 'professional-documents', false, 15728640,
   array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2. Garantir RLS em storage.objects (padrão do Supabase, reforçado aqui)
-- ---------------------------------------------------------------------
alter table storage.objects enable row level security;

-- =====================================================================
-- 3. avatars — bucket público
-- =====================================================================
drop policy if exists "avatars_public_read"  on storage.objects;
drop policy if exists "avatars_insert_own"   on storage.objects;
drop policy if exists "avatars_update_own"   on storage.objects;
drop policy if exists "avatars_delete_own"   on storage.objects;

-- Qualquer pessoa (inclusive anônima) enxerga os avatares.
create policy "avatars_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'avatars');

-- O usuário autenticado só escreve dentro da pasta com o seu próprio uid.
create policy "avatars_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- 4. service-photos — bucket público
-- =====================================================================
drop policy if exists "service_photos_public_read" on storage.objects;
drop policy if exists "service_photos_insert_own"  on storage.objects;
drop policy if exists "service_photos_update_own"  on storage.objects;
drop policy if exists "service_photos_delete_own"  on storage.objects;

create policy "service_photos_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'service-photos');

create policy "service_photos_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'service-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "service_photos_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'service-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'service-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "service_photos_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'service-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- 5. chat-images — bucket público
--    NOTA: sendo público, a URL do arquivo é acessível por quem a possuir.
--    Se o chat precisar de sigilo real, torne o bucket privado e sirva as
--    imagens por signed URLs geradas no backend.
-- =====================================================================
drop policy if exists "chat_images_public_read" on storage.objects;
drop policy if exists "chat_images_insert_own"  on storage.objects;
drop policy if exists "chat_images_delete_own"  on storage.objects;

create policy "chat_images_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'chat-images');

create policy "chat_images_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat_images_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =====================================================================
-- 6. professional-documents — bucket PRIVADO
--    Só o profissional dono da pasta e o admin acessam.
-- =====================================================================
drop policy if exists "prof_docs_read_own"    on storage.objects;
drop policy if exists "prof_docs_read_admin"  on storage.objects;
drop policy if exists "prof_docs_insert_own"  on storage.objects;
drop policy if exists "prof_docs_update_own"  on storage.objects;
drop policy if exists "prof_docs_delete_own"  on storage.objects;
drop policy if exists "prof_docs_admin_all"   on storage.objects;

create policy "prof_docs_read_own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'professional-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admin lê para conduzir a verificação (is_admin é SECURITY DEFINER).
create policy "prof_docs_read_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'professional-documents'
    and public.is_admin()
  );

create policy "prof_docs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'professional-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "prof_docs_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'professional-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'professional-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "prof_docs_delete_own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'professional-documents'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );

-- Fim do 03_storage.sql
