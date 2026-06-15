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
