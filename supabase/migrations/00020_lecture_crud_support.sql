-- =============================================================================
-- Migration 00020: Lecture CRUD Support
-- =============================================================================
--
-- Adds a BEFORE INSERT OR UPDATE trigger on lectures:
--
-- 1. set_lecture_audit_fields: Auto-populates created_by/updated_by from
--    auth.uid() so frontend doesn't need to pass these explicitly.
--
-- Does not need SECURITY DEFINER — only modifies NEW fields using auth.uid().
-- Columns created_by/updated_by exist since 00002 but had no trigger.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auto-set created_by / updated_by from auth.uid()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_lecture_audit_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.created_by = COALESCE(NEW.created_by, auth.uid());
      NEW.updated_by = auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF auth.uid() IS NOT NULL THEN
      NEW.updated_by = auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_lecture_audit_fields
  BEFORE INSERT OR UPDATE ON lectures
  FOR EACH ROW EXECUTE FUNCTION set_lecture_audit_fields();
