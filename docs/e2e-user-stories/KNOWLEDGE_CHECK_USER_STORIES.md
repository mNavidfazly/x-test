> **E2E Testing Rules:** Write the result of each test story back into this file immediately after completing it — do not batch results. Mark each story with its pass/fail result and any bugs found, inline, as you go.

# X-Courses v2 — Module Knowledge Checks E2E User Stories (Phase 12F)

## Overview

E2E testing scenarios for the "Module Knowledge Checks" feature (Phase 12F). This feature adds lightweight inline comprehension checks (1-5 questions per module) that lecturers author and learners answer directly in the module viewer. Two question types: `single_choice` and `true_false`.

**What changed:**
- **Migration 00043** — 2 new tables (`knowledge_check_questions`, `knowledge_check_responses`), `knowledge_check_questions_safe` view (strips `isCorrect` from JSONB options), `check_knowledge_answer()` SECURITY DEFINER RPC, 14 RLS policies
- **KnowledgeCheckEditorComponent** — self-loading/self-saving editor in the module form page (excluded for quiz/exam modules). Up to 5 questions, JSON import/export, type toggle, explanation field
- **KnowledgeCheckSectionComponent** — self-loading learner section in the module viewer (`@defer` on viewport). Radio options, "Check" button, immediate correct/incorrect feedback, amber explanation card, progress bar, "all done" congratulations
- **KnowledgeCheckService** — 5 methods: `loadQuestions` (safe view), `submitAnswer` (RPC), `loadMyResponses`, `loadQuestionsForEdit` (base table), `saveQuestions` (delete + reinsert)

