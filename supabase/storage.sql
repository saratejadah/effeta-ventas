-- =========================================================
-- Permisos del bucket "productos" (fotos de los productos)
-- Pegar en: Supabase > SQL Editor > New query > Run
-- Cualquiera puede VER las fotos (el bucket es público),
-- pero solo un admin puede subirlas, cambiarlas o borrarlas.
-- =========================================================

create policy "admin sube fotos de productos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'productos' and public.es_admin());

create policy "admin cambia fotos de productos" on storage.objects
  for update to authenticated
  using (bucket_id = 'productos' and public.es_admin());

create policy "admin borra fotos de productos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'productos' and public.es_admin());
