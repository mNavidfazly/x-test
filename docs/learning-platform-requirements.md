# Learning Platform - Requirements & Design Document

## Document Status
- **Version:** 0.1 (Draft for iteration)
- **Last Updated:** 2025-01-31
- **Status:** 🔄 In Progress

---

# 1. USER ROLES & PERMISSIONS

## 1.1 Role Structure

### ✅ DECIDED: Two-Tier Role System

**Tier 1: Tenant Roles (Available to ALL tenants)**

| Role | Description | Who Can Have It |
|------|-------------|-----------------|
| **Learner** | Takes courses, tracks progress | Everyone (implicit) |
| **Tenant Admin** | Manages users in their tenant | Any tenant |

**Tier 2: Platform Roles (Only Calypso tenant / is_master = true)**

| Role | Description | Scope |
|------|-------------|-------|
| **Platform Admin** | Super user - manages platform + can edit ANY course | All tenants, all courses |
| **CSM** | Customer Success Manager | Assigned tenants |
| **Lecturer/Expert** | Subject matter expert - can optionally edit assigned courses | Assigned courses |

---

## 1.2 Role Details

### Learner (Everyone)
Every user is implicitly a Learner. No flag needed.
- ✅ View courses assigned to their tenant
- ✅ Enroll in available courses
- ✅ Mark modules as complete (manual)
- ✅ Take quizzes and exams
- ✅ Comment and ask questions
- ✅ Report issues
- ✅ Download content (PDFs, code files)
- ❌ Cannot see other tenants' data
- ❌ Cannot see other users' progress

### Tenant Admin (Any Tenant)
- ✅ Invite users to their tenant
- ✅ Approve access requests for their tenant
- ✅ View progress of all users in their tenant
- ✅ Send reminder emails to users in their tenant
- ✅ View issues reported by their tenant
- ❌ Cannot see other tenants' data
- ✅ Also has all Learner capabilities

### Platform Admin (Calypso Only)
- ✅ Create/manage tenants
- ✅ Assign courses to tenants
- ✅ Manage CSM and Lecturer assignments
- ✅ View ALL data across ALL tenants
- ✅ Send reminder emails to any user
- ✅ Create/edit ANY course content
- ✅ View all issues
- ✅ Also has all Learner capabilities

### CSM - Customer Success Manager (Calypso Only)
- ✅ **Can be assigned to multiple tenants**
- ✅ View progress of users in assigned tenants
- ✅ Send reminder emails to users in assigned tenants
- ✅ Respond to comments in assigned tenants
- ✅ View issues reported by assigned tenants
- ❌ Cannot grade exams (that's Lecturer's job)
- ❌ Cannot edit course content
- ✅ Also has all Learner capabilities

### Lecturer / Expert (Calypso Only)
- ✅ **Assigned per-course** (max ~10 courses per person)
- ✅ **Cross-tenant visibility** for assigned courses
- ✅ **Can edit content** for assigned courses (if `can_edit = true` on assignment)
- ✅ Gets notified when learners use "Ask Expert" on their courses
- ✅ Has a Questions Board to manage incoming questions
- ✅ Can grade exams for their assigned courses
- ✅ Can respond to comments on their assigned courses
- ✅ Can see student progress on their assigned courses (across all tenants)
- ✅ Can see issues reported on their assigned courses (across all tenants)
- ✅ Also has all Learner capabilities

**Lecturer Assignment Permissions:**
```
lecturer_course_assignments
├── user_id
├── course_id
├── can_edit (boolean)   -- Can edit course content
└── can_grade (boolean)  -- Can grade exams (usually true)
```

**Example:** Dr. Chen is Lecturer for X-LNG with `can_edit = true`, so he can fix typos and add modules. Junior Dev is Lecturer for same course with `can_edit = false`, so he can only grade exams and answer questions.

---

## 1.3 Multiple Roles

### ✅ DECIDED: One person CAN have multiple roles

A Calypso employee can be Platform Admin + CSM + Lecturer all at once.

**Example Scenarios:**

| Person | Tenant | Tenant Role | Platform Roles |
|--------|--------|-------------|----------------|
| Sarah | Calypso | Tenant Admin | Platform Admin |
| Mike | Calypso | Learner | CSM (Santos, Equinor) |
| Dr. Chen | Calypso | Learner | Lecturer (X-LNG Advanced, X-LNG Basics) - can_edit = true |
| Dr. Weber | Calypso | Learner | Lecturer (X-Crude) - can_edit = true |
| Junior Dev | Calypso | Learner | Lecturer (X-LNG Basics) - can_edit = false, just grades |
| New hire | Calypso | Learner | (none yet) |
| Jane | Santos | Tenant Admin | (not possible - not master tenant) |
| Bob | Santos | Learner | (not possible - not master tenant) |

## 1.4 Role Permission Matrix

**Tenant Roles (Any Tenant)**

| Action | Learner | Tenant Admin |
|--------|---------|--------------|
| View assigned courses | ✅ | ✅ |
| Enroll in courses | ✅ | ✅ |
| Take quizzes/exams | ✅ | ✅ |
| Mark own progress | ✅ | ✅ |
| Comment on modules | ✅ | ✅ |
| Report issues | ✅ | ✅ |
| Download content | ✅ | ✅ |
| View own progress | ✅ | ✅ |
| View all tenant progress | ❌ | ✅ |
| Invite users to tenant | ❌ | ✅ |
| Approve access requests | ❌ | ✅ |
| Send reminder emails | ❌ | ✅ |
| View tenant issues | ❌ | ✅ |

**Platform Roles (Calypso Only)**

| Action | CSM | Lecturer | Platform Admin |
|--------|-----|----------|----------------|
| Create/edit ANY course | ❌ | ❌ | ✅ |
| Edit assigned courses (if can_edit=true) | ❌ | ✅ | ✅ |
| Create/edit tenants | ❌ | ❌ | ✅ |
| Assign courses to tenants | ❌ | ❌ | ✅ |
| Assign CSM/Lecturers | ❌ | ❌ | ✅ |
| View all tenant data | ❌ | ❌ | ✅ |
| View assigned tenant data | ✅ | ❌ | ✅ |
| View assigned course data (cross-tenant) | ❌ | ✅ | ✅ |
| Send reminders (assigned tenants) | ✅ | ❌ | ✅ |
| Comment on modules (with badge) | ✅ | ✅ | ✅ |
| View expert questions (assigned tenant) | ✅ | ❌ | ✅ |
| View expert questions (assigned course, cross-tenant) | ❌ | ✅ | ✅ |
| Answer expert questions (Questions Board) | ❌ | ✅ | ✅ |
| Grade exams (if can_grade=true) | ❌ | ✅ | ✅ |
| View all issues | ❌ | ❌ | ✅ |
| View assigned tenant issues | ✅ | ❌ | ✅ |
| View assigned course issues (cross-tenant) | ❌ | ✅ | ✅ |

**Note:** CSM can see expert questions from their assigned tenants (for support awareness) but only Lecturers can reply via the Questions Board.

**Note on Lecturer Cross-Tenant Access:** Lecturers can see individual student progress, comments, exam submissions, expert questions, and issues for their assigned courses - across ALL tenants. This allows them to:
- See which modules students struggle with
- Answer technical questions from any tenant's students (via Questions Board)
- Grade exams from any tenant's students
- See and respond to issue reports about their course content
- **Edit course content** (if `can_edit = true` on their assignment)
- **Comment on modules** (with 🎓 Expert badge)

This is secured via JWT `lecturer_course_ids` claim.

**Note:** All platform roles also have full Learner capabilities in the Calypso tenant.

---

# 2. MULTI-TENANCY MODEL

## 2.1 Tenant Model

### ✅ DECIDED: Calypso Is A Tenant (The Master Tenant)

Every user belongs to exactly ONE tenant. Calypso is a tenant like any other, just with a special flag.

