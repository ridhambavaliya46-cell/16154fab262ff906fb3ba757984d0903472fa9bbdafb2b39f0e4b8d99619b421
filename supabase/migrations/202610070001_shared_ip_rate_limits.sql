begin;

-- Netlify may run many isolated function instances. Keep burst counters in
-- Postgres so requests cannot reset their budget by reaching another instance.
create table if not exists public.api_rate_limits (
  key_hash text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now()
);

create index if not exists api_rate_limits_updated_idx
  on public.api_rate_limits (updated_at);

alter table public.api_rate_limits enable row level security;

create or replace function public.consume_ip_burst_limit(
  p_key_hash text,
  p_max_requests integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if p_key_hash !~ '^[0-9a-f]{64}$'
    or p_max_requests < 1
    or p_window_seconds < 1
    or p_window_seconds > 3600 then
    raise exception 'invalid IP rate-limit parameters';
  end if;

  insert into public.api_rate_limits (key_hash, window_started_at, request_count, updated_at)
  values (p_key_hash, v_now, 1, v_now)
  on conflict (key_hash) do update set
    window_started_at = case
      when public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then v_now
      else public.api_rate_limits.window_started_at
    end,
    request_count = case
      when public.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= v_now
        then 1
      else public.api_rate_limits.request_count + 1
    end,
    updated_at = v_now
  returning public.api_rate_limits.window_started_at, public.api_rate_limits.request_count
    into v_window_started_at, v_request_count;

  return query select
    v_request_count <= p_max_requests,
    greatest(1, ceil(extract(epoch from (v_window_started_at + make_interval(secs => p_window_seconds) - v_now)))::integer);

  -- Opportunistically remove stale hashes so abandoned IPs do not accumulate
  -- forever. The indexed cleanup runs on roughly one request in one hundred.
  if random() < 0.01 then
    delete from public.api_rate_limits
      where updated_at < v_now - interval '1 day';
  end if;
end;
$$;

revoke all on table public.api_rate_limits from public, anon, authenticated;
revoke all on function public.consume_ip_burst_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_ip_burst_limit(text, integer, integer) to service_role;

notify pgrst, 'reload schema';

commit;
