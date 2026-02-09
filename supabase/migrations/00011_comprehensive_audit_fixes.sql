-- ============================================================================
-- X-Courses v2 - Migration 00011: Comprehensive Audit Fixes
-- ============================================================================
-- Addresses findings from docs/COMPREHENSIVE_AUDIT.md (19-agent audit).
-- Fixes: B1 (exam storage SELECT bug), B2 (time-limit unit mismatch),
--        G1/G2 (7 missing CSM policies), G4 (access_request notification),
--        G5 (access_requests missing columns).
-- ============================================================================


-- ============================================================================
-- FIX 1: B1 — EXAM_SUB_SELECT_OWN STORAGE POLICY PATH INDEX BUG
-- ============================================================================
-- Problem: Migration 00009 changed the exam-submissions path convention from
-- {user_id}/filename to {course_id}/{user_id}/filename. It updated
-- exam_sub_insert_own to check foldername[2] (user_id), but left
-- exam_sub_select_own checking foldername[1] (now course_id).
-- Result: Learners cannot read their own exam submissions via storage.
--
-- Fix: DROP and recreate to check foldername[2] instead of foldername[1].

DROP POLICY "exam_sub_select_own" ON storage.objects;

CREATE POLICY "exam_sub_select_own" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'exam-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );


-- ============================================================================
-- FIX 2: B2 — GRADE_QUIZ_ATTEMPT() TIME-LIMIT UNIT MISMATCH
-- ============================================================================
-- Problem: quizzes.time_limit is defined as integer -- seconds (00002:123),
-- but grade_quiz_attempt() in 00010 multiplies by interval '1 minute'.
-- A 300-second (5 min) quiz gets a 300-minute (5 hour) grading window.
--
-- Fix: Change interval '1 minute' → interval '1 second'.
-- Full CREATE OR REPLACE (identical to 00010 version, one line changed).

CREATE OR REPLACE FUNCTION grade_quiz_attempt(p_attempt_id uuid)
RETURNS jsonb AS $$
DECLARE
  _attempt record;
  _total_points numeric := 0;
  _earned_points numeric := 0;
  _question record;
  _user_answer text;
  _correct boolean;
  _score numeric;
  _passed boolean;