```sql
tenants
├── id (uuid)
├── name (text)
├── is_master (boolean)  -- TRUE only for Calypso
├── domain (text)        -- Single exact match domain
├── created_at
├── updated_at
```

**Example data:**
| id | name | is_master | domain |
|----|------|-----------|--------|
| uuid-1 | Calypso | true | calypso-commodities.com |
| uuid-2 | Santos | false | santos.com |
| uuid-3 | Equinor | false | equinor.com |

**Why this matters:**
- Every user has a `tenant_id` - data model is consistent
- Calypso employees' progress, comments, quiz results all have a home
- RLS works identically for everyone
- Platform roles (Platform Admin, Content Creator, CSM, Lecturer) are only available to users where `tenant.is_master = true`

## 2.2 Course Ownership & Sharing Model

### ✅ DECIDED: Option B - Shared Content with Tenant Context

```
Course Content (shared, read-only for tenants)
    ↓
Progress/Comments/etc (tenant-scoped via tenant_id)
```
- Content is single source of truth
- All tenant-specific data references tenant_id
- RLS policies enforce strict isolation

---

## 2.3 Tenant ID Mapping - Where It Lives

### 🔴 NEEDS tenant_id (Isolated Per Tenant)

| Table | Why | Notes |
|-------|-----|-------|
| `users` | Users belong to a tenant | A user can only be in ONE tenant |
| `user_progress` | Progress is per-user-per-tenant | Core isolation requirement |
| `comments` | Comments isolated per tenant | Santos can't see Equinor comments |
| `comment_replies` | Replies follow parent comment | Inherits from comment |
| `issues` | Issue reports isolated | But Calypso can see all |
| `quiz_attempts` | Quiz results are private | Per user per tenant |
| `exam_submissions` | Exam uploads are private | Per user per tenant |
| `exam_grades` | Grades are private | Per user per tenant |
| `notifications` | User notifications | Per user per tenant |
| `notification_preferences` | User settings | Per user per tenant |
| `reminder_history` | Track sent reminders | Admin sent to user in tenant |
| `access_requests` | Pending invites | Routed to correct tenant admin |
| `course_enrollments` | Who's enrolled where | Links user+tenant to course |

### 🟢 NO tenant_id (Shared Calypso Content)

| Table | Why | Notes |
|-------|-----|-------|
| `courses` | Content shared across tenants | Calypso owns all courses |
| `lectures` | Part of course structure | Shared |
| `modules` | Part of lecture structure | Shared |
| `module_videos` | Video content | Shared via Bunny |
| `module_pdfs` | PDF documents | Shared |
| `module_markdown` | Markdown content | Shared |
| `module_files` | Downloadable files | Shared (code snippets etc) |
| `quizzes` | Quiz definitions | Shared |
| `quiz_questions` | Question bank | Shared |
| `exams` | Exam definitions | Shared |

### 🟡 SPECIAL: Linking Tables (tenant_id context)

| Table | Purpose | tenant_id? |
|-------|---------|------------|
| `tenant_courses` | Which courses available to which tenant | Yes - this IS the assignment |
| `tenant_csm_assignments` | Which CSM handles which tenant | References tenant |
| `tenant_settings` | Per-tenant config (SSO, branding?) | Yes |

### 🔵 TENANT TABLE ITSELF

| Table | Purpose |
|-------|---------|
| `tenants` | Master list of tenants (Calypso, Santos, Equinor, etc.) |

---

## 2.4 RLS Policy Strategy

Every query automatically scoped by tenant. User's JWT contains `tenant_id` claim.

```sql
-- Example: Users can only see progress in their tenant
CREATE POLICY "Users see own tenant progress" ON user_progress
  FOR SELECT USING (tenant_id = auth.jwt() ->> 'tenant_id');

-- Example: Users can only insert progress for themselves in their tenant  
CREATE POLICY "Users track own progress" ON user_progress
  FOR INSERT WITH CHECK (
    tenant_id = auth.jwt() ->> 'tenant_id' 
    AND user_id = auth.uid()
  );
```

**Special cases:**
- Platform Admin: Can bypass tenant filter (sees all)
- CSM: Can see assigned tenants only (need `csm_tenant_assignments` check)
- Content tables: No tenant filter, but need `tenant_courses` join to verify access

## 2.5 Data Isolation Requirements

### ✅ DECIDED: Calypso-Only Course Creation

Tenants **cannot** create their own courses. This is purely a "Calypso delivers courses to clients" platform.

**Implications:**
- `courses` table has NO `tenant_id` column
- All content is Calypso-owned
- Simpler permission model
- If we ever want tenant courses later, we add `owner_tenant_id` (nullable)

### Must Be Isolated Per Tenant (has tenant_id):
- ✅ User accounts and profiles
- ✅ Course progress
- ✅ Comments and discussions
- ✅ Issue reports
- ✅ Quiz/exam attempts and results
- ✅ Exam submissions
- ✅ Notifications
- ✅ Reminder history
- ✅ Course enrollments

### Shared Across Tenants (Calypso-owned, no tenant_id):
- ✅ Course structure (courses, lectures, modules)
- ✅ Video content (Bunny URLs)
- ✅ PDF documents
- ✅ Markdown content
- ✅ Downloadable files (code snippets)
- ✅ Quiz definitions and questions
- ✅ Exam templates

## 2.4 Tenant Provisioning Workflow

```
1. Calypso Platform Admin creates new tenant
   └── Tenant name, domain, settings
   
2. Assign courses to tenant
   └── Select which Calypso courses tenant can access
   
3. Assign CSM to tenant
   └── Calypso employee(s) responsible for this client
   
4. Invite Tenant Admin(s)
   └── Email invitation sent
   
5. Tenant Admin invites their users
   └── Email invitations sent
```

### ✅ DECIDED:
- **Tenant Admin course visibility:** Can see courses assigned to their tenant (nothing else)
- **User limit per tenant:** No limit

---

# 3. AUTHENTICATION & ACCESS CONTROL

## 3.1 Authentication Methods

### ✅ DECIDED: Authentication Strategy

| User Type | Auth Method | Provider |
|-----------|-------------|----------|
| Calypso employees | SSO only | Microsoft Entra ID |
| Client users | Email invite + magic link / password | Supabase Auth |

**Calypso SSO:**
- Microsoft Entra ID (formerly Azure AD)
- All Calypso employees MUST use SSO
- No password option for Calypso users

**Client Authentication:**
- Invited by email
- Can use magic link (passwordless) or set password
- ❌ No client SSO (not needed for now)

## 3.2 Access Request Flow

### ✅ DECIDED: No Self-Registration

Users CANNOT create accounts themselves. Flow:

### Unknown Email Domain (not registered tenant)
```
1. User visits platform, enters email
2. System checks: email domain not in any tenant
3. Access request created → goes to Calypso Platform Admin
4. Calypso decides:
   - Create new tenant for this company? 
   - Add to existing tenant?
   - Reject?
5. If approved → user gets invite email
```

### Known Email Domain (registered tenant)
```
1. User visits platform, enters email
2. System checks: email domain matches tenant X (e.g., @santos.com → Santos tenant)
3. Access request created → goes to Tenant Admin of Santos
4. Tenant Admin approves → user gets invite email
```

### ✅ DECIDED:
- **Domain matching:** Exact match on single domain per tenant
- **Multiple domains:** No - one domain per tenant (if company has multiple, pick primary)
- **Request timeout:** No timeout - Platform Admin cleans up manually

## 3.3 Enrollment Methods

| Method | Use Case | Who Controls |
|--------|----------|--------------|
| Invite Only | Client courses, sensitive content | Tenant Admin |
| Password Protected | Semi-open internal courses | Course creator sets password |
| Open Enrollment | Public courses within tenant | Tenant Admin enables |

### ✅ DECIDED:
- **Open Enrollment:** Yes, needed for some courses
- **Password-protected visibility:** Everyone in the tenant can see the course in the list (but need password to enroll)

**How it works:**

