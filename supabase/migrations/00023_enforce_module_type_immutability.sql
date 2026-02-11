-- =============================================================================
-- Migration 00023: Enforce Module Type Immutability
-- =============================================================================
-- BUG (DI-05): module_type can be changed via direct API after creation.
-- This orphans subtable data, crashes the viewer, and can bypass grade
-- integrity checks (e.g., changing quiz→video allows manual completion).
--
-- Also protects lecture_id and course_id from changes — moving a module
-- between lectures would break structural integrity.
--
-- Pattern: unconditional immutability (no role exemptions), same as
-- protect_tenant_critical_fields() in migration 00013.
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_module_immutable_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.module_type IS DISTINCT FROM OLD.module_type THEN
    RAISE EXCEPTION 'Cannot change module_type after creation';
  END IF;

  IF NEW.lecture_id IS DISTINCT FROM OLD.lecture_id THEN
    RAISE EXCEPTION 'Cannot change lecture_id after creation';
  END IF;

  IF NEW.course_id IS DISTINCT FROM OLD.course_id THEN
    RAISE EXCEPTION 'Cannot change course_id after creation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_module_immutable_fields
  BEFORE UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION enforce_module_immutable_fields();
