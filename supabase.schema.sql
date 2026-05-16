create table if not exists public.signal_analyses (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  symbol text not null,
  low_interval text not null,
  high_interval text not null,
  decision text not null,
  setup_state text not null,
  setup_quality text not null,
  confidence text not null,
  price numeric not null,
  trigger_price numeric,
  invalidation_price numeric,
  btc_context text not null default 'UNKNOWN',
  analysis jsonb not null
);

create table if not exists public.alerts (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  symbol text not null,
  alert_key text not null unique,
  alert_type text not null,
  decision text not null,
  setup_state text not null,
  setup_quality text not null,
  message text not null,
  sent boolean not null default false,
  analysis jsonb not null
);

create index if not exists signal_analyses_symbol_created_at_idx
  on public.signal_analyses (symbol, created_at desc);

create index if not exists alerts_symbol_created_at_idx
  on public.alerts (symbol, created_at desc);