| Enrollment Type | Who Sees Course | Who Can Enroll |
|-----------------|-----------------|----------------|
| Invite Only | Only invited users | Only invited users |
| Password Protected | Everyone in tenant | Anyone with password |
| Open Enrollment | Everyone in tenant | Anyone (self-enroll) |

---

# 4. CONTENT STRUCTURE

## 4.1 Hierarchy

```
Course
├── Metadata (title, description, thumbnail, etc.)
├── Settings (enrollment type, assigned tenants, etc.)
├── Lectures (ordered)
│   ├── Metadata (title, description, etc.)
│   └── Modules (ordered)
│       ├── Video Module (Bunny stream)
│       ├── PDF Module (uploaded document)
│       ├── Markdown Module (rich text + downloadable files)
│       ├── Quiz Module (embedded or external link)
│       └── Exam Module (downloadable + upload + grading)
└── Timestamps (created_at, updated_at)
```

## 4.2 Module Types

### Video Module
- ✅ Video URL (Bunny CDN stream URL)
- ✅ Thumbnail (auto-generated or custom)
- ✅ Duration (for display)
- ✅ Title and description
- ❌ **NO partial progress tracking** - just "completed" or not (manual mark)
- **OPEN QUESTION:** Transcript for accessibility? (Nice to have, not MVP)

### PDF Module
- ✅ PDF file stored in **Supabase Storage**
- ✅ Title/description
- ✅ Page count
- ✅ **Allow download** (not view-only)

### Markdown Module
- ✅ Markdown content (rendered on frontend)
- ✅ Attached files for download (code snippets, etc.)
  - Stored as individual files
  - Downloadable as ZIP
- ✅ **Syntax highlighting** for code blocks
- ❌ **No embedded images** in markdown (too complex)

### ✅ DECIDED: Markdown Editor/Viewer Libraries

**Editor (Lecturers):** Tiptap
- TypeScript native
- ProseMirror-based (solid foundation)
- WYSIWYG editing
- Good extensions (code blocks, tables, etc.)
- Export to markdown for storage

**Viewer (Learners):** ngx-markdown
- Lightweight
- Prism.js for syntax highlighting
- Renders stored markdown to HTML

```typescript
// Lecturer editing
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'

const editor = new Editor({
  extensions: [StarterKit, CodeBlockLowlight],
  content: existingMarkdown
})

// Save as markdown
const markdown = editor.storage.markdown.getMarkdown()
```

### Quiz Module (Embedded)
- [ ] Question types needed:
  - [ ] Multiple choice (single answer)
  - [ ] Multiple choice (multiple answers)
  - [ ] True/False
  - [ ] Fill in the blank
  - [ ] Matching
  - [ ] Short answer (auto-graded?)
  - [ ] **QUESTION:** Any other types needed?
- [ ] Passing score threshold

### ✅ DECIDED: Quiz Settings
- **Retakes:** Unlimited
- **Show correct answers:** Yes, after submission
- **Randomize question order:** Yes (prevents cheating)
- **Randomize answer order:** Yes (prevents cheating)

### Quiz Module (External) - Separate System

### ✅ DECIDED: External Quiz Integration

The external quiz platform is a **completely separate project**. This platform only needs:

**What we store:**
```
external_quiz_references
├── id
├── module_id (links to our module)
├── external_quiz_id (ID in the external system)
├── external_quiz_url (where to take it)
└── passing_score (optional, if we validate here)

external_quiz_results
├── id
├── user_id
├── tenant_id
├── external_quiz_id
├── score
├── passed
├── completed_at
├── raw_response (JSON from external system)
```

**Integration approach:**
1. Module displays "Take External Quiz" button with link
2. User completes quiz on external platform
3. External platform calls our webhook/API with results
4. We store results and update progress if passed

**API endpoint needed:**
```
POST /api/quiz-results/external
{
  "external_quiz_id": "quiz_123",
  "user_email": "bob@santos.com",  // to identify user
  "score": 85,
  "passed": true,
  "details": { ... }  // optional extra data
}
```

**Security:** API key or webhook signature validation

### Exam Module

### ✅ DECIDED: Exam Settings
- **Exam file:** PDF or ZIP download (can contain multiple files)
- **Time limit:** Countdown from download
- **Submission deadline:** Hard cutoff
- **Submission format:** PDF or ZIP upload
- **Late submissions:** Not accepted (hard reject)
- **Rubric:** No (simple single score + written feedback)

**Grading workflow:**
1. Student downloads exam file (timer starts)
2. Student uploads submission before deadline
3. Lecturer receives notification
4. Lecturer downloads submission
5. Lecturer enters score + written feedback
6. Student receives notification of grade

## 4.3 Timestamps & Version Tracking

Every entity needs:
- ✅ `created_at` - Initial creation timestamp
- ✅ `updated_at` - Last modification timestamp
- ✅ `created_by` - User who created
- ✅ `updated_by` - User who last modified

### ✅ DECIDED: Content Update Impact on Progress

**Rule:** When a module is updated AND marked as "significant update", progress for THAT MODULE ONLY is reset to incomplete.

**Implementation:**
```
Module Edit Screen:
┌─────────────────────────────────────────────────┐
│  Save Changes                                   │
│                                                 │
│  ☐ This is a significant update                │
│    (Resets learner progress for this module)   │
│                                                 │
│  [Cancel]  [Save]                              │
└─────────────────────────────────────────────────┘
```

**What happens when checkbox is ticked:**
1. Module's `updated_at` is set
2. Module gets `significant_update_at` timestamp
3. All `user_progress` records for THIS MODULE where `completed_at < significant_update_at` are marked incomplete
4. Affected users receive notification: "Module X in Course Y has been updated. Please review the new content."