BEGIN
  -- Verify attempt belongs to caller and hasn't been graded yet
  SELECT qa.*, q.passing_score, q.time_limit, q.id AS quiz_id_val
  INTO _attempt
  FROM quiz_attempts qa
  JOIN quizzes q ON q.id = qa.quiz_id
  WHERE qa.id = p_attempt_id
    AND qa.user_id = auth.uid();

  IF _attempt IS NULL THEN
    RAISE EXCEPTION 'Attempt not found or does not belong to you';
  END IF;

  IF _attempt.score IS NOT NULL THEN
    RAISE EXCEPTION 'Attempt has already been graded';
  END IF;

  IF _attempt.submitted_at IS NULL THEN
    RAISE EXCEPTION 'Attempt has not been submitted yet';
  END IF;

  -- Time-limit enforcement (time_limit is in SECONDS per 00002:123)
  IF _attempt.time_limit IS NOT NULL THEN
    IF (now() - _attempt.started_at) > (_attempt.time_limit * interval '1 second') THEN
      RAISE EXCEPTION 'Quiz time limit exceeded';
    END IF;
  END IF;

  -- Grade each question
  FOR _question IN
    SELECT qq.id, qq.question_type, qq.correct_answer, qq.points
    FROM quiz_questions qq
    WHERE qq.quiz_id = _attempt.quiz_id
  LOOP
    _total_points := _total_points + _question.points;
    _correct := false;

    -- Get user's answer
    SELECT qaa.user_answer INTO _user_answer
    FROM quiz_attempt_answers qaa
    WHERE qaa.attempt_id = p_attempt_id
      AND qaa.question_id = _question.id;

    CASE _question.question_type
      WHEN 'single_choice', 'true_false' THEN
        IF _user_answer IS NOT NULL THEN
          SELECT qo.is_correct INTO _correct
          FROM quiz_question_options qo
          WHERE qo.id = _user_answer::uuid;
        END IF;

      WHEN 'multiple_choice' THEN
        IF _user_answer IS NOT NULL THEN
          _correct := (
            SELECT
              (SELECT array_agg(x ORDER BY x) FROM unnest(string_to_array(_user_answer, ',')::uuid[]) x) =
              (SELECT array_agg(qo.id ORDER BY qo.id) FROM quiz_question_options qo
               WHERE qo.question_id = _question.id AND qo.is_correct = true)
          );
        END IF;

      WHEN 'fill_blank', 'short_answer' THEN
        IF _user_answer IS NOT NULL AND _question.correct_answer IS NOT NULL THEN
          _correct := lower(trim(_user_answer)) = lower(trim(_question.correct_answer));
        END IF;

      WHEN 'matching' THEN
        IF _user_answer IS NOT NULL AND _question.correct_answer IS NOT NULL THEN
          _correct := _user_answer::jsonb = _question.correct_answer::jsonb;
        END IF;

      ELSE
        _correct := false;
    END CASE;

    IF _correct THEN
      _earned_points := _earned_points + _question.points;
    END IF;
  END LOOP;

  -- Calculate percentage score
  IF _total_points > 0 THEN
    _score := round((_earned_points / _total_points) * 100, 2);
  ELSE
    _score := 0;
  END IF;

  _passed := _score >= _attempt.passing_score;

  -- Update the attempt
  UPDATE quiz_attempts
  SET score = _score, passed = _passed
  WHERE id = p_attempt_id;

  RETURN jsonb_build_object(
    'score', _score,
    'passed', _passed,
    'earned_points', _earned_points,
    'total_points', _total_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- FIX 3: G1/G2 — ADD 7 MISSING CSM POLICIES
-- ============================================================================
-- Problem: CSMs cannot view quiz attempts, quiz answers, exam submissions,
-- courses, or external quiz results for their assigned tenants. CSMs also
-- cannot post comments or comment replies cross-tenant.
--
-- Pattern: All CSM policies use tenant_id = ANY(csm_tenant_ids) check,
-- consistent with existing CSM policies like progress_select_csm (00004:944).

-- --------------------------------------------------------------------------
-- 3.1 quiz_attempts_select_csm
-- Pattern: direct tenant_id check (like progress_select_csm)
-- --------------------------------------------------------------------------
CREATE POLICY "quiz_attempts_select_csm" ON quiz_attempts
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- --------------------------------------------------------------------------
-- 3.2 quiz_answers_select_csm
-- Pattern: JOIN through quiz_attempts (quiz_attempt_answers has no tenant_id)
-- --------------------------------------------------------------------------
CREATE POLICY "quiz_answers_select_csm" ON quiz_attempt_answers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM quiz_attempts qa
      WHERE qa.id = quiz_attempt_answers.attempt_id
        AND qa.tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 3.3 exam_submissions_select_csm
-- Pattern: direct tenant_id check
-- --------------------------------------------------------------------------
CREATE POLICY "exam_submissions_select_csm" ON exam_submissions
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- --------------------------------------------------------------------------
-- 3.4 courses_select_csm
-- Pattern: tenant_courses JOIN (like courses_select_tenant at 00004:113)
-- --------------------------------------------------------------------------
CREATE POLICY "courses_select_csm" ON courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = courses.id
        AND tc.tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 3.5 comments_insert_csm
-- Pattern: comments_insert_lecturer (00004:988) but with csm_tenant_ids
-- --------------------------------------------------------------------------
CREATE POLICY "comments_insert_csm" ON comments
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM modules m
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE m.id = comments.module_id
        AND tc.tenant_id = comments.tenant_id
        AND tc.tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 3.6 comment_replies_insert_csm
-- Pattern: comment_replies_insert_lecturer but with csm_tenant_ids
-- --------------------------------------------------------------------------
CREATE POLICY "comment_replies_insert_csm" ON comment_replies
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM comments c
      JOIN modules m ON m.id = c.module_id
      JOIN tenant_courses tc ON tc.course_id = m.course_id
      WHERE c.id = comment_replies.comment_id
        AND tc.tenant_id = comment_replies.tenant_id
        AND tc.tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
    )
  );

