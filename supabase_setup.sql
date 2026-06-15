-- Tabela de histórico de OPs (Ordens de Produção)
create table if not exists ops (
  id text primary key,
  cliente text,
  op text,
  data jsonb not null,
  saved_at bigint,
  updated_at timestamptz default now()
);

-- Exige login (usuário autenticado) para ler/escrever
alter table ops enable row level security;

drop policy if exists "Acesso público total" on ops;

create policy "Acesso autenticado" on ops
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Tabela do catálogo global de tecidos
create table if not exists catalog (
  id text primary key default 'global',
  data jsonb not null default '[]'::jsonb,
  updated_at timestamptz default now()
);

insert into catalog (id, data) values ('global', '[]') on conflict (id) do nothing;

alter table catalog enable row level security;

drop policy if exists "Acesso público total catalog" on catalog;

create policy "Acesso autenticado catalog" on catalog
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
