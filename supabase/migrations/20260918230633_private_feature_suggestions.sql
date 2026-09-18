-- Private MVP suggestion inbox. Separate from appraisal data and publication.
create schema if not exists parcel_feedback;
revoke all on schema parcel_feedback from public;
grant usage on schema parcel_feedback to anon, authenticated;
create table parcel_feedback.suggestions (
  id bigint generated always as identity primary key,
  submission_id uuid not null unique,
  category text not null check (category in ('feature', 'metric')),
  message text not null check (char_length(btrim(message)) between 10 and 2000),
  created_at timestamptz not null default now()
);
alter table parcel_feedback.suggestions enable row level security;
revoke all on parcel_feedback.suggestions from public, anon, authenticated;
grant insert (submission_id, category, message) on parcel_feedback.suggestions to anon, authenticated;
grant usage on sequence parcel_feedback.suggestions_id_seq to anon, authenticated;
create policy submit_only on parcel_feedback.suggestions for insert to anon, authenticated with check (true);

create function public.submit_feature_suggestion(p_submission_id uuid, p_category text, p_message text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  insert into parcel_feedback.suggestions(submission_id, category, message)
    values(p_submission_id, p_category, btrim(p_message));
  return true;
exception when unique_violation then
  -- A retry after a lost response must not duplicate or overwrite the original.
  return true;
end;
$$;
revoke all on function public.submit_feature_suggestion(uuid, text, text) from public;
grant execute on function public.submit_feature_suggestion(uuid, text, text) to anon, authenticated;

create function parcel_admin.suggestion_inbox(p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform parcel_admin.require_admin();
  if p_page is null or p_page < 0 or p_page > 999 then
    raise exception 'Invalid page' using errcode = '22023';
  end if;
  with batch as (
    select id, category, message, created_at from parcel_feedback.suggestions
    order by id desc limit 51 offset p_page * 50
  ), items as (select * from batch order by id desc limit 50)
  select jsonb_build_object('items', coalesce((select jsonb_agg(to_jsonb(items) order by id desc) from items), '[]'::jsonb),
    'has_more', (select count(*) > 50 from batch)) into result;
  return result;
end;
$$;
revoke all on function parcel_admin.suggestion_inbox(integer) from public, anon, authenticated;
grant execute on function parcel_admin.suggestion_inbox(integer) to authenticated;
create function public.admin_suggestions(p_page integer default 0)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select parcel_admin.suggestion_inbox(p_page);
$$;
revoke all on function public.admin_suggestions(integer) from public, anon, authenticated;
grant execute on function public.admin_suggestions(integer) to authenticated;