-- --------------------------------------------------------------------------
-- 3.7 ext_quiz_results_select_csm
-- Pattern: direct tenant_id check
-- --------------------------------------------------------------------------
CREATE POLICY "ext_quiz_results_select_csm" ON external_quiz_results
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );


-- ============================================================================
-- FIX 4: G4 — NOTIFY_ACCESS_REQUEST_REVIEWED FAILS FOR NO-PROFILE USERS
-- ============================================================================
-- Problem: The trigger (00009:1104-1153) looks up profiles WHERE email =
-- NEW.email. In the typical happy path (approve → then invite), the requester
-- has no profile yet, so _user_profile.id is NULL and the notification is
-- silently skipped. Nobody is notified.
--
-- Fix: Add fallback — when requester has no profile, notify platform admins
-- with needs_invite: true in the data payload.

CREATE OR REPLACE FUNCTION notify_access_request_reviewed()
RETURNS TRIGGER AS $$
DECLARE
  _reviewer_name text;
  _user_profile record;
  _recipient record;
  _notified_ids uuid[] := '{}';
BEGIN
  IF NEW.status != 'pending' AND OLD.status = 'pending' THEN
    SELECT full_name INTO _reviewer_name FROM profiles WHERE id = NEW.reviewed_by;

    -- Try to find a profile with this email to notify
    SELECT id, tenant_id INTO _user_profile
    FROM profiles
    WHERE email = NEW.email
    LIMIT 1;

    IF _user_profile.id IS NOT NULL THEN
      -- Requester has a profile: notify them directly
      BEGIN
        INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
        VALUES (
          _user_profile.id,
          _user_profile.tenant_id,
          'access_request_reviewed',
          CASE NEW.status
            WHEN 'approved' THEN 'Access request approved'
            WHEN 'rejected' THEN 'Access request denied'
            ELSE 'Access request updated'
          END,
          CASE NEW.status
            WHEN 'approved' THEN 'Your access request has been approved. Welcome!'
            WHEN 'rejected' THEN 'Your access request has been denied.'
            ELSE 'Your access request status has been updated.'
          END,
          jsonb_build_object(
            'request_id', NEW.id,
            'status', NEW.status
          )
        );
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'notify_access_request_reviewed (requester) failed: %', SQLERRM;
      END;
    ELSE
      -- No profile yet: notify platform admins with needs_invite flag
      FOR _recipient IN
        SELECT id AS user_id, tenant_id
        FROM profiles
        WHERE is_platform_admin = true
      LOOP
        IF NOT _recipient.user_id = ANY(_notified_ids) THEN
          BEGIN
            INSERT INTO notifications (user_id, tenant_id, type, title, body, data)
            VALUES (
              _recipient.user_id,
              _recipient.tenant_id,
              'access_request_reviewed',
              'Access request ' || NEW.status || ' — user needs invite',
              'Request from ' || NEW.email || ' was ' || NEW.status
                || ' by ' || coalesce(_reviewer_name, 'an admin')
                || '. User has no account yet.',
              jsonb_build_object(
                'request_id', NEW.id,
                'status', NEW.status,
                'email', NEW.email,
                'needs_invite', true
              )
            );
            _notified_ids := _notified_ids || _recipient.user_id;
          EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'notify_access_request_reviewed (admin fallback) failed: %', SQLERRM;
          END;
        END IF;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ============================================================================
-- FIX 5: G5 — ACCESS_REQUESTS MISSING COLUMNS
-- ============================================================================
-- Problem: Admin reviewing a request sees only an email address. No name,
-- no context for the review decision.
--
-- Add full_name (requester provides on form) and review_notes (admin writes
-- when approving/rejecting). Both nullable for backward compatibility.
-- Existing access_requests_insert_anon policy does not restrict columns.

ALTER TABLE access_requests
  ADD COLUMN full_name text,
  ADD COLUMN review_notes text;

COMMENT ON COLUMN access_requests.full_name IS 'Name provided by the requester on the access request form';
COMMENT ON COLUMN access_requests.review_notes IS 'Notes from the reviewer when approving or rejecting the request';
