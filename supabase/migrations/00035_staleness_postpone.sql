-- Migration 00035: Staleness Postpone Support
-- Adds staleness_postponed_until column to modules and replaces
-- the generic updated_at trigger with a module-specific version
-- that skips updated_at bump when only staleness_postponed_until changes.

-- 1. Add column
ALTER TABLE modules ADD COLUMN staleness_postponed_until TIMESTAMPTZ;

-- 2. Replace generic trigger with module-specific version
-- Drop the generic trigger (handle_updated_at function remains for other 10 tables)
DROP TRIGGER IF EXISTS set_updated_at ON modules;

-- Module-specific trigger: skip updated_at when ONLY staleness_postponed_until changed
CREATE OR REPLACE FUNCTION set_module_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  IF  NEW.title                     IS NOT DISTINCT FROM OLD.title
  AND NEW.description               IS NOT DISTINCT FROM OLD.description
  AND NEW.sort_order                IS NOT DISTINCT FROM OLD.sort_order
  AND NEW.significant_update_at     IS NOT DISTINCT FROM OLD.significant_update_at
  AND NEW.staleness_postponed_until IS DISTINCT FROM OLD.staleness_postponed_until
  THEN
    RETURN NEW;  -- Pure postpone: do NOT bump updated_at
  END IF;
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_module_updated_at
  BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION set_module_updated_at();

-- 3. Update audit trigger to skip updated_by for pure postpone operations
CREATE OR REPLACE FUNCTION set_module_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by = COALESCE(NEW.created_by, auth.uid());
      NEW.updated_by = auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF  NEW.title                     IS NOT DISTINCT FROM OLD.title
    AND NEW.description               IS NOT DISTINCT FROM OLD.description
    AND NEW.sort_order                IS NOT DISTINCT FROM OLD.sort_order
    AND NEW.significant_update_at     IS NOT DISTINCT FROM OLD.significant_update_at
    AND NEW.staleness_postponed_until IS DISTINCT FROM OLD.staleness_postponed_until
    THEN
      NULL;  -- Pure postpone: keep existing updated_by
    ELSE
      IF auth.uid() IS NOT NULL THEN
        NEW.updated_by = auth.uid();
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
