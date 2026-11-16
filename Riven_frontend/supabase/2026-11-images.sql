-- Обновление базы для картинок и удаления чатов (ноябрь 2026).
-- Supabase -> SQL Editor -> New query -> вставить всё -> Run. Повторный запуск безопасен.

alter table public.messages add column if not exists images text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('images', 'images', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

drop policy if exists "images: owner read" on storage.objects;
create policy "images: owner read" on storage.objects
  for select to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images: owner upload" on storage.objects;
create policy "images: owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "images: owner delete" on storage.objects;
create policy "images: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