**What DOESN'T trigger progress reset:**
- Typo fixes (don't tick the box)
- Metadata changes (title, description)
- Reordering modules within lecture
- Adding NEW modules (no existing progress to reset)

**Scope:** Only the specific module, NOT the entire course or lecture.

## 4.4 Content Update Reminders (Admin Side)

### ✅ DECIDED: Content Staleness
- **Default threshold:** 6 months
- **Who sees stale content alerts:** Platform Admin + Lecturer (for their assigned courses)

**Features:**
- Dashboard showing "stale" content (not updated in 6+ months)
- Configurable staleness threshold per course (can override default)
- Email reminders to Lecturers for their courses
- Platform Admin sees all stale content

---

# 5. PROGRESS TRACKING

## 5.1 Progress Model

```
UserProgress
├── user_id
├── tenant_id (for RLS)
├── course_id
├── lecture_id
├── module_id
├── status: [not_started, in_progress, completed]
├── completed_at
├── marked_by: [user, system, admin]
└── notes (optional, for admin overrides)
```

### ✅ DECIDED: Progress Percentage Calculation

**Approach:** Frontend calculation (no summary tables)

```typescript
// Frontend calculates on demand
const totalModules = course.lectures.flatMap(l => l.modules).length;
const completedModules = userProgress.filter(p => p.status === 'completed').length;
const percentage = (completedModules / totalModules) * 100;
```

**Why:** Simple, always accurate, no sync issues, no triggers to maintain.

## 5.2 Progress Rules

- [ ] Progress is **manual** - user marks modules as complete
- [ ] Exception: Quiz completion auto-marks if passed
- [ ] Exception: Exam grading auto-marks if passed
- [ ] Admin can override/mark progress for any user

## 5.3 Progress Aggregation

- ✅ Module completion % = completed_modules / total_modules
- ✅ Lecture completion % = completed_modules_in_lecture / total_modules_in_lecture  
- ✅ Course completion % = completed_modules_in_course / total_modules_in_course

### ✅ DECIDED: Course Completion

**Course is complete when:** All modules are completed (100%)

**No concept of:**
- Required vs optional modules (all are required)
- Minimum quiz/exam scores for completion
- Partial completion certificates

## 5.4 Progress Dashboard (Who Sees What)

### ✅ DECIDED: Progress Visibility by Role

| Role | What They See |
|------|---------------|
| **Learner** | Own progress only (My Courses page) |
| **Tenant Admin** | All users in their tenant, all courses |
| **CSM** | All users in assigned tenants, all courses |
| **Lecturer** | All users (cross-tenant) for assigned courses only |
| **Platform Admin** | Everyone, everything |

### Dashboard Views

**Learner View (My Courses):**
```
My Courses
┌─────────────────────────────────────────────────────────────┐
│ X-LNG Advanced                                    85% ████░ │
│ Last activity: 2 days ago                        [Continue] │
├─────────────────────────────────────────────────────────────┤
│ X-LNG Basics                                    100% █████ │
│ Completed: Jan 15, 2025                            [Review] │
└─────────────────────────────────────────────────────────────┘
```

**Tenant Admin / CSM View:**
```
Santos Progress Dashboard
┌─────────────────────────────────────────────────────────────┐
│ Users: 45  │  Avg Progress: 67%  │  Completed: 12          │
├─────────────────────────────────────────────────────────────┤
│ User         │ Course           │ Progress │ Last Active   │
│ Bob Smith    │ X-LNG Advanced   │ 85%      │ 2 days ago    │
│ Jane Doe     │ X-LNG Advanced   │ 45%      │ 1 week ago    │
│ Erik Hansen  │ X-LNG Basics     │ 100% ✓   │ 3 days ago    │
└─────────────────────────────────────────────────────────────┘
[Filter by course] [Filter by progress] [Send Reminder]
```

**Lecturer View (Cross-Tenant for Assigned Courses):**
```
My Courses - Student Progress
┌─────────────────────────────────────────────────────────────┐
│ X-LNG Advanced (assigned to you)                           │
├─────────────────────────────────────────────────────────────┤
│ Tenant      │ User         │ Progress │ Last Active        │
│ Santos      │ Bob Smith    │ 85%      │ 2 days ago         │
│ Santos      │ Jane Doe     │ 45%      │ 1 week ago         │
│ Equinor    │ Erik Hansen  │ 72%      │ 3 days ago         │
│ QatarEnergy │ Khalid Omar  │ 90%      │ 1 day ago          │
└─────────────────────────────────────────────────────────────┘
```

**Platform Admin View (Everything):**
```
All Progress (Platform Admin)
┌─────────────────────────────────────────────────────────────┐
│ Filter: [All Tenants ▼] [All Courses ▼]                    │
├─────────────────────────────────────────────────────────────┤
│ Tenant      │ User         │ Course          │ Progress    │
│ Santos      │ Bob Smith    │ X-LNG Advanced  │ 85%         │
│ Equinor    │ Erik Hansen  │ X-Crude Basics  │ 100% ✓      │
│ QatarEnergy │ Khalid Omar  │ X-LNG Advanced  │ 90%         │
└─────────────────────────────────────────────────────────────┘
[Send Bulk Reminder]
```

### Dashboard Features
- ✅ List of users with progress
- ✅ Filter by: course, progress range, last active date
- ✅ Bulk select users for reminder emails

### ✅ DECIDED: Last Active Calculation

**Approach:** Calculate from `user_progress.updated_at`

```sql
SELECT MAX(updated_at) as last_active 
FROM user_progress 
WHERE user_id = ?
```

No extra field needed - just use existing progress data.

## 5.5 Course Reminder Workflow

### ✅ DECIDED: Manual Reminders Only

**No automation.** Admin/Lecturer decides who needs a nudge.

**Flow:**
```
1. Admin/Lecturer views Progress Dashboard
2. Selects users who need a reminder
3. Clicks "Send Reminder"
4. Email sent via FastAPI (Calypso support SMTP)
5. Generic message: "You have incomplete courses. Continue learning!"
```

**Who can send reminders:**

| Role | Can Remind |
|------|------------|
| Tenant Admin | Users in their tenant |
| CSM | Users in assigned tenants |
| Lecturer | Users on their assigned courses (cross-tenant) |
| Platform Admin | Anyone |

**Implementation:**
- FastAPI endpoint: `POST /api/reminders/send`
- Uses Calypso support SMTP
- No custom message (standard text)
- No tracking/history needed

---

# 6. NOTIFICATIONS SYSTEM

## 6.1 Notification Types

### For Learners:
- [ ] Course assigned to you
- [ ] New module added to enrolled course
- [ ] Your progress was reset (content updated)
- [ ] Quiz/exam graded
- [ ] Your expert question was answered (Ask Expert feature)
- [ ] Reminder to continue course (from admin)
- [ ] Exam deadline approaching

### For Lecturers/Experts:
- [ ] New expert question on your course (Ask Expert feature)
- [ ] New exam submission to grade
- [ ] New issue reported on your course
- [ ] Content staleness alert (for assigned courses)

### For CSM:
- [ ] New expert question in assigned tenant
- [ ] New issue reported in assigned tenant

### For Admins:
- [ ] New access request
- [ ] Content staleness alert (all courses)
- [ ] User completed course (optional)
- [ ] New issue report

## 6.2 Notification Channels

### ✅ DECIDED: In-App Only (For Now)
- ✅ In-app notifications (bell icon)
- ❌ No email notifications (maybe later)
- ❌ No push notifications / PWA
- ❌ No user-configurable preferences (everyone gets all relevant notifications)

## 6.3 Implementation: Postgres Triggers

### ✅ DECIDED: Automatic Notifications via Triggers

Notifications created automatically via database triggers - can't forget to add them.

### Notifications Table

```sql
notifications
├── id (uuid, PK)
├── user_id (uuid, FK)        -- Who receives it
├── tenant_id (uuid, FK)      -- For RLS
├── type (text)               -- exam_graded, question_answered, etc.
├── title (text)
├── body (text)
├── data (jsonb)              -- Extra context (links, IDs, etc.)
├── read_at (timestamptz)     -- NULL = unread
├── created_at (timestamptz)
```

### How It Works

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Action happens (e.g., Lecturer grades exam)             │
│    └── UPDATE exam_submissions SET score = 85              │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Postgres trigger fires automatically                    │
│    └── INSERT INTO notifications (user_id, type, ...)      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Supabase Realtime pushes to Angular                     │
│    └── Bell icon updates, toast appears                    │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. (Optional) Edge Function sends email                    │
│    └── Listens to notifications table, sends email         │
└─────────────────────────────────────────────────────────────┘
```

### Angular Integration

```typescript
// notification.service.ts
supabase
  .channel('my-notifications')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'notifications',
    filter: `user_id=eq.${userId}`
  }, (payload) => {
    this.addNotification(payload.new);
    this.showToast(payload.new);
  })
  .subscribe();
