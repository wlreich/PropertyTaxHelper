-- An appeal's identity establishes the positive protest observation. Status
-- and type are supporting source metadata and can be absent in TCAD's export.
alter table tcad_ingest.special_json_appeals
  alter column appeal_status drop not null,
  alter column appeal_type drop not null,
  drop constraint special_json_appeals_appeal_status_check,
  drop constraint special_json_appeals_appeal_type_check,
  drop constraint special_json_appeals_appealed_by_type_check;
alter table tcad_ingest.special_json_appeals
  add constraint special_json_appeals_appeal_status_check
    check(appeal_status is null or
      (char_length(appeal_status) between 1 and 500 and appeal_status !~ '[[:cntrl:]]')),
  add constraint special_json_appeals_appeal_type_check
    check(appeal_type is null or
      (char_length(appeal_type) between 1 and 500 and appeal_type !~ '[[:cntrl:]]')),
  add constraint special_json_appeals_appealed_by_type_check
    check(appealed_by_type is null or
      (char_length(appealed_by_type) between 1 and 500 and appealed_by_type !~ '[[:cntrl:]]'));
