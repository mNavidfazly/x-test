-- ============================================================================
-- Migration 00031: Comment Badges
-- ============================================================================
-- Adds badge_type column to comments and comment_replies tables.
-- BEFORE INSERT triggers auto-set badge_type based on the commenter's role:
--   - Platform Admin → 'calypso'
--   - CSM (has csm_tenant_assignments) → 'calypso'
--   - Lecturer on assigned course → 'expert'
--   - Everyone else → NULL
--
-- Rationale: Learners cannot query lecturer_course_assignments or
-- csm_tenant_assignments (RLS blocks). Denormalizing the badge at INSERT
-- time makes it readable by all roles without additional joins.
-- ============================================================================

-- Add badge_type column to both tables
ALTER TABLE comments ADD COLUMN badge_type text;
ALTER TABLE comment_replies ADD COLUMN badge_type text;

-- ---------------------------------------------------------------------------
-- BEFORE INSERT trigger for comments
-- Resolves course_id from module_id, then checks role hierarchy.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_comment_badge()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_course_id uuid;
BEGIN
  -- Resolve course_id from the module being commented on
  SELECT m.course_id INTO v_course_id
  FROM modules m
  WHERE m.id = NEW.module_id;

  -- Priority: PA → Calypso, CSM → Calypso, Lecturer → Expert
  IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id AND is_platform_admin) THEN
    NEW.badge_type := 'calypso';
  ELSIF EXISTS (SELECT 1 FROM csm_tenant_assignments WHERE user_id = NEW.user_id) THEN
    NEW.badge_type := 'calypso';
  ELSIF v_course_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM lecturer_course_assignments
    WHERE user_id = NEW.user_id AND course_id = v_course_id
  ) THEN
    NEW.badge_type := 'expert';
  ELSE
    NEW.badge_type := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_comment_badge_trigger
  BEFORE INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION set_comment_badge();

-- ---------------------------------------------------------------------------
-- BEFORE INSERT trigger for comment_replies
-- Resolves course_id via parent comment → module chain.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_comment_reply_badge()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_course_id uuid;
BEGIN
  -- Resolve course_id via comment → module
  SELECT m.course_id INTO v_course_id
  FROM comments c
  JOIN modules m ON m.id = c.module_id
  WHERE c.id = NEW.comment_id;

  -- Same priority: PA → Calypso, CSM → Calypso, Lecturer → Expert
  IF EXISTS (SELECT 1 FROM profiles WHERE id = NEW.user_id AND is_platform_admin) THEN
    NEW.badge_type := 'calypso';
  ELSIF EXISTS (SELECT 1 FROM csm_tenant_assignments WHERE user_id = NEW.user_id) THEN
    NEW.badge_type := 'calypso';
  ELSIF v_course_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM lecturer_course_assignments
    WHERE user_id = NEW.user_id AND course_id = v_course_id
  ) THEN
    NEW.badge_type := 'expert';
  ELSE
    NEW.badge_type := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER set_comment_reply_badge_trigger
  BEFORE INSERT ON comment_replies
  FOR EACH ROW EXECUTE FUNCTION set_comment_reply_badge();