**Why these E2E tests matter:** Unit tests mock the Supabase client entirely. These E2E tests validate the full round-trip that only works with real data:
1. **Safe view pipeline**: Editor saves `isCorrect` to base table → learner loads from `knowledge_check_questions_safe` → `isCorrect` is stripped (learner can't see correct answers)
2. **SECURITY DEFINER RPC**: `check_knowledge_answer()` reads the real base table to determine correctness, verifies enrollment, enforces UNIQUE constraint (no re-answering)
3. **Response persistence**: Answers survive page navigation — `loadMyResponses()` FK-joins back to questions, UI shows previous responses as non-interactive
4. **JSON import in real browser**: FileReader API, blob download, confirm dialog for replacement — all mocked in unit tests
5. **Template guards**: Editor hidden for quiz/exam modules, section hidden when no questions exist — verified with real route/data state

## Test Environment

| Setting | Value |
|---------|-------|
| **Frontend URL** | https://x-courses-v2.vercel.app |
| **Backend URL** | https://x-courses-v2-production.up.railway.app |
| **Supabase Project** | `ruhdnvtvoxxiodnyyqqf` (Frankfurt) |
| **Primary Test Users** | Platform Admin + Learner (see below) |
| **Tenant** | Calypso (master tenant) |

### Alternative URLs

| Environment | Frontend | Backend |
|-------------|----------|---------|
| **Production** | https://x-courses-v2.vercel.app | https://x-courses-v2-production.up.railway.app |
| **Production (Custom Domain)** | https://xcourses.x-lng.com | https://x-courses-v2-production.up.railway.app |
| **Local Dev** | http://localhost:4200 | http://localhost:8000 |

### Test Users

> Full setup instructions: [TEST_USERS.md](TEST_USERS.md)

All test users use password: `TestUser123!`

| # | Email | Role | Tenant | Used In |
|---|-------|------|--------|---------|
| 1 | `et@calypso-commodities.com` | **Platform Admin** | Calypso (master) | KC-01, KC-02 (creates knowledge checks) |
| 2 | `learner@calypso-commodities.com` | **Learner** | Calypso (master) | KC-02, KC-03, KC-04, KC-05 |

## Status Legend

| Icon | Meaning |
|------|---------|
| ✅ | Passed |
| ❌ | Failed |
| ⏳ | Not Tested |
| ⚠️ | Partial |

---

## Recommended Test Order

**IMPORTANT**: Tests should be run in this order due to data dependencies:

| Order | ID | Story | Dependencies |
|-------|-----|-------|--------------|
| 1 | KC-01 | Create Knowledge Checks in Module Editor | PA logged in, non-quiz/exam module exists |
| 2 | KC-02 | Learner Answers Questions with Feedback | KC-01 (questions must exist on a module) |
| 3 | KC-03 | Answers Persist Across Page Navigation | KC-02 (at least 1 question answered) |
| 4 | KC-04 | JSON Import Round-Trip in Editor | Independent (PA logged in) |
| 5 | KC-05 | Section Hidden When No Questions Exist | Independent (module with 0 knowledge checks) |

---

## Summary Table

| ID | Story | Actor | Status | Last Checked |
|----|-------|-------|--------|--------------|
| KC-01 | Create Knowledge Checks in Module Editor | Platform Admin | ✅ | 2026-02-17 |
| KC-02 | Learner Answers Questions with Feedback | Learner | ✅ | 2026-02-17 |
| KC-03 | Answers Persist Across Page Navigation | Learner | ✅ | 2026-02-17 |
| KC-04 | JSON Import Round-Trip in Editor | Platform Admin | ✅ | 2026-02-17 |
| KC-05 | Section Hidden When No Questions Exist | Learner | ✅ | 2026-02-17 |

---

## Preconditions (All Stories)

- All test user accounts exist and can log in (see [TEST_USERS.md](TEST_USERS.md))
- At least 1 course exists with a **non-quiz, non-exam module** (markdown, video, PDF, audio, or download type)
- Learner is enrolled in that course
- Course is assigned to the learner's tenant via `tenant_courses`

**Verify module exists for testing:**

```sql
-- Find non-quiz/exam modules on courses the learner is enrolled in
SELECT m.id AS module_id, m.title AS module_title, m.module_type, l.title AS lecture_title, c.title AS course_title
FROM modules m
JOIN lectures l ON l.id = m.lecture_id
JOIN courses c ON c.id = m.course_id
JOIN course_enrollments ce ON ce.course_id = c.id
WHERE ce.user_id = (SELECT id FROM profiles WHERE email = 'learner@calypso-commodities.com')
  AND m.module_type NOT IN ('quiz', 'exam')
ORDER BY c.title, l.sort_order, m.sort_order
LIMIT 10;
```

**Cleanup SQL** (run before testing session to start fresh):

```sql
-- Remove all knowledge check responses for the test learner
DELETE FROM knowledge_check_responses
WHERE user_id = (SELECT id FROM auth.users
  WHERE email = 'learner@calypso-commodities.com');

-- Remove all knowledge check questions on test modules (optional — KC-01 recreates them)
-- DELETE FROM knowledge_check_questions WHERE module_id = '<MODULE_ID>';
```

---

## KC-01: Create Knowledge Checks in Module Editor

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the full editor workflow: Platform Admin opens a non-quiz/exam module form, sees the "Knowledge Checks" editor section, creates 2 questions (one `single_choice`, one `true_false`) with explanations, saves, and verifies persistence by reloading the page. This validates `saveQuestions()` (delete + reinsert pattern), `loadQuestionsForEdit()` (base table read with `isCorrect`), and the editor's self-loading/self-saving behavior.

**Covers**: `KnowledgeCheckEditorComponent` (add, type toggle, option editing, correct toggle, explanation, save), `KnowledgeCheckService.saveQuestions()` + `loadQuestionsForEdit()`, module form page `@if` guard (editor visible for non-quiz/exam), base table RLS (PA INSERT/SELECT)

**Why E2E matters**: Unit tests mock the service. This validates real DB INSERT (JSONB options with `isCorrect`), real DELETE+reinsert on save, and that the editor only appears on appropriate module types.

### Preconditions
- Logged in as Platform Admin (`et@calypso-commodities.com`)
- A non-quiz/exam module exists on a course (e.g., a markdown module)

### Steps

| # | Action | Expected Result | |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin (`et@calypso-commodities.com`) | Dashboard loads | ✅ |
| 2 | Navigate to a course with modules → click "Edit" on a **markdown** module | Module form page loads with type selector, content fields | ✅ |
| 3 | Scroll down to find the "Knowledge Checks" section | Card visible with `ClipboardCheck` icon, "Knowledge Checks" heading, "Template", "Import", "Add Question" buttons | ✅ |
| 4 | Verify empty state | "No knowledge check questions yet. Add questions or import from JSON." text visible | ✅ |
| 5 | Click "Add Question" | Question form appears: `Q1` label, type selector (Single Choice), question textarea, 2 empty option inputs, explanation textarea with Lightbulb icon | ✅ |
| 6 | Enter question text: "What is the primary purpose of commodity trading?" | Text appears in the textarea | ✅ |
| 7 | Enter option 1: "Risk management and price discovery" | First option input populated | ✅ |
| 8 | Enter option 2: "Entertainment" | Second option input populated | ✅ |
| 9 | Click "Add Option" to add a third | Third empty option input appears | ✅ |
| 10 | Enter option 3: "Social networking" | Third option populated | ✅ |
| 11 | Click the radio circle next to option 1 to mark it correct | Option 1 circle turns teal with checkmark, others remain gray | ✅ |
| 12 | Enter explanation: "Commodity trading primarily serves risk management through hedging and enables price discovery in global markets." | Explanation textarea populated | ✅ |
| 13 | Click "Add Question" again | Second question form appears: `Q2` label | ✅ |
| 14 | Change Q2 type to "True / False" using the type selector dropdown | Options change to fixed "True" / "False" (not editable text inputs) | ✅ |
| 15 | Enter Q2 text: "Commodity futures contracts always require physical delivery." | Text appears | ✅ |
| 16 | Click the "False" radio circle | "False" circle turns teal with checkmark | ✅ |
| 17 | Enter Q2 explanation: "Most commodity futures are cash-settled. Physical delivery is rare." | Explanation textarea populated | ✅ |
| 18 | Verify badge shows "2" next to "Knowledge Checks" heading | Badge displays `2` | ✅ |
| 19 | Click "Save Knowledge Checks" | Button shows spinner + "Saving...", then success toast "Knowledge checks saved successfully" | ✅ |
| 20 | Reload the page (browser refresh or navigate away and back) | Module form reloads | ✅ |
| 21 | Scroll to Knowledge Checks section | Both questions are loaded from DB: Q1 with 3 options (option 1 marked correct), Q2 true/false (False marked correct) | ✅ |
| 22 | Verify explanations persisted | Both explanation textareas show the text entered in steps 12 and 17 | ✅ |

### SQL Verification
```sql
-- Verify questions saved to DB with correct JSONB options
SELECT id, question_text, question_type, options, explanation, order_index
FROM knowledge_check_questions
WHERE module_id = '<MODULE_ID>'
ORDER BY order_index;
-- Expected: 2 rows, Q1 single_choice with 3 options (first isCorrect:true), Q2 true_false with 2 options
```

### Notes / Learnings
- The editor uses a delete-then-reinsert pattern on save — all existing questions for the module are deleted, then new ones inserted. This means question UUIDs change on each save.
- The `knowledge_check_questions` base table stores `options` as JSONB: `[{text, isCorrect}, ...]`. The `isCorrect` field is only visible to users with base table access (PA, lecturer with `can_edit`).

**E2E Observations (2026-02-17):**
- Module: "This is a test" (markdown, module 3 of 11 in "Introduction to Commodity Trading"), ID: `ec82490a-7161-4e11-88fc-c4bc5ea685d7`
- Knowledge Checks section visible below module content form, above Attached Files
- Empty state: "No knowledge check questions yet. Add questions or import from JSON." — Template, Import, Add Question buttons in header
- Add Question: Q1 form with Single Choice type, 2 empty option inputs, explanation textarea with Lightbulb icon
- "Add Option" adds 3rd option input with remove buttons on all 3 (remove hidden when only 2 options)
- Correct toggle: teal circle with white Check icon on selected, gray border on unselected
- Type change to True/False: options replaced with fixed "True"/"False" text (not editable inputs)
- Badge counter updates live: "1" after first question, "2" after second
- Save: success toast "Knowledge checks saved successfully" with dismiss button
- Reload persistence: both questions, options, correct marks, and explanations all loaded from DB exactly as entered
- Export button appeared after first question was added (conditional on questions.length > 0)
- For quiz/exam modules, the editor section should NOT appear (guarded by `@if (isEditMode() && moduleId() && selectedType() !== 'quiz' && selectedType() !== 'exam')`).
- The "Save Knowledge Checks" button is disabled when validation fails (empty question text, no correct answer, empty option text for single_choice).

---

## KC-02: Learner Answers Questions with Correct/Incorrect Feedback

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the full learner answering flow: navigate to a module with knowledge checks, see the "Check Your Understanding" section, select an answer, click "Check", and see immediate correct/incorrect feedback with explanation. This is the single most critical E2E test — it validates the entire data pipeline: `knowledge_check_questions_safe` view (strips `isCorrect`), the `check_knowledge_answer()` SECURITY DEFINER RPC (reads base table, verifies enrollment, inserts response), and the feedback UI with real DB-driven correctness.

**Covers**: `KnowledgeCheckSectionComponent` (load questions, select option, submit, feedback display, progress bar), `KnowledgeCheckService.loadQuestions()` (safe view), `KnowledgeCheckService.submitAnswer()` (RPC), `check_knowledge_answer()` RPC (enrollment check, correctness evaluation, response INSERT), `knowledge_check_questions_safe` view

**Why E2E matters**: The entire security model relies on the safe view hiding `isCorrect` and the SECURITY DEFINER RPC evaluating correctness server-side. Unit tests mock both. This is the only way to verify the pipeline works end-to-end.

### Preconditions
- Knowledge check questions exist on a module (created in KC-01)
- Logged in as Learner (`learner@calypso-commodities.com`)
- Learner is enrolled in the course containing the module
- No previous responses for this learner on these questions (run cleanup SQL)

### Steps

| # | Action | Expected Result | |
|---|--------|-----------------|---|
| 1 | Log in as Learner (`learner@calypso-commodities.com`) | Dashboard loads | ✅ |
| 2 | Navigate to the module where KC-01 created knowledge checks | Module viewer page loads with module content | ✅ |
| 3 | Scroll down past the module content | "Check Your Understanding" card appears with `ClipboardCheck` icon, badge showing "2", and "0 of 2 answered" text | ✅ |
| 4 | Verify progress bar at 0% | Empty progress bar (teal track, no fill) | ✅ |
| 5 | Verify Q1 renders with radio options | Question 1 text visible, 3 radio options (text only — no indication of which is correct), number badge "1" in teal circle | ✅ |
| 6 | Verify no "Check" button visible yet | "Check" button only appears after selecting an option | ✅ |
| 7 | Select the **correct** answer for Q1 ("Risk management and price discovery") | Radio fills, option label gets teal border + teal background highlight | ✅ |
| 8 | Verify "Check" button appears | Teal "Check" button (`btn-primary btn-sm`) visible below the options | ✅ |
| 9 | Click "Check" | Brief "Checking..." state, then feedback appears | ✅ |
| 10 | Verify correct feedback for Q1 | Q1 card border turns emerald (`border-emerald-200`), number badge turns emerald, correct option shows green background with Check icon, radio buttons gone (answered state) | ✅ |
| 11 | Verify explanation shown | Amber card (`bg-amber-50 border-amber-200`) with Lightbulb icon and explanation text: "Commodity trading primarily serves risk management..." | ✅ |
| 12 | Verify progress updated to "1 of 2 answered" | Progress bar at 50%, text shows "1 of 2 answered" | ✅ |
| 13 | Select the **wrong** answer for Q2 (click "True" for "Commodity futures always require physical delivery") | Radio fills with teal highlight | ✅ |
| 14 | Click "Check" | Feedback appears | ✅ |
| 15 | Verify incorrect feedback for Q2 | Q2 card border turns rose (`border-rose-200`), number badge turns rose, selected "True" shows red background with X icon, correct "False" shows green background with Check icon | ✅ |
| 16 | Verify Q2 explanation shown | Amber card with "Most commodity futures are cash-settled. Physical delivery is rare." | ✅ |
| 17 | Verify progress shows "2 of 2 answered" + completion message | Progress bar at 100%, green completion card: "Great job! You've completed all knowledge checks for this module." with CheckCircle2 icon | ✅ |

### SQL Verification
```sql
-- Verify responses saved to DB
SELECT kcr.question_id, kcr.selected_option_index, kcr.is_correct, kcr.answered_at,
       kcq.question_text
FROM knowledge_check_responses kcr
JOIN knowledge_check_questions kcq ON kcq.id = kcr.question_id
WHERE kcr.user_id = (SELECT id FROM auth.users WHERE email = 'learner@calypso-commodities.com')
  AND kcq.module_id = '<MODULE_ID>'
ORDER BY kcr.answered_at;
-- Expected: 2 rows — Q1 is_correct=true, Q2 is_correct=false
```

### Notes / Learnings
- The `knowledge_check_questions_safe` view returns options as `[{text}, ...]` (no `isCorrect`). The learner sees option text but has no way to determine correctness client-side.
- The `check_knowledge_answer()` RPC: (1) reads base table for correct answer, (2) verifies enrollment via `course_enrollments`, (3) checks UNIQUE constraint (no re-answering), (4) INSERTs response, (5) returns `{is_correct, correct_index, explanation}`.
- If the learner is NOT enrolled, the RPC will fail (enrollment check). This is also checked by the `@if (isEnrolled())` template guard in the module viewer.
- Answered questions are non-interactive — radio buttons replaced by static result display with correct/incorrect indicators. The learner cannot re-answer.
- The `UNIQUE(question_id, user_id)` constraint prevents duplicate responses even if the RPC is called twice.

**E2E Observations (2026-02-17):**
- Module: "This is a test" (markdown, module 3 of 11 in "Introduction to Commodity Trading"), ID: `ec82490a-7161-4e11-88fc-c4bc5ea685d7`
- "Check Your Understanding" section rendered via `@defer (on viewport)` — appeared after scrolling past module content
- Initial state: ClipboardCheck icon, badge "2", "0 of 2 answered", questions with radio options, no Check buttons
- Q1 correct answer: selected "Risk management and price discovery" → Check button appeared → clicked → emerald feedback with Check icon on correct option, explanation card visible
- Q2 wrong answer: selected "True" → Check → rose feedback, X icon on "True", Check icon on "False" (correct answer), explanation card visible
- Progress counter updated in real-time: "0 of 2" → "1 of 2" → "2 of 2 answered"
- Completion card: "Great job! You've completed all knowledge checks for this module." with CheckCircle2 icon
- After answering, radio buttons replaced with static result display — no way to re-answer
- Full data pipeline verified: safe view (no isCorrect visible) → RPC (server-side correctness check) → response INSERT → feedback return

---

## KC-03: Answers Persist Across Page Navigation

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that after answering knowledge check questions, navigating away from the module and returning shows the previously submitted answers (not a blank state). This validates `loadMyResponses()` loading persisted responses from the DB and the UI correctly rendering answered vs. unanswered questions.

**Covers**: `KnowledgeCheckService.loadMyResponses()` (FK join: `knowledge_check_responses` → `knowledge_check_questions`), `KnowledgeCheckSectionComponent` (response-aware rendering: answered questions show result, unanswered show radios), response persistence in `knowledge_check_responses` table

**Why E2E matters**: Unit tests mock `loadMyResponses()` to return a pre-built Map. This validates the real FK join query with RLS filtering (users only see own responses), plus the UI correctly distinguishing answered and unanswered states with real data.

### Preconditions
- At least 1 question answered on the module (from KC-02)
- Logged in as Learner (`learner@calypso-commodities.com`)

### Steps

| # | Action | Expected Result | |
|---|--------|-----------------|---|
| 1 | Starting from the module where KC-02 was completed (both questions answered) | "Check Your Understanding" section shows "2 of 2 answered" | ✅ |
| 2 | Navigate away — click "Next" module or go to course detail | Leave the module viewer entirely | ✅ |
| 3 | Navigate back to the same module | Module viewer reloads | ✅ |
| 4 | Scroll to the "Check Your Understanding" section | Section visible with progress bar and "2 of 2 answered" | ✅ |
| 5 | Verify Q1 shows answered state (not radios) | Q1: emerald border, correct option highlighted green with Check icon, no radio buttons, explanation visible | ✅ |
| 6 | Verify Q2 shows answered state | Q2: rose border (wrong answer), "True" highlighted red with X icon, "False" highlighted green with Check icon, explanation visible | ✅ |
| 7 | Verify no "Check" buttons visible | All questions already answered — no interactive elements | ✅ |
| 8 | Verify completion message still shown | Green "Great job!" card with CheckCircle2 icon | ✅ |

### Notes / Learnings
- `loadMyResponses()` returns a `Map<questionId, KnowledgeCheckResponse>`. The component checks this map for each question to determine render mode (interactive vs. result).
- The `@if (response)` template branch shows the result view; `@else` shows the radio/selection view. This is the key conditional — if `loadMyResponses` fails or returns empty, all questions would appear unanswered (radios shown).
- RLS on `knowledge_check_responses`: learners can only SELECT their own rows (`user_id = auth.uid()`). FK join to questions requires SELECT access to `knowledge_check_questions` (via tenant_courses).
- The progress bar width and answered count are derived from `responses().size` — they reflect the real response count from DB.

**E2E Observations (2026-02-17):**
- Navigated from "This is a test" to next module "E2E Quiz Test (Updated)" (quiz module) then back
- All answered state fully restored: "2 of 2 answered", Q1 emerald with correct Check, Q2 rose with X on "True" and Check on "False"
- Both explanations visible, completion card with CheckCircle2 icon present
- No radio buttons or Check buttons — all questions in non-interactive answered state
- `loadMyResponses()` FK join correctly loaded both responses from DB with `is_correct` and `selected_option_index`

---

## KC-04: JSON Import Round-Trip in Editor

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify the JSON import workflow: download the template, import a JSON file with knowledge check questions, see them populate the editor, save to DB, then export and verify the output matches. This validates the real browser FileReader API (mocked in unit tests), the `validateKnowledgeCheckJson()` validator with real file I/O, and the confirm dialog when replacing existing questions.

**Covers**: `KnowledgeCheckEditorComponent` (onDownloadTemplate, onImportFile, onExportJson), `validateKnowledgeCheckJson()`, `ConfirmDialogService.confirm()` (replace existing), FileReader API, Blob download, `KNOWLEDGE_CHECK_JSON_TEMPLATE`

**Why E2E matters**: Unit tests mock `FileReader` and can't validate real file I/O. The import flow involves: reading a file from disk → parsing JSON → validating schema → confirm dialog (if questions exist) → populating editor state → ChangeDetectorRef.markForCheck(). This chain is uniquely testable only in a real browser.

### Preconditions
- Logged in as Platform Admin (`et@calypso-commodities.com`)
- A module that already has knowledge check questions (from KC-01) — needed to test the "Replace" confirmation dialog

### Steps

| # | Action | Expected Result | |
|---|--------|-----------------|---|
| 1 | Log in as Platform Admin, navigate to the module form from KC-01 | Module form loads with Knowledge Checks section showing 2 existing questions | ✅ |
| 2 | Click "Template" button | JSON file downloads: `knowledge-check-template.json` | ✅ |
| 3 | Verify template contains sample questions | File has `{"questions": [...]}` with at least 1 `single_choice` and 1 `true_false` example | ✅ |
| 4 | Click "Import" (the label wrapping a hidden file input) | File picker dialog opens | ✅ |
| 5 | Select the downloaded template JSON file | File is read by FileReader | ✅ |
| 6 | Verify replacement confirmation dialog | Dialog: "Replace Questions" title, "This will replace 2 existing question(s). Continue?" message, "Yes, Replace" (danger) + Cancel buttons | ✅ |
| 7 | Click "Yes, Replace" | Questions in editor replaced with template questions | ✅ |
| 8 | Verify imported questions render correctly | Template questions visible with correct text, types, options, and correct answers marked | ✅ |
| 9 | Click "Save Knowledge Checks" | Success toast "Knowledge checks saved successfully" | ✅ |
| 10 | Click "Export" button | JSON file downloads: `knowledge-checks.json` | ✅ |
| 11 | Verify exported JSON matches the imported template structure | Questions array with same text, types, options as saved | ✅ |

### Notes / Learnings
- The template JSON is a hardcoded constant (`KNOWLEDGE_CHECK_JSON_TEMPLATE`) — it's always the same content.
- The validator accepts both `camelCase` and `snake_case` keys (e.g., `questionText` and `question_text`).
- If the import file has validation errors, a rose error card appears with per-line error messages (`whitespace-pre-line`).
- The confirmation dialog only appears when existing questions are being replaced (length > 0).
- FileReader's `onload` callback runs outside Angular's zone — `ChangeDetectorRef.markForCheck()` is called explicitly.
- Template and Export both use blob downloads: `new Blob([content], {type: 'application/json'})` → `URL.createObjectURL` → programmatic `<a>` click.
- **Playwright limitation**: File picker dialogs need `browser_file_upload` tool. Download verification may need `browser_evaluate` to check blob content or observe download events.

**E2E Observations (2026-02-17):**
- Template download: `knowledge-check-template.json` — 2 questions (single_choice "What is the capital of France?" with Paris/London/Berlin + explanation, true_false "The Earth revolves around the Sun." with True correct)
- Import: file chooser opened via hidden `<input type="file">`, selected template JSON
- Confirm dialog: "Replace Questions" / "This will replace 2 existing question(s). Continue?" / Cancel + "Yes, Replace" — appeared correctly since 2 questions existed
- After replace: editor showed template questions with correct text, types, options, correct toggles, and explanation
- Save: success toast "Knowledge checks saved successfully" — delete+reinsert pattern worked
- Export: `knowledge-checks.json` downloaded — content matches template exactly (only diff: Q2 `explanation: null` vs absent in template)
- Full round-trip validated: Template → Import → Replace Confirm → Editor → Save to DB → Export from DB → JSON match

---

## KC-05: Section Hidden When No Questions Exist

| Field | Value |
|-------|-------|
| **Last Checked** | 2026-02-17 |
| **Status** | ✅ |
| **Tester** | Claude Opus 4.6 (Playwright MCP) |

**Purpose**: Verify that the "Check Your Understanding" section does NOT appear on modules that have no knowledge check questions. Also verify the editor does NOT appear on quiz/exam module types. This validates the template guards with real route/data state.

**Covers**: `KnowledgeCheckSectionComponent` `@if (!loading() && questions().length > 0)` guard, `ModuleFormPageComponent` `@if (isEditMode() && moduleId() && selectedType() !== 'quiz' && selectedType() !== 'exam')` guard

**Why E2E matters**: Simple template guard, but validates with real module data — confirms `loadQuestions()` correctly returns empty for modules without questions, and that the quiz/exam exclusion works with real route params.

### Preconditions
- Logged in as Learner (`learner@calypso-commodities.com`)
- A module exists that has NO knowledge check questions (different from the one used in KC-01/02)
- A quiz module exists on the same course

### Steps

| # | Action | Expected Result | |
|---|--------|-----------------|---|
| 1 | Log in as Learner | Dashboard loads | ✅ |
| 2 | Navigate to a module that has **no** knowledge check questions | Module viewer loads with content (video, PDF, markdown, etc.) | ✅ |
| 3 | Scroll through the entire module viewer page | No "Check Your Understanding" section visible anywhere. Notes panel and module files may be present, but NO `ClipboardCheck` icon or knowledge check card. | ✅ |
| 4 | Navigate to the module that **has** knowledge checks (from KC-01/02) | Module viewer loads | ✅ |
| 5 | Scroll down | "Check Your Understanding" section IS visible with questions | ✅ |
| 6 | **(PA only)** Log in as Platform Admin → navigate to a **quiz** module form page | Module form loads with quiz-specific fields | ✅ |
| 7 | Scroll through the entire form page | No "Knowledge Checks" editor section visible — quiz modules already have their own assessment (the quiz itself) | ✅ |
| 8 | Navigate to a **non-quiz** module form page | Module form loads | ✅ |
| 9 | Scroll to bottom | "Knowledge Checks" editor section IS visible | ✅ |

### Notes / Learnings
- The section component itself handles the "no questions" case — `@if (!loading() && questions().length > 0)` means the entire card is not rendered, not just hidden.
- For the editor, the guard is in the module form page template: `selectedType() !== 'quiz' && selectedType() !== 'exam'`. This means knowledge checks are available for all other module types: video, PDF, markdown, audio, download, external_quiz.
- The `@defer (on viewport)` wrapper on the section means it only loads when scrolled into view — so the component won't even instantiate (and make API calls) if the user never scrolls down.

**E2E Observations (2026-02-17):**
- Learner view: "Market Participants" (PDF/markdown module, no knowledge checks) — full page rendered with content, My Notes, Discussion, Ask an Expert, Report Issue — NO "Check Your Understanding" section anywhere
- Learner view: "This is a test" (markdown module, has 2 knowledge checks) — "Check Your Understanding" IS visible with 2 questions and "0 of 2 answered"
- PA view: "E2E Quiz Test (Updated)" (quiz module) — form shows Quiz Settings, Questions (Q1-Q5 with quiz-specific UI: points, question types), Save/Cancel — NO "Knowledge Checks" editor section
- PA view: "This is a test" (markdown module) — form shows markdown editor + "Knowledge Checks" editor section with 2 questions, Template/Import/Export/Add buttons
- Note: After KC-04 import, the knowledge check questions changed from the KC-01 originals to the template questions. The learner's previous responses (from KC-02) were for the old question UUIDs (now deleted), so the section shows "0 of 2 answered" — this is correct behavior since delete+reinsert generates new UUIDs.

---

## Data Setup Notes

### Creating Knowledge Check Questions via SQL (Alternative to KC-01)

If KC-01 cannot be executed (e.g., editor has issues), questions can be inserted directly:

```sql
-- Insert 2 knowledge check questions on a module
INSERT INTO knowledge_check_questions (module_id, question_text, question_type, options, explanation, order_index)
VALUES
  ('<MODULE_ID>', 'What is the primary purpose of commodity trading?', 'single_choice',
   '[{"text": "Risk management and price discovery", "isCorrect": true}, {"text": "Entertainment", "isCorrect": false}, {"text": "Social networking", "isCorrect": false}]'::jsonb,
   'Commodity trading primarily serves risk management through hedging and enables price discovery in global markets.', 0),
  ('<MODULE_ID>', 'Commodity futures contracts always require physical delivery.', 'true_false',
   '[{"text": "True", "isCorrect": false}, {"text": "False", "isCorrect": true}]'::jsonb,
   'Most commodity futures are cash-settled. Physical delivery is rare.', 1);
```

### Cleanup Between Test Runs

```sql
-- Clear responses (allows re-answering)
DELETE FROM knowledge_check_responses
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'learner@calypso-commodities.com');

-- Clear questions on a specific module (full reset)
-- DELETE FROM knowledge_check_questions WHERE module_id = '<MODULE_ID>';
```

### Verifying Test State

```sql
-- Questions on a module (editor view — includes isCorrect)
SELECT id, question_text, question_type, options, explanation, order_index
FROM knowledge_check_questions
WHERE module_id = '<MODULE_ID>'
ORDER BY order_index;

-- Learner's responses
SELECT kcr.*, kcq.question_text
FROM knowledge_check_responses kcr
JOIN knowledge_check_questions kcq ON kcq.id = kcr.question_id
WHERE kcr.user_id = (SELECT id FROM auth.users WHERE email = 'learner@calypso-commodities.com')
ORDER BY kcr.answered_at;

-- Safe view check (what learner sees — no isCorrect)
SELECT id, question_text, question_type, options, explanation
FROM knowledge_check_questions_safe
WHERE module_id = '<MODULE_ID>'
ORDER BY order_index;
```

---

## Test Execution Log

| Date | Tester | Stories Executed | Pass | Fail | Notes |
|------|--------|-----------------|------|------|-------|
| 2026-02-17 | Claude Opus 4.6 (Playwright MCP) | KC-01 to KC-05 | 5 | 0 | All stories pass. No bugs found. Full data pipeline validated. |

---

## Bugs Found During E2E Testing

| # | Story | Bug Description | Severity | Fix | Status |
|---|-------|----------------|----------|-----|--------|
| — | — | No bugs found yet | — | — | — |

---

## References

| Document | Path |
|----------|------|
| KnowledgeCheckEditorComponent | `frontend/src/app/features/courses/components/knowledge-check-editor.component.ts` |
| KnowledgeCheckEditorComponent Tests | `frontend/src/app/features/courses/components/knowledge-check-editor.component.spec.ts` |
| KnowledgeCheckSectionComponent | `frontend/src/app/features/courses/components/knowledge-check-section.component.ts` |
| KnowledgeCheckSectionComponent Tests | `frontend/src/app/features/courses/components/knowledge-check-section.component.spec.ts` |
| KnowledgeCheckService | `frontend/src/app/core/services/knowledge-check.service.ts` |
| KnowledgeCheckService Tests | `frontend/src/app/core/services/knowledge-check.service.spec.ts` |
| Knowledge Check Model | `frontend/src/app/core/models/knowledge-check.model.ts` |
| JSON Validator | `frontend/src/app/features/courses/utils/knowledge-check-json.utils.ts` |
| JSON Validator Tests | `frontend/src/app/features/courses/utils/knowledge-check-json.utils.spec.ts` |
| JSON Template | `frontend/src/app/features/courses/utils/knowledge-check-json-template.ts` |
| Mock Factory | `frontend/src/app/__mocks__/knowledge-check.mock.ts` |
| Module Viewer Page (section integration) | `frontend/src/app/features/courses/pages/module-viewer-page.component.ts` |
| Module Form Page (editor integration) | `frontend/src/app/features/courses/pages/module-form-page.component.ts` |
| Migration 00043 | `supabase/migrations/00043_knowledge_checks.sql` |
| RLS Tests | `tests/rls/knowledge-checks.test.ts` |
| Module Notes Stories (similar pattern) | `docs/e2e-user-stories/MODULE_NOTES_USER_STORIES.md` |
| Quiz Taking Stories (feedback UI pattern) | `docs/e2e-user-stories/QUIZ_TAKING_USER_STORIES.md` |
| Test Users Setup | `docs/e2e-user-stories/TEST_USERS.md` |
