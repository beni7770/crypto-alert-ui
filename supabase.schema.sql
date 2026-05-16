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
  analysis jsonb not null,
  status text not null default 'OPEN',
  outcome text,
  direction text,
  entry_price numeric,
  stop_loss numeric,
  take_profit1 numeric,
  take_profit2 numeric,
  take_profit3 numeric,
  max_r numeric,
  result_r numeric,
  opened_at timestamptz,
  closed_at timestamptz,
  last_checked_at timestamptz
);

alter table if exists public.alerts
  add column if not exists status text not null default 'OPEN',
  add column if not exists outcome text,
  add column if not exists direction text,
  add column if not exists entry_price numeric,
  add column if not exists stop_loss numeric,
  add column if not exists take_profit1 numeric,
  add column if not exists take_profit2 numeric,
  add column if not exists take_profit3 numeric,
  add column if not exists max_r numeric,
  add column if not exists result_r numeric,
  add column if not exists opened_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists last_checked_at timestamptz;

update public.alerts
set status = case when alert_type = 'WATCHLIST' then 'WATCHLIST' else status end,
    outcome = case when alert_type = 'WATCHLIST' then 'WATCHLIST' else coalesce(outcome, 'OPEN') end
where outcome is null;

update public.alerts
set direction = coalesce(direction, analysis #>> '{tradePlan,direction}'),
    entry_price = coalesce(entry_price, nullif(analysis #>> '{tradePlan,entry}', '')::numeric),
    stop_loss = coalesce(stop_loss, nullif(analysis #>> '{tradePlan,stopLoss}', '')::numeric),
    take_profit1 = coalesce(take_profit1, nullif(analysis #>> '{tradePlan,takeProfit1}', '')::numeric),
    take_profit2 = coalesce(take_profit2, nullif(analysis #>> '{tradePlan,takeProfit2}', '')::numeric),
    take_profit3 = coalesce(take_profit3, nullif(analysis #>> '{tradePlan,takeProfit3}', '')::numeric),
    opened_at = coalesce(opened_at, created_at),
    max_r = coalesce(max_r, 0)
where alert_type = 'TRADE'
  and analysis ? 'tradePlan';

create index if not exists signal_analyses_symbol_created_at_idx
  on public.signal_analyses (symbol, created_at desc);

create index if not exists alerts_symbol_created_at_idx
  on public.alerts (symbol, created_at desc);

create index if not exists alerts_tracking_status_idx
  on public.alerts (alert_type, status, created_at asc);
