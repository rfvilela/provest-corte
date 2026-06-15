-- Tabela de histórico de OPs (Ordens de Produção)
create table if not exists ops (
  id text primary key,
  cliente text,
  op text,
  data jsonb not null,
  saved_at bigint,
  updated_at timestamptz default now()
);

-- Permite acesso público de leitura/escrita (uso interno, sem login)
alter table ops enable row level security;

create policy "Acesso público total" on ops
  for all
  using (true)
  with check (true);

-- Tabela do catálogo global de tecidos
create table if not exists catalog (
  id text primary key default 'global',
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

insert into catalog (id, data) values ('global', '[]') on conflict (id) do nothing;

alter table catalog enable row level security;

create policy "Acesso público total catalog" on catalog
  for all
  using (true)
  with check (true);
