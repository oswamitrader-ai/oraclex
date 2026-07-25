insert into storage.buckets (id, name, public) values ('videos', 'videos', true) on conflict do nothing;
create policy "Public Access" on storage.objects for select using ( bucket_id = 'videos' );
create policy "Insert Access" on storage.objects for insert with check ( bucket_id = 'videos' );
