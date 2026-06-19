-- Tabella per importazione dati da Timing71
create table timing71_import (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  session_name text not null,
  data jsonb not null,
  created_at timestamptz default now()
);

-- RLS: ogni utente vede e scrive solo i suoi dati
alter table timing71_import enable row level security;

create policy "Utente legge i suoi import"
  on timing71_import for select
  using (auth.uid() = user_id);

create policy "Utente inserisce i suoi import"
  on timing71_import for insert
  with check (auth.uid() = user_id);

create policy "Utente elimina i suoi import"
  on timing71_import for delete
  using (auth.uid() = user_id);
