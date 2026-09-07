-- Read-only connectivity probe for the website. Does not access business data.
create function public.database_health()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select 1;
$$;

revoke execute on function public.database_health() from public, anon, authenticated;
grant execute on function public.database_health() to anon, authenticated;

comment on function public.database_health() is
  'Read-only application connectivity probe; returns 1 without reading property records.';
