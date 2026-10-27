-- Riven: схема для Supabase. Выполните целиком один раз:
-- Supabase -> SQL Editor -> New query -> вставить -> Run.
-- Повторный запуск безопасен.

create table if not exists public.chats (
  id            uuid primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title         text not null default 'Новый чат',
  family_titles jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);

create table if not exists public.messages (
  chat_id    uuid   not null references public.chats (id) on delete cascade,
  id         text   not null,
  seq        bigint generated always as identity,
  parents    text[] not null default '{}',
  role       text   not null check (role in ('user', 'assistant')),
  branch     text   not null,
  text       text   not null,
  created_at timestamptz not null default now(),
  primary key (chat_id, id)
);

create index if not exists chats_user_created_idx on public.chats (user_id, created_at desc);
create index if not exists messages_chat_seq_idx  on public.messages (chat_id, seq);

-- Каждый видит и меняет только свои чаты и сообщения в них.
alter table public.chats    enable row level security;
alter table public.messages enable row level security;

drop policy if exists "chats: owner" on public.chats;
create policy "chats: owner" on public.chats
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "messages: owner" on public.messages;
create policy "messages: owner" on public.messages
  for all to authenticated
  using (exists (select 1 from public.chats c where c.id = messages.chat_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.chats c where c.id = messages.chat_id and c.user_id = auth.uid()));

grant select, insert, update, delete on public.chats    to authenticated;
grant select, insert, update, delete on public.messages to authenticated;
