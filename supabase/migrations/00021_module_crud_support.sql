-- =============================================================================
-- Migration 00021: Module CRUD Support
-- =============================================================================
--
-- Adds a BEFORE INSERT OR UPDATE trigger on modules:
--   set_module_audit_fields: Auto-populates created_by/updated_by from auth.uid()
--
-- Does not need SECURITY DEFINER — only modifies NEW fields using auth.uid().
-- Columns created_by/updated_by exist since 00002 but had no trigger.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Auto-set created_by / updated_by from auth.uid()
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_module_audit_fields()
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

CREATE TRIGGER set_module_audit_fields
  BEFORE INSERT OR UPDATE ON modules
  FOR EACH ROW EXECUTE FUNCTION set_module_audit_fields();