```

---

## 6.4 Notification Triggers Checklist

### For Learners

| # | Notification | Trigger Table | Trigger Event | Condition |
|---|--------------|---------------|---------------|-----------|
| [ ] 1 | Course assigned | `course_enrollments` | INSERT | New enrollment |
| [ ] 2 | New module added | `modules` | INSERT | Module added to enrolled course |
| [ ] 3 | Progress reset | `user_progress` | UPDATE | `status` changed to 'not_started' AND `significant_update = true` |
| [ ] 4 | Exam graded | `exam_submissions` | UPDATE | `score` changed from NULL to value |
| [ ] 5 | Expert question answered | `expert_questions` | UPDATE | `response_text` changed from NULL to value |
| [ ] 6 | Reminder to continue | `reminders` | INSERT | Admin sends reminder (manual action) |
| [ ] 7 | Exam deadline approaching | Scheduled job | CRON | 24h before deadline |

### For Lecturers

| # | Notification | Trigger Table | Trigger Event | Condition |
|---|--------------|---------------|---------------|-----------|
| [ ] 8 | New expert question | `expert_questions` | INSERT | Question on assigned course |
| [ ] 9 | New exam submission | `exam_submissions` | INSERT | Submission on assigned course |
| [ ] 10 | New issue reported | `issues` | INSERT | Issue on assigned course |
| [ ] 11 | Content staleness alert | Scheduled job | CRON | Course not updated in 6 months |

### For CSM

| # | Notification | Trigger Table | Trigger Event | Condition |
|---|--------------|---------------|---------------|-----------|
| [ ] 12 | New expert question | `expert_questions` | INSERT | Question from assigned tenant |
| [ ] 13 | New issue reported | `issues` | INSERT | Issue from assigned tenant |

### For Platform Admin

| # | Notification | Trigger Table | Trigger Event | Condition |
|---|--------------|---------------|---------------|-----------|
| [ ] 14 | New access request | `access_requests` | INSERT | Any new request |
| [ ] 15 | Content staleness alert | Scheduled job | CRON | Any course not updated in 6 months |
| [ ] 16 | New issue reported | `issues` | INSERT | Any new issue |

---

## 6.5 Example Trigger Implementation

```sql
-- Trigger function: Notify student when exam is graded
CREATE OR REPLACE FUNCTION notify_exam_graded()
RETURNS TRIGGER AS $$
BEGIN
  -- Only fire when score changes from NULL to a value
  IF OLD.score IS NULL AND NEW.score IS NOT NULL THEN
    INSERT INTO notifications (
      user_id, 
      tenant_id, 
      type, 
      title, 
      body, 
      data
    )
    VALUES (
      NEW.user_id,
      NEW.tenant_id,
      'exam_graded',
      'Your exam has been graded',
      'Your exam submission has been reviewed. Click to see your results.',
      jsonb_build_object(
        'submission_id', NEW.id,
        'course_id', NEW.course_id,
        'score', NEW.score
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger to table
CREATE TRIGGER on_exam_graded
AFTER UPDATE ON exam_submissions
FOR EACH ROW EXECUTE FUNCTION notify_exam_graded();
```

---

## 6.6 Scheduled Jobs (CRON)

Some notifications need scheduled jobs, not triggers:

| Job | Schedule | What It Does |
|-----|----------|--------------|
| Exam deadline reminder | Every hour | Find exams starting in 24h, notify enrolled users |
| Content staleness check | Daily | Find courses not updated in 6 months, notify Lecturer + Admin |

**Implementation:** Supabase Edge Functions + pg_cron or external CRON service

---

# 7. COMMENTS & DISCUSSIONS

## 7.1 Comment Scope

### ✅ DECIDED: Module Level Only

Comments can ONLY be made on modules (specific content). No lecture-level or course-level discussions.

**Rationale:** Keeps discussions focused and relevant to specific content.

## 7.2 Who Can Comment

### ✅ DECIDED: Everyone Can Comment (Experts Get Badge)

| Role | Can Comment | Display |
|------|-------------|---------|
| Learner | ✅ | Normal display |
| Tenant Admin | ✅ | Normal display |
| CSM | ✅ | 🏢 **Calypso** badge |
| Lecturer | ✅ | 🎓 **Expert** badge |
| Platform Admin | ✅ | 🏢 **Calypso** badge |

**Example:**
```
Comments on Module 3:
┌─────────────────────────────────────────────────────────┐
│ Bob (Santos)                              2 hours ago  │
│ I think the formula works because of X                 │
├─────────────────────────────────────────────────────────┤
│ Erik (Santos)                             1 hour ago   │
│ That makes sense, thanks!                              │
├─────────────────────────────────────────────────────────┤
│ 🎓 Dr. Chen (Expert)                      30 min ago   │
│ Good discussion! Just to clarify - the formula         │
│ actually uses Y because...                             │
└─────────────────────────────────────────────────────────┘
```

## 7.3 Comment Features

- ❌ No markdown support (plain text only)
- ✅ Reply threading (1 level deep - replies to comments, no replies to replies)
- ✅ Edit own comments (anytime)
- ✅ Delete own comments
- ✅ Tenant Admin can delete any comment in their tenant
- ✅ Platform Admin can delete any comment
- ❌ No @mentions (use "Ask Expert" for direct expert questions)

## 7.4 Comment Visibility (Multi-tenant)

**CRITICAL:** Comments are tenant-isolated

- Santos user comments on Module X → Only visible to:
  - Other Santos users
  - Santos Tenant Admin
  - Assigned CSM for Santos
  - Lecturer for that course
  - Platform Admin

- Equinor user comments on same Module X → Completely separate thread, invisible to Santos

**Implementation note:** Comments table needs `tenant_id` column. When loading comments for a module, always filter by current user's tenant.

---

# 7B. ASK EXPERT (Direct Questions to Lecturers)

## 7B.1 Overview

### ✅ DECIDED: "Ask Expert" Button Instead of @Mentions

For direct questions to course experts, use a dedicated "Ask Expert" feature instead of @mentions in comments.

**Why not @mentions:**
- Requires autocomplete, parsing, linking
- Mixes peer discussion with expert requests
- No clear workflow/status tracking

**Ask Expert provides:**
- Clear button on module/course level
- Direct channel to Lecturer
- Status tracking (pending → answered)
- Dedicated inbox for Lecturers

## 7B.2 Learner Flow

**Step 1: Click "Ask Expert" on any module**
```
┌─────────────────────────────────────────────────────────────┐
│ Module 3: LNG Pricing Models              [Ask Expert 💬]  │
└─────────────────────────────────────────────────────────────┘
```

**Step 2: Write question**
```
┌─────────────────────────────────────────────────────────────┐
│ Ask the Course Expert                                      │
│                                                            │
│ Your question:                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │ I don't understand the formula in step 3...         │   │
│ └─────────────────────────────────────────────────────┘   │
│                                                            │
│ This will be sent to: Dr. Chen (Course Expert)            │
│                                                            │
│ [Cancel]  [Send Question]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Track in "My Questions" (in profile/dashboard)**
```
┌─────────────────────────────────────────────────────────────┐
│ My Questions                                               │
├─────────────────────────────────────────────────────────────┤
│ 🟢 ANSWERED │ X-LNG Advanced, Module 3                     │
│             │ "I don't understand the formula..."           │
│             │ Asked 2 days ago                              │
│             │                                               │
│             │ Dr. Chen replied:                             │
│             │ "The formula uses FOB pricing because..."     │
│             │                                    [View Full]│
├─────────────────────────────────────────────────────────────┤
│ 🟡 PENDING  │ X-LNG Advanced, Module 5                     │
│             │ "Is the ship capacity correct?"               │
│             │ Asked 5 hours ago                             │
│             │                                               │
│             │ Waiting for expert response...                │
└─────────────────────────────────────────────────────────────┘
```

## 7B.3 Lecturer Flow

**Lecturer sees Questions Board in their dashboard:**
```
┌─────────────────────────────────────────────────────────────┐
│ Expert Questions (3 pending)                               │
├─────────────────────────────────────────────────────────────┤
│ 🔴 NEW │ Bob (Santos) - X-LNG Advanced, Module 3           │
│        │ "I don't understand the formula..."                │
│        │ 2 hours ago                        [View] [Reply]  │
├─────────────────────────────────────────────────────────────┤
│ 🔴 NEW │ Erik (Equinor) - X-LNG Advanced, Module 5         │
│        │ "Is the ship capacity correct?"                    │
│        │ 5 hours ago                        [View] [Reply]  │
├─────────────────────────────────────────────────────────────┤
│ ✅ DONE│ Khalid (QatarEnergy) - X-LNG Basics, Module 1     │
│        │ "What's the difference between..."                 │
│        │ Answered 2 days ago                [View]          │
└─────────────────────────────────────────────────────────────┘
```

**Note:** Lecturer sees questions from ALL tenants for their assigned courses.

## 7B.4 Data Model

```sql
expert_questions
├── id (uuid, PK)
├── tenant_id (uuid, FK)           -- Who asked (for RLS isolation)
├── user_id (uuid, FK)             -- Learner who asked
├── course_id (uuid, FK)           -- Which course
├── module_id (uuid, FK, nullable) -- Specific module (optional)
├── question_text (text)
├── status (enum)                  -- pending, answered, closed
├── created_at (timestamptz)
├── response_text (text, nullable)
├── responded_by (uuid, FK, nullable)  -- Which lecturer answered
├── responded_at (timestamptz, nullable)
```

## 7B.5 Visibility Rules

| Role | Can See | Can Reply |
|------|---------|-----------|
| Learner | Own questions only | N/A (asks, doesn't reply) |
| Tenant Admin | All questions from their tenant | ❌ |
| CSM | Questions from assigned tenants | ❌ (view only for awareness) |
| Lecturer | Questions for assigned courses (cross-tenant) | ✅ |
| Platform Admin | All questions | ✅ |

**Note:** CSM can see questions from their tenants for support awareness, but only Lecturers answer via the Questions Board. This keeps the expert response authoritative.

## 7B.6 Notifications

- **Learner:** Notified when expert replies (email + in-app)
- **Lecturer:** Notified when new question arrives (email + in-app)

---

# 8. ISSUE REPORTING

## 8.1 Issue Types

### ✅ DECIDED: Issue Categories
- Content error (typo, incorrect info)
- Technical issue (video won't play, file won't download)
- Accessibility issue
- Other/General feedback

## 8.2 Issue Workflow

```
1. User reports issue on specific module/lecture/course
   └── Selects type, writes description, optional screenshot
   
2. Issue created with status: "Open"
   └── Notification to: Lecturer (for course) + CSM (for tenant)
   
3. Someone (Calypso) investigates
   └── Can add internal notes (not visible to reporter)
   
4. Issue resolved
   └── Status: "Resolved"
   └── Notify reporter
```

## 8.3 Issue Visibility

### ✅ DECIDED: Issue Visibility Rules

| Role | Can See |
|------|---------|
| Learner | Own issues only |
| Tenant Admin | All issues from their tenant |
| CSM | Issues from assigned tenants |
| Lecturer | Issues on assigned courses (cross-tenant) |
| Platform Admin | All issues |

**Notes:**
- Issues are tenant-isolated by default
- Lecturer cross-tenant access uses same JWT pattern as progress/comments
- Platform Admin sees all because they manage everything
- Within a tenant, users only see their own issues (not other users' issues)

---

# 9. QUIZZES (Embedded)

## 9.1 Quiz Structure

```
Quiz
├── title
├── description/instructions
├── time_limit (optional)
├── passing_score (percentage)
├── max_attempts (number or unlimited)
├── show_correct_answers (after submission? after all attempts?)
├── randomize_questions (boolean)
├── randomize_answers (boolean)
└── questions[]
    ├── question_text
    ├── question_type
    ├── points
    ├── options[] (for multiple choice)
    │   ├── option_text
    │   └── is_correct
    └── correct_answer (for fill-in-blank, etc.)
```

## 9.2 Quiz Attempt Tracking

```
QuizAttempt
├── user_id
├── tenant_id
├── quiz_id
├── attempt_number
├── started_at
├── submitted_at
├── score
├── passed
└── answers[]
    ├── question_id
    └── user_answer
```

## 9.3 Quiz Policies

### ✅ DECIDED: Quiz Feedback & Scoring
- **See questions got wrong:** Yes
- **See correct answers:** Yes, after answering
- **Multiple attempts score:** Show last score (not best)
- **Cool-down between attempts:** No

---

# 10. EXAMS (Graded)

## 10.1 Exam Flow

```
1. User navigates to exam module
2. User clicks "Start Exam" 
   └── Downloads exam file (PDF or ZIP)
   └── Countdown timer starts
3. User works on exam offline
4. User returns to platform
5. User uploads submission before deadline (PDF or ZIP)
6. Lecturer notified of submission
7. Lecturer grades submission
   └── Enters score + written feedback
8. Student notified of grade
9. Progress updated if passed
```

## 10.2 Exam Configuration

- ✅ Exam duration (hours/minutes from download)
- ✅ **Late submission: HARD REJECT** - no grace period, no penalties
- ✅ Passing score (percentage)
- ✅ Max file size for submission (configurable, suggest 50MB default)
- ✅ Allowed file types (.pdf, .zip configurable per exam)
- ✅ Single submission only - no replacement uploads

**Timer behavior:**
```
1. User clicks "Start Exam" → downloads exam file
2. Timer starts: deadline = now + exam_duration
3. Timer displayed prominently in UI
4. At deadline: upload form disabled immediately
5. Any upload after deadline: rejected with error message
```

**OPEN QUESTION:** What if user's internet cuts out at deadline? 
- Recommendation: Hard reject still applies - this is standard for timed exams
- User can contact Tenant Admin / CSM for exceptional circumstances (manual override?)

## 10.3 Grading

### ✅ DECIDED: Simple Grading
- ✅ Score (percentage)
- ✅ Passed/Failed (auto-calculated from passing score)
- ✅ Written feedback (plain text, no markdown)
- ✅ Graded by (lecturer ID)
- ✅ Graded at (timestamp)
- ❌ No rubric (just simple score + feedback)

### ✅ DECIDED: Exam Reset

**Approach:** Delete submission (simple, no history)

**Who can reset:**
- Lecturer (for assigned courses)
- Platform Admin (any course)

**Flow:**
1. Lecturer/Admin clicks "Reset Exam" on failed submission
2. Submission record deleted
3. User notified: "Your exam has been reset. You can try again."
4. User sees "Start Exam" button again

---

# 11. EXPORTS

### ✅ DECIDED: No Exports Needed
- ❌ No lecture export
- ❌ No progress report export
- ❌ No certificates

Can be added later if needed.

---

# 12. MOBILE CONSIDERATIONS

### ✅ DECIDED: Responsive Web Only
- ✅ Responsive design (Angular + CSS)
- ✅ Touch-friendly UI elements
- ✅ Video player optimized for mobile (Bunny handles this)
- ✅ PDF viewer mobile-friendly
- ❌ No PWA / offline support
- ❌ No native app

---

# 13. SUPABASE ARCHITECTURE

## 13.1 Overview

Using Supabase for:
- **Authentication:** Supabase Auth (Entra SSO for Calypso, email/magic link for clients)
- **Database:** PostgreSQL with Row Level Security (RLS)
- **Storage:** Supabase Storage for PDFs, downloadable files, avatars
- **Realtime:** For notifications

Videos hosted on **Bunny CDN** (not Supabase).

## 13.1.1 Storage Buckets

| Bucket | Contents | Access |
|--------|----------|--------|
| `avatars` | Profile pictures | Public read, authenticated write (own only) |
| `course-files` | PDFs, downloadable files | Authenticated read (tenant access), admin write |
| `exam-submissions` | Student exam uploads | Private (student + lecturer + admin) |

### ✅ DECIDED: Profile Pictures

```
Profile Picture:
├── Storage: Supabase Storage (bucket: 'avatars')
├── Max size: 2MB
├── Formats: .jpg, .png, .webp
├── Path: avatars/{user_id}.{ext}
```

Users can upload/change their own profile picture. Stored in `profiles.avatar_url`.

---

## 13.2 Core Tables

### Tenants
```sql
tenants
├── id (uuid, PK)
├── name (text)
├── is_master (boolean)        -- TRUE only for Calypso
├── domain (text)              -- Single exact match domain
├── settings (jsonb)           -- Future: branding, config
├── created_at (timestamptz)
├── updated_at (timestamptz)
```

### User Profiles
Linked to Supabase `auth.users`. Created via trigger on signup.

```sql
profiles
├── id (uuid, PK, FK to auth.users.id)
├── tenant_id (uuid, FK to tenants)
├── email (text)
├── full_name (text)
├── avatar_url (text)
├── is_tenant_admin (boolean)      -- Any tenant can have this
├── is_platform_admin (boolean)    -- Only valid if tenant.is_master
├── created_at (timestamptz)
├── updated_at (timestamptz)

CONSTRAINT platform_roles_require_master_tenant
  CHECK (
    (is_platform_admin = false)
    OR 
    tenant_id IN (SELECT id FROM tenants WHERE is_master = true)
  )
```

### CSM Assignments
```sql
csm_tenant_assignments
├── id (uuid, PK)
├── user_id (uuid, FK to profiles)   -- Must be from master tenant
├── tenant_id (uuid, FK to tenants)  -- The client they support
├── assigned_at (timestamptz)
├── assigned_by (uuid, FK to profiles)

UNIQUE(user_id, tenant_id)
```

### Lecturer Assignments
```sql
lecturer_course_assignments
├── id (uuid, PK)
├── user_id (uuid, FK to profiles)   -- Must be from master tenant
├── course_id (uuid, FK to courses)
├── can_edit (boolean, default false)   -- Can edit course content
├── can_grade (boolean, default true)   -- Can grade exams
├── assigned_at (timestamptz)
├── assigned_by (uuid, FK to profiles)

UNIQUE(user_id, course_id)
```

**Example assignments:**
| user | course | can_edit | can_grade | Result |
|------|--------|----------|-----------|--------|
| Dr. Chen | X-LNG Advanced | true | true | Full control |
| Junior Dev | X-LNG Advanced | false | true | Only grades exams |
| Intern | X-LNG Basics | false | false | Only answers questions |

---

## 13.3 JWT Custom Claims Strategy

### ✅ DECIDED: Embed Roles in JWT

On login, we use a Supabase hook/function to add custom claims to the JWT:

```json
{
  "sub": "user-uuid",
  "email": "drchen@calypso-commodities.com",
  "tenant_id": "calypso-tenant-uuid",
  "is_tenant_admin": false,
  "is_platform_admin": false,
  "csm_tenant_ids": ["santos-uuid", "equinor-uuid"],
  "lecturer_course_ids": ["xlng-advanced-uuid", "xlng-basics-uuid"],
  "lecturer_can_edit_course_ids": ["xlng-advanced-uuid", "xlng-basics-uuid"],
  "lecturer_can_grade_course_ids": ["xlng-advanced-uuid", "xlng-basics-uuid"]
}
```

**Benefits:**
- RLS policies are fast (no subqueries, just JWT checks)
- All permission info available in one place

**Trade-off:**
- Role changes require token refresh (user re-login or forced refresh)
- Acceptable since role changes are rare

**Limits:**
- CSM: Typically 5-10 tenant assignments (fine for JWT)
- Lecturer: Max ~10 course assignments (fine for JWT)

---

## 13.4 Row Level Security (RLS) Policies

### Helper Function
```sql
CREATE OR REPLACE FUNCTION public.jwt_claim(claim text)
RETURNS text AS $$
  SELECT coalesce(
    current_setting('request.jwt.claims', true)::json->>claim,
    ''
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION public.jwt_claim_array(claim text)
RETURNS text[] AS $$
  SELECT array(
    SELECT jsonb_array_elements_text(
      coalesce(
        current_setting('request.jwt.claims', true)::jsonb->claim,
        '[]'::jsonb
      )
    )
  );
$$ LANGUAGE sql STABLE;
```

### Profiles Table
```sql
-- Users can read own profile
CREATE POLICY "read_own_profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Tenant admins can read profiles in their tenant
CREATE POLICY "tenant_admin_read_profiles" ON profiles
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

-- Platform admins can read all profiles
CREATE POLICY "platform_admin_read_profiles" ON profiles
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

-- CSMs can read profiles in assigned tenants
CREATE POLICY "csm_read_profiles" ON profiles
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );
```

### User Progress Table
```sql
-- Users can read/write own progress
CREATE POLICY "own_progress" ON user_progress
  FOR ALL USING (user_id = auth.uid());

-- Tenant admins can read progress in their tenant
CREATE POLICY "tenant_admin_read_progress" ON user_progress
  FOR SELECT USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

-- Platform admins can read all progress
CREATE POLICY "platform_admin_read_progress" ON user_progress
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

-- CSMs can read progress in assigned tenants
CREATE POLICY "csm_read_progress" ON user_progress
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- Lecturers can read progress for their assigned courses (CROSS-TENANT)
CREATE POLICY "lecturer_read_progress" ON user_progress
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = user_progress.module_id
      AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );
```

### Comments Table
```sql
-- Users can read comments in their tenant
CREATE POLICY "read_tenant_comments" ON comments
  FOR SELECT USING (tenant_id = public.jwt_claim('tenant_id')::uuid);

-- Users can insert comments (own tenant only)
CREATE POLICY "insert_own_comment" ON comments
  FOR INSERT WITH CHECK (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND user_id = auth.uid()
  );

-- Users can edit/delete own comments
CREATE POLICY "modify_own_comment" ON comments
  FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "delete_own_comment" ON comments
  FOR DELETE USING (user_id = auth.uid());

-- Tenant admins can delete any comment in their tenant
CREATE POLICY "tenant_admin_delete_comment" ON comments
  FOR DELETE USING (
    tenant_id = public.jwt_claim('tenant_id')::uuid
    AND public.jwt_claim('is_tenant_admin') = 'true'
  );

-- Platform admins can read all comments
CREATE POLICY "platform_admin_read_comments" ON comments
  FOR SELECT USING (public.jwt_claim('is_platform_admin') = 'true');

-- CSMs can read comments in assigned tenants
CREATE POLICY "csm_read_comments" ON comments
  FOR SELECT USING (
    tenant_id = ANY(public.jwt_claim_array('csm_tenant_ids')::uuid[])
  );

-- Lecturers can read comments on their courses (CROSS-TENANT)
CREATE POLICY "lecturer_read_comments" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM modules m
      WHERE m.id = comments.module_id
      AND m.course_id = ANY(public.jwt_claim_array('lecturer_course_ids')::uuid[])
    )
  );
```

### Content Tables (Courses, Lectures, Modules)
```sql
-- Everyone can read courses assigned to their tenant
CREATE POLICY "read_tenant_courses" ON courses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tenant_courses tc
      WHERE tc.course_id = courses.id
      AND tc.tenant_id = public.jwt_claim('tenant_id')::uuid
    )
  );

-- Platform admins can read/write all courses
CREATE POLICY "platform_admin_all_courses" ON courses
  FOR ALL USING (public.jwt_claim('is_platform_admin') = 'true');

-- Lecturers with can_edit can write to their assigned courses
CREATE POLICY "lecturer_edit_assigned_courses" ON courses
  FOR UPDATE USING (
    id = ANY(public.jwt_claim_array('lecturer_can_edit_course_ids')::uuid[])
  );

-- Similar policies needed for lectures and modules tables
-- Lecturer can edit lectures/modules if course_id is in their can_edit list
```

---

## 13.5 API Security (FastAPI)

For operations that can't be done via RLS or need complex logic:

- [ ] All endpoints require valid Supabase JWT
- [ ] JWT verified and decoded to get user context
- [ ] Tenant context validated on every request
- [ ] Platform role operations check `is_master` tenant
- [ ] Rate limiting on sensitive endpoints
- [ ] Input validation and sanitization
- [ ] File upload validation (type, size)

---

## 13.6 Data Privacy

- [ ] GDPR compliance: EU data stays in EU (Supabase region selection)
- [ ] Data retention policy: TBD
- [ ] User data export: FastAPI endpoint to generate user data dump
- [ ] User deletion: Cascade delete or anonymize
- [ ] **QUESTION:** Where are users located? (EU? Global?)

---

# 14. OPEN QUESTIONS SUMMARY

## ✅ Resolved Questions

| Question | Decision |
|----------|----------|
| Multi-tenant model | Option B: Shared content + tenant context |
| Calypso as tenant | Yes - Calypso is the "master tenant" (is_master = true) |
| Can tenants create courses? | No - Calypso only |
| CSM - Calypso or client? | Always Calypso, can have multiple tenants |
| Multiple roles per user? | Yes |
| Lecturer vs CSM | Separate roles - Lecturer is per-course expert |
| Lecturer cross-tenant access | Yes - via JWT course IDs (max ~10 courses) |
| Lecturer issue visibility | Yes - can see issues on assigned courses (cross-tenant) |
| Content Creator role | Removed - Lecturer with can_edit flag replaces it |
| Lecturer edit capability | Per-assignment flag (can_edit, can_grade) |
| Progress reset trigger | "Significant update" checkbox, module-level only |
| Certificates | No |
| Video progress tracking | Just completed (manual), no partial tracking |
| SSO Provider | Microsoft Entra ID for Calypso |
| External quiz platform | Separate project, we store quiz_id + results |
| Email domain matching | Exact match only |
| Comment scope | Module level only |
| Who can comment | Everyone - CSM/Lecturer get badge (🎓 Expert, 🏢 Calypso) |
| @mentions | No - use "Ask Expert" button instead |
| Expert questions | Dedicated "Ask Expert" feature with Questions Board for Lecturers |
| Learner question tracking | "My Questions" page in profile/dashboard |
| Lecturer progress visibility | Yes - can see progress for their assigned courses |
| Exam late policy | Hard reject - no grace period, no penalty system |
| Database | Supabase (PostgreSQL + RLS) |
| Auth strategy | JWT custom claims with roles embedded |
| Issue visibility within tenant | Only reporter sees their own (no community view) |
| User limit per tenant | No limit |
| Tenant Admin course visibility | Can see courses assigned to their tenant only |
| Client SSO | Not needed for now |
| Multiple domains per tenant | No - one domain per tenant |
| Access request timeout | No timeout - manual cleanup by Platform Admin |
| Open Enrollment | Yes, needed for some courses |
| Password-protected course visibility | Everyone in tenant sees it (need password to enroll) |
| PDF storage | Supabase Storage |
| PDF download | Allow download (not view-only) |
| Markdown embedded images | No - too complex |
| Markdown syntax highlighting | Yes - use Angular markdown editor library |
| Quiz retakes | Unlimited |
| Quiz show correct answers | Yes, after submission |
| Quiz randomization | Yes - both question order and answer order |
| Quiz see wrong answers | Yes |
| Quiz see correct answers | Yes, after answering |
| Quiz multiple attempts score | Show last score (not best) |
| Quiz cool-down between attempts | No |
| Exam file format | PDF or ZIP |
| Exam submission format | PDF or ZIP |
| Exam late submissions | Not accepted (hard reject) |
| Exam rubric | No - simple single score + written feedback |
| Content staleness threshold | 6 months default, configurable per course |
| Staleness alerts visibility | Platform Admin + Lecturer (for assigned courses) |
| Course completion definition | All modules completed (no optional modules concept) |
| Progress calculation | Frontend calculation (no summary tables) |
| Last active calculation | MAX(updated_at) from user_progress |
| Notification channels | In-app only (bell icon) - email maybe later |
| Push notifications | No |
| User notification preferences | No - everyone gets all relevant notifications |
| Notification implementation | Postgres triggers (automatic, can't forget) |
| Exports | None needed (no lecture export, no progress export, no certificates) |
| PWA/Offline support | Not needed - responsive web only |
| Course reminders | Manual only, generic message, via FastAPI + SMTP |
| Who can send reminders | Tenant Admin, CSM, Lecturer (their courses), Platform Admin |
| Profile pictures | Supabase Storage, 2MB max, jpg/png/webp |
| Markdown editor (Lecturers) | Tiptap (TypeScript, WYSIWYG) |
| Markdown viewer (Learners) | ngx-markdown with Prism.js |

## 🟡 Still Open - Need Decisions

No open questions remaining! 🎉

---

# 15. ARCHITECTURE DECISIONS LOG

## ✅ Confirmed Decisions

| Decision | Choice | Date | Rationale |
|----------|--------|------|-----------|
| Multi-tenant model | Shared content + tenant context | 2025-01-31 | Simpler updates, single source of truth |
| Calypso as tenant | Master tenant (is_master = true) | 2025-01-31 | Consistent data model, everyone has tenant_id |
| Tenant course creation | No (Calypso only) | 2025-01-31 | Scope control, simpler permissions |
| CSM ownership | Always Calypso employee | 2025-01-31 | Clear accountability |
| CSM scope | Can manage multiple tenants | 2025-01-31 | Flexibility for team |
| Multiple roles | Yes, per user | 2025-01-31 | Real-world flexibility needed |
| Lecturer role | Separate from CSM | 2025-01-31 | Technical experts ≠ client managers |
| Lecturer cross-tenant | JWT course IDs (max ~10) | 2025-01-31 | Simple, fast RLS checks |
| Progress reset | "Significant update" checkbox | 2025-01-31 | Creator control |
| Progress reset scope | Module level only | 2025-01-31 | Don't punish for unrelated updates |
| Certificates | Not needed | 2025-01-31 | Keep scope lean |
| Video tracking | Manual complete only | 2025-01-31 | Simplicity |
| SSO provider | Microsoft Entra ID | 2025-01-31 | Calypso uses Entra |
| External quizzes | Separate system | 2025-01-31 | Already planned separately |
| Email domain matching | Exact match only | 2025-01-31 | Simplicity, security |
| Comment scope | Module level only | 2025-01-31 | Focused discussions |
| Lecturer progress view | Yes, for assigned courses | 2025-01-31 | Helps identify problem areas |
| Exam late policy | Hard reject | 2025-01-31 | Clear rules, no edge cases |
| Lecturer issue visibility | Yes, for assigned courses (cross-tenant) | 2025-01-31 | Experts need to see reported problems |
| Issue visibility within tenant | Only own issues (no community view) | 2025-01-31 | Privacy |
| Database | Supabase PostgreSQL | 2025-01-31 | RLS, Auth, Storage in one |
| Auth strategy | JWT custom claims | 2025-01-31 | Fast RLS, no subqueries |
| Role storage | Booleans on profiles + assignment tables | 2025-01-31 | Simple, queryable |
| Content Creator role | Removed - use Lecturer with can_edit | 2025-01-31 | Simpler, same person creates + supports |
| Lecturer permissions | Per-assignment flags (can_edit, can_grade) | 2025-01-31 | Flexible granular control |
| Expert questions | "Ask Expert" button + Questions Board | 2025-01-31 | Simpler than @mentions, clear workflow |
| Comments - who can post | Everyone (experts get badge) | 2025-01-31 | Experts can correct mistakes, badges show authority |
| @mentions | Not implemented | 2025-01-31 | Too complex, Ask Expert covers the use case |
| Exports | None needed | 2025-01-31 | Keep scope lean |
| PWA/Offline | Not needed | 2025-01-31 | Responsive web only |

---

# 16. NEXT STEPS

All requirements finalized! Next:

1. [x] Finalize all open questions ✅
2. [ ] Design database schema
3. [ ] Design API endpoints
4. [ ] Create UI wireframes
5. [ ] Set up project structure
6. [ ] Implement authentication
7. [ ] Build core features iteratively

---

# NOTES & DISCUSSION LOG

*Add notes here as we discuss and iterate*

**2025-01-31:** Initial draft created. Awaiting feedback on multi-tenancy model and role definitions.

**2025-01-31:** Removed Content Creator role. Lecturers now have per-assignment `can_edit` and `can_grade` flags. This simplifies the model - the person who knows the content (Lecturer) can also edit it if given permission. Platform Admin can still edit any course.

**2025-01-31:** Replaced @mentions with "Ask Expert" button feature. Learners click button on module → question goes to Lecturer's Questions Board → Lecturer replies → Learner notified and sees answer in "My Questions" page. Simpler than parsing @mentions, clearer workflow.

**2025-01-31:** Decided everyone can comment (CSM/Lecturer included). Experts get visual badge (🎓 Expert or 🏢 Calypso) to distinguish official responses from peer discussion.
