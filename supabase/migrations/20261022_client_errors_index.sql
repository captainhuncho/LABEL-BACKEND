-- Admin's error list sorts private.client_errors by time and the daily
-- cleanup (cron client-errors-cleanup) deletes by time; neither had an index.
-- Carried over from Label Ops (20261021000001_lookup_indexes.sql).
create index if not exists client_errors_at on private.client_errors (at desc);
