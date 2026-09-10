-- Unknown publisher stage is valid for a private protest observation set.
-- Full valuation releases still require a known publisher-labelled stage.
alter table tcad_ingest.datasets drop constraint datasets_roll_stage_check;
alter table tcad_ingest.datasets add constraint datasets_roll_stage_check
  check (roll_stage in ('preliminary','certified','supplemental')
         or (roll_stage='unknown' and import_scope='protests'));
comment on column tcad_ingest.datasets.roll_stage is
  'Publisher-labelled stage; unknown is allowed only for protest observations. Never inferred from a filename, date or supplement number.';
