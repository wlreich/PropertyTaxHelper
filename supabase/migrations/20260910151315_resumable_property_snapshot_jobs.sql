-- Administrator-only progress survives client timeouts and scheduler restarts.
create table tcad_ingest.property_snapshot_jobs (
 anchor_dataset_id uuid not null references public.property_releases(dataset_id),
 dataset_id uuid not null references tcad_ingest.datasets(id),
 priority integer not null default 0,
 after_property_id text not null default '',
 processed bigint not null default 0 check(processed>=0),
 status text not null default 'queued' check(status in ('queued','running','complete','failed','paused')),
 last_result jsonb,
 error_sqlstate text,
 updated_at timestamptz not null default now(),
 primary key(anchor_dataset_id,dataset_id)
);
alter table tcad_ingest.property_snapshot_jobs enable row level security;
revoke all on tcad_ingest.property_snapshot_jobs from public,anon,authenticated,service_role,tcad_loader;

create function tcad_ingest.advance_property_snapshot_jobs(p_limit integer default 10000)
returns jsonb language plpgsql security invoker set search_path=''
set plan_cache_mode='force_generic_plan' set work_mem='32MB' as $$
declare job record; result jsonb; active_anchor uuid; next_status text;
begin
 if p_limit not between 1 and 10000 then raise exception 'Invalid batch size'; end if;
 if not pg_try_advisory_xact_lock(hashtext('property_snapshot_jobs'),0) then
  return jsonb_build_object('status','busy');
 end if;
 select * into job from tcad_ingest.property_snapshot_jobs
 where status in ('queued','running') order by priority,dataset_id
 limit 1 for update skip locked;
 if not found then
  if exists(select 1 from pg_extension where extname='pg_cron') then
   execute 'select cron.unschedule(jobid) from cron.job where jobname=$1'
    using 'parcelsavvy-property-snapshot-backfill';
  end if;
  return jsonb_build_object('status','idle');
 end if;
 select dataset_id into active_anchor from public.property_search_state where singleton;
 if active_anchor is distinct from job.anchor_dataset_id then
  update tcad_ingest.property_snapshot_jobs set status='paused',updated_at=now()
   where anchor_dataset_id=job.anchor_dataset_id and dataset_id=job.dataset_id;
  return jsonb_build_object('status','paused','reason','active_release_changed');
 end if;
 begin
  result:=tcad_ingest.publish_property_snapshots(job.dataset_id,job.after_property_id,p_limit);
  next_status:=case when (result->>'processed')::integer=0 then 'complete' else 'running' end;
  update tcad_ingest.property_snapshot_jobs set
   after_property_id=result->>'next',processed=processed+(result->>'processed')::integer,
   status=next_status,last_result=result,error_sqlstate=null,updated_at=now()
   where anchor_dataset_id=job.anchor_dataset_id and dataset_id=job.dataset_id;
  if next_status='complete' then analyze public.property_snapshot_profiles; end if;
 exception when query_canceled or others then
  -- This block rolls back the publication and its progress together.
  update tcad_ingest.property_snapshot_jobs set status='failed',error_sqlstate=SQLSTATE,updated_at=now()
   where anchor_dataset_id=job.anchor_dataset_id and dataset_id=job.dataset_id;
  return jsonb_build_object('status','failed','dataset_id',job.dataset_id,'sqlstate',SQLSTATE);
 end;
 return jsonb_build_object('status',next_status,'dataset_id',job.dataset_id,'result',result);
end $$;
revoke all on function tcad_ingest.advance_property_snapshot_jobs(integer) from public,anon,authenticated,service_role,tcad_loader;

-- Supabase provides pg_cron. Embedded test databases may not include it.
-- Scheduling remains an explicit administrator action after queue initialization.
do $$ begin
 if exists(select 1 from pg_available_extensions where name='pg_cron') then
  create extension if not exists pg_cron;
 end if;
end $$;
