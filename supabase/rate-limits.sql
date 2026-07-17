-- ============================================================================
-- Durable, fleet-wide rate limiting. Vercel functions are stateless, so an
-- in-memory counter resets per instance and can't bound a real flood — this
-- keeps the count in Postgres via a single atomic RPC.
--
-- Paste into the Supabase SQL editor. Idempotent. Until it's applied the app's
-- rate_limitHit() helper simply fails OPEN (allows the request), so there is no
-- ordering hazard with the deploy.
-- ============================================================================

create table if not exists api_rate_limits (
  bucket       text        not null,   -- e.g. 'contact:1.2.3.4' or 'ai-msg:<user-uuid>'
  window_start timestamptz not null,   -- floored to the window
  hits         int         not null default 0,
  primary key (bucket, window_start)
);

-- The table is reached ONLY through the SECURITY DEFINER function below, never
-- directly by a client. RLS on + no policy = deny all direct access; the definer
-- function (owned by the migration role) still reads/writes it.
alter table api_rate_limits enable row level security;

-- Count one hit against a fixed window and report whether it's within the limit.
-- Returns TRUE when the request is ALLOWED, FALSE when it should be rejected.
create or replace function rate_limit_hit(p_bucket text, p_limit int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );
  v_hits int;
begin
  insert into api_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_window, 1)
  on conflict (bucket, window_start)
    do update set hits = r.hits + 1
  returning r.hits into v_hits;

  -- Opportunistic cleanup of this bucket's expired windows — bounded and cheap.
  delete from api_rate_limits
   where bucket = p_bucket
     and window_start < v_window - make_interval(secs => p_window_seconds);

  return v_hits <= p_limit;
end;
$$;

-- The public contact form is unauthenticated, so anon must be able to call it.
grant execute on function rate_limit_hit(text, int, int) to anon, authenticated, service_role;
