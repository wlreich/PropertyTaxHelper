-- TCAD appeal statuses can be descriptive text rather than identifier-like
-- codes. Preserve bounded printable source text privately and without
-- translation; these fields are never exposed by the public projection.
alter table tcad_ingest.special_json_appeals
  drop constraint special_json_appeals_appeal_status_check,
  drop constraint special_json_appeals_appeal_type_check,
  drop constraint special_json_appeals_appealed_by_type_check;
alter table tcad_ingest.special_json_appeals
  add constraint special_json_appeals_appeal_status_check
    check(char_length(appeal_status) between 1 and 100 and appeal_status !~ '[[:cntrl:]]'),
  add constraint special_json_appeals_appeal_type_check
    check(char_length(appeal_type) between 1 and 100 and appeal_type !~ '[[:cntrl:]]'),
  add constraint special_json_appeals_appealed_by_type_check
    check(appealed_by_type is null or
      (char_length(appealed_by_type) between 1 and 100 and appealed_by_type !~ '[[:cntrl:]]'));
