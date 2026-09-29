-- Records retention for the activity log. The log stays append-only: the only way to remove entries is
-- purge_activity_log(before), which the nightly clean-up calls if (and only if) ANU has set a
-- retention period. It removes entries older than the date and returns how many.
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND current_setting('anu.audit_purge', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'AuditLog is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION purge_activity_log(before timestamptz) RETURNS bigint AS $$
DECLARE
  removed bigint;
BEGIN
  IF before > now() - interval '1 year' THEN
    RAISE EXCEPTION 'The activity log is kept for at least a year';
  END IF;
  PERFORM set_config('anu.audit_purge', 'on', true);
  DELETE FROM "AuditLog" WHERE "occurredAt" < before;
  GET DIAGNOSTICS removed = ROW_COUNT;
  PERFORM set_config('anu.audit_purge', 'off', true);
  RETURN removed;
END;
$$ LANGUAGE plpgsql;
