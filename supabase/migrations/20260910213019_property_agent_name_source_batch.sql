-- The general property index visits every record type for each property.
-- Restrict this additional access path to the two observed Property filenames.
-- Other filenames continue to use the existing indexes and publication rules.
-- This changes neither source eligibility nor the fields published to the website.
create index records_property_member_lookup
 on tcad_ingest.records(dataset_id,member_name,prop_id)
 where member_name in ('PROP.TXT','Raw_Export/PROP.TXT');
