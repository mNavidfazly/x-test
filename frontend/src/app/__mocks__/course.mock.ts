import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  CourseWithProgress, CourseDetail, ModuleViewerData,
  ModuleVideo, ModulePdf, ModuleMarkdownContent, ModuleFile,
  CourseFormData, TenantSummary, LectureFormData,
  ModuleFormData, VideoFormData, PdfFormData, ExamFormData, MarkdownFormData,
  QuizFormData, QuizContent, ModuleSavePayload,
  ExternalQuizFormData, ExternalQuizContent,
  EnrolledUser, UserProgressSummary,
  DashboardUserProgress, DashboardCourseSummary,
  QuizTakingData, QuizAttempt, QuizGradeResult, QuizQuestionResult, QuizResults,
  ExamTakingData, ExamSubmission,
  GradingSubmission, GradingCourseSummary,
} from '../core/models/course.model';
import { of } from 'rxjs';

export function createMockCourseService(options?: {
  courses?: CourseWithProgress[];
  courseDetail?: CourseDetail | null;
  moduleViewer?: ModuleViewerData | null;
  loading?: boolean;
  error?: string;
}) {
  const courses = signal<CourseWithProgress[]>(options?.courses ?? []);
  const courseDetail = signal<CourseDetail | null>(options?.courseDetail ?? null);
  const moduleViewer = signal<ModuleViewerData | null>(options?.moduleViewer ?? null);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    courses: courses.asReadonly(),
    courseDetail: courseDetail.asReadonly(),
    moduleViewer: moduleViewer.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadCourses: vi.fn().mockResolvedValue(undefined),
    loadCourseDetail: vi.fn().mockResolvedValue(undefined),
    loadModuleViewer: vi.fn().mockResolvedValue(undefined),
    markModuleComplete: vi.fn().mockResolvedValue(undefined),
    createCourse: vi.fn().mockResolvedValue({ id: 'new-course-id' }),
    updateCourse: vi.fn().mockResolvedValue(undefined),
    deleteCourse: vi.fn().mockResolvedValue(undefined),
    loadTenants: vi.fn().mockResolvedValue([]),
    loadTenantAssignments: vi.fn().mockResolvedValue([]),
    assignCourseToTenant: vi.fn().mockResolvedValue(undefined),
    removeCourseFromTenant: vi.fn().mockResolvedValue(undefined),
    createLecture: vi.fn().mockResolvedValue({ id: 'new-lecture-id' }),
    updateLecture: vi.fn().mockResolvedValue(undefined),
    deleteLecture: vi.fn().mockResolvedValue(undefined),
    swapLectureSortOrder: vi.fn().mockResolvedValue(undefined),
    createModule: vi.fn().mockResolvedValue({ id: 'new-module-id' }),
    updateModule: vi.fn().mockResolvedValue(undefined),
    deleteModule: vi.fn().mockResolvedValue(undefined),
    swapModuleSortOrder: vi.fn().mockResolvedValue(undefined),
    loadModuleForEdit: vi.fn().mockResolvedValue({
      module: { id: 'mod-1', title: 'Test Module', description: null, module_type: 'video', sort_order: 0, lecture_id: 'lecture-1', course_id: 'course-1' },
      content: { type: 'video', data: { bunny_video_id: 'test-guid', bunny_library_id: 12345, original_filename: null } },
    }),
    loadModuleFiles: vi.fn().mockResolvedValue([]),
    addModuleFile: vi.fn().mockResolvedValue(undefined),
    deleteModuleFile: vi.fn().mockResolvedValue(undefined),
    enrollInOpenCourse: vi.fn().mockResolvedValue(undefined),
    enrollWithPassword: vi.fn().mockResolvedValue(undefined),
    adminEnrollUser: vi.fn().mockResolvedValue(undefined),
    unenrollUser: vi.fn().mockResolvedValue(undefined),
    loadEnrolledUsers: vi.fn().mockResolvedValue([]),
    lookupUserByEmail: vi.fn().mockResolvedValue(null),
    loadCourseProgressAdmin: vi.fn().mockResolvedValue([]),
    adminMarkModuleComplete: vi.fn().mockResolvedValue(undefined),
    adminResetModuleProgress: vi.fn().mockResolvedValue(undefined),
    loadQuizForTaking: vi.fn().mockResolvedValue(null),
    startQuizAttempt: vi.fn().mockResolvedValue({ id: 'attempt-1', quiz_id: 'quiz-1', attempt_number: 1, started_at: new Date().toISOString(), submitted_at: null, score: null, passed: null }),
    submitQuizAttempt: vi.fn().mockResolvedValue({ attempt: { id: 'attempt-1', quiz_id: 'quiz-1', attempt_number: 1, started_at: new Date().toISOString(), submitted_at: new Date().toISOString(), score: 80, passed: true }, grade: { score: 80, passed: true, earned_points: 4, total_points: 5 }, questions: [] }),
    getQuizAttemptResults: vi.fn().mockResolvedValue({ attempt: { id: 'attempt-1', quiz_id: 'quiz-1', attempt_number: 1, started_at: new Date().toISOString(), submitted_at: new Date().toISOString(), score: 80, passed: true }, grade: { score: 80, passed: true, earned_points: 4, total_points: 5 }, questions: [] }),
    loadExamForTaking: vi.fn().mockResolvedValue(null),
    submitExamSubmission: vi.fn().mockResolvedValue(createMockExamSubmission()),
    _setCourses: courses.set.bind(courses),
    _setCourseDetail: courseDetail.set.bind(courseDetail),
    _setModuleViewer: moduleViewer.set.bind(moduleViewer),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockCourseService = ReturnType<typeof createMockCourseService>;

export function createMockCourseWithProgress(overrides?: Partial<CourseWithProgress>): CourseWithProgress {
  return {
    id: 'course-1',
    title: 'Test Course',
    description: 'A test course description',
    thumbnail_url: null,
    enrollment_type: 'open',
    moduleCount: 10,
    completedModules: 3,
    progressPercent: 30,
    isEnrolled: true,
    lastActivity: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

export function createMockCourseDetail(overrides?: Partial<CourseDetail>): CourseDetail {
  return {
    id: 'course-1',
    title: 'Test Course',
    description: 'A test course description',
    thumbnail_url: null,
    enrollment_type: 'open',
    isEnrolled: true,
    lectures: [
      {
        id: 'lecture-1',
        title: 'Lecture 1',
        description: null,
        sort_order: 0,
        modules: [
          { id: 'mod-1', title: 'Module 1', module_type: 'video', sort_order: 0 },
          { id: 'mod-2', title: 'Module 2', module_type: 'pdf', sort_order: 1 },
        ],
      },
      {
        id: 'lecture-2',
        title: 'Lecture 2',
        description: 'Second lecture',
        sort_order: 1,
        modules: [
          { id: 'mod-3', title: 'Module 3', module_type: 'quiz', sort_order: 0 },
        ],
      },
    ],
    progressMap: {
      'mod-1': { status: 'completed', completed_at: '2026-01-15T10:00:00Z' },
      'mod-2': { status: 'in_progress', completed_at: null },
    },
    ...overrides,
  };
}

export function createMockModuleVideo(overrides?: Partial<ModuleVideo>): ModuleVideo {
  return {
    bunny_video_id: 'test-guid',
    bunny_library_id: 12345,
    encoding_status: 3,
    duration: 360,
    thumbnail_url: 'https://cdn.test.com/thumb.jpg',
    original_filename: 'test-video.mp4',
    ...overrides,
  };
}

export function createMockModulePdf(overrides?: Partial<ModulePdf>): ModulePdf {
  return {
    file_url: 'https://storage.supabase.co/test.pdf',
    file_name: 'test-document.pdf',
    page_count: 12,
    ...overrides,
  };
}

export function createMockModuleMarkdown(overrides?: Partial<ModuleMarkdownContent>): ModuleMarkdownContent {
  return {
    content: '# Test Markdown\n\nSome **bold** text.',
    ...overrides,
  };
}

export function createMockModuleFile(overrides?: Partial<ModuleFile>): ModuleFile {
  return {
    id: 'file-1',
    file_url: 'https://storage.supabase.co/attachment.zip',
    file_name: 'resources.zip',
    file_size: 1048576,
    ...overrides,
  };
}

export function createMockModuleViewerData(overrides?: Partial<ModuleViewerData>): ModuleViewerData {
  return {
    module: {
      id: 'mod-1',
      title: 'Test Module',
      description: 'A test module',
      module_type: 'video',
      sort_order: 0,
      lecture_id: 'lecture-1',
      course_id: 'course-1',
    },
    content: { type: 'video', data: createMockModuleVideo() },
    files: [],
    progress: null,
    navigation: {
      prev: null,
      next: { id: 'mod-2', title: 'Next Module', module_type: 'pdf', lectureTitle: 'Lecture 1' },
      current: 1,
      total: 3,
    },
    ...overrides,
  };
}

// Phase 3A: Course CRUD factories

export function createMockCourseFormData(overrides?: Partial<CourseFormData>): CourseFormData {
  return {
    title: 'New Course',
    description: 'A new course description',
    thumbnail_url: null,
    enrollment_type: 'open',
    password_hash: null,
    staleness_threshold_days: null,
    ...overrides,
  };
}

export function createMockLectureFormData(overrides?: Partial<LectureFormData>): LectureFormData {
  return {
    title: 'New Lecture',
    description: 'A lecture description',
    ...overrides,
  };
}

export function createMockTenantSummary(overrides?: Partial<TenantSummary>): TenantSummary {
  return {
    id: 'tenant-1',
    name: 'Test Tenant',
    domain: 'test.com',
    is_master: false,
    ...overrides,
  };
}

// Phase 3C: Module CRUD factories

export function createMockModuleFormData(overrides?: Partial<ModuleFormData>): ModuleFormData {
  return {
    title: 'New Module',
    description: null,
    module_type: 'video',
    lecture_id: 'lecture-1',
    ...overrides,
  };
}

export function createMockVideoFormData(overrides?: Partial<VideoFormData>): VideoFormData {
  return {
    bunny_video_id: 'test-guid',
    bunny_library_id: 12345,
    original_filename: null,
    ...overrides,
  };
}

export function createMockPdfFormData(overrides?: Partial<PdfFormData>): PdfFormData {
  return {
    file_url: 'https://test.supabase.co/course-files/c1/test.pdf',
    file_name: 'test-document.pdf',
    page_count: 12,
    ...overrides,
  };
}

export function createMockExamFormData(overrides?: Partial<ExamFormData>): ExamFormData {
  return {
    title: 'Test Exam',
    description: 'A test exam',
    duration_minutes: 60,
    passing_score: 70,
    max_file_size: 52428800,
    allowed_file_types: ['application/pdf', 'application/zip'],
    exam_file_url: null,
    ...overrides,
  };
}

export function createMockMarkdownFormData(overrides?: Partial<MarkdownFormData>): MarkdownFormData {
  return {
    content: '# Test Content\n\nSome markdown text.',
    ...overrides,
  };
}

export function createMockQuizFormData(overrides?: Partial<QuizFormData>): QuizFormData {
  return {
    title: 'Test Quiz',
    description: 'A test quiz',
    time_limit: 600, // 10 minutes in seconds
    passing_score: 70,
    max_attempts: 3,
    show_correct_answers: true,
    randomize_questions: false,
    randomize_answers: false,
    questions: [
      {
        question_text: 'What is 2 + 2?',
        question_type: 'single_choice',
        points: 1,
        sort_order: 0,
        correct_answer: null,
        options: [
          { option_text: '3', is_correct: false, sort_order: 0 },
          { option_text: '4', is_correct: true, sort_order: 1 },
          { option_text: '5', is_correct: false, sort_order: 2 },
        ],
      },
    ],
    ...overrides,
  };
}

export function createMockQuizContent(overrides?: Partial<QuizContent>): QuizContent {
  return {
    id: 'quiz-1',
    title: 'Test Quiz',
    description: 'A test quiz',
    time_limit: 600,
    passing_score: 70,
    max_attempts: 3,
    show_correct_answers: true,
    randomize_questions: false,
    randomize_answers: false,
    questions: [
      {
        id: 'q-1',
        question_text: 'What is 2 + 2?',
        question_type: 'single_choice',
        points: 1,
        sort_order: 0,
        correct_answer: null,
        options: [
          { id: 'o-1', option_text: '3', is_correct: false, sort_order: 0 },
          { id: 'o-2', option_text: '4', is_correct: true, sort_order: 1 },
          { id: 'o-3', option_text: '5', is_correct: false, sort_order: 2 },
        ],
      },
    ],
    ...overrides,
  };
}

export function createMockExternalQuizContent(overrides?: Partial<ExternalQuizContent>): ExternalQuizContent {
  return {
    external_quiz_id: 'EXT-QUIZ-001',
    external_quiz_url: 'https://quiz-platform.example.com/quiz/EXT-QUIZ-001',
    passing_score: 70,
    ...overrides,
  };
}

export function createMockExternalQuizFormData(overrides?: Partial<ExternalQuizFormData>): ExternalQuizFormData {
  return {
    external_quiz_id: 'EXT-QUIZ-001',
    external_quiz_url: 'https://quiz-platform.example.com/quiz/EXT-QUIZ-001',
    passing_score: 70,
    ...overrides,
  };
}

export function createMockModuleSavePayload(overrides?: Partial<ModuleSavePayload>): ModuleSavePayload {
  return {
    module: createMockModuleFormData(),
    content: { type: 'video', data: createMockVideoFormData() },
    ...overrides,
  };
}

// Phase 4A: Enrollment factories

export function createMockUserProgressSummary(overrides?: Partial<UserProgressSummary>): UserProgressSummary {
  return {
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    email: 'learner@test.com',
    full_name: 'Test Learner',
    completed: 2,
    total: 5,
    modules: {
      'mod-1': { module_id: 'mod-1', status: 'completed', completed_at: '2026-01-15T10:00:00Z', marked_by: 'user' },
      'mod-2': { module_id: 'mod-2', status: 'completed', completed_at: '2026-01-16T10:00:00Z', marked_by: 'system' },
    },
    ...overrides,
  };
}

export function createMockEnrolledUser(overrides?: Partial<EnrolledUser>): EnrolledUser {
  return {
    id: 'enrollment-1',
    user_id: 'user-1',
    email: 'learner@test.com',
    full_name: 'Test Learner',
    enrolled_at: '2026-01-15T10:00:00Z',
    ...overrides,
  };
}

// Phase 4C: Progress Dashboard factories

export function createMockProgressService(options?: {
  users?: DashboardUserProgress[];
  courses?: DashboardCourseSummary[];
  loading?: boolean;
  error?: string;
}) {
  const users = signal<DashboardUserProgress[]>(options?.users ?? []);
  const courses = signal<DashboardCourseSummary[]>(options?.courses ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    users: users.asReadonly(),
    courses: courses.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadDashboardData: vi.fn().mockResolvedValue(undefined),
    sendReminders: vi.fn().mockReturnValue(of({ sent: 1, failed: 0 })),
    _setUsers: users.set.bind(users),
    _setCourses: courses.set.bind(courses),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockProgressService = ReturnType<typeof createMockProgressService>;

export function createMockDashboardUserProgress(overrides?: Partial<DashboardUserProgress>): DashboardUserProgress {
  return {
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    email: 'learner@test.com',
    full_name: 'Test Learner',
    tenant_name: 'Test Tenant',
    courses: [{ course_id: 'c1', course_title: 'Test Course', completed: 3, total: 5, percent: 60 }],
    overallPercent: 60,
    lastActive: '2026-02-10T10:00:00Z',
    ...overrides,
  };
}

// Phase 5A: Quiz Taking factories

export function createMockQuizTakingData(overrides?: Partial<QuizTakingData>): QuizTakingData {
  return {
    id: 'quiz-1',
    title: 'Test Quiz',
    description: 'A test quiz for learners',
    time_limit: 600,
    passing_score: 70,
    max_attempts: 3,
    show_correct_answers: true,
    randomize_questions: false,
    randomize_answers: false,
    questions: [
      {
        id: 'q-1',
        question_text: 'What is 2 + 2?',
        question_type: 'single_choice',
        points: 1,
        sort_order: 0,
        options: [
          { id: 'o-1', option_text: '3', sort_order: 0 },
          { id: 'o-2', option_text: '4', sort_order: 1 },
          { id: 'o-3', option_text: '5', sort_order: 2 },
        ],
      },
      {
        id: 'q-2',
        question_text: 'Is the sky blue?',
        question_type: 'true_false',
        points: 1,
        sort_order: 1,
        options: [
          { id: 'o-4', option_text: 'True', sort_order: 0 },
          { id: 'o-5', option_text: 'False', sort_order: 1 },
        ],
      },
    ],
    ...overrides,
  };
}

export function createMockQuizAttempt(overrides?: Partial<QuizAttempt>): QuizAttempt {
  return {
    id: 'attempt-1',
    quiz_id: 'quiz-1',
    attempt_number: 1,
    started_at: '2026-02-12T10:00:00Z',
    submitted_at: null,
    score: null,
    passed: null,
    ...overrides,
  };
}

export function createMockQuizGradeResult(overrides?: Partial<QuizGradeResult>): QuizGradeResult {
  return {
    score: 80,
    passed: true,
    earned_points: 4,
    total_points: 5,
    ...overrides,
  };
}

export function createMockQuizQuestionResult(overrides?: Partial<QuizQuestionResult>): QuizQuestionResult {
  return {
    question_id: 'q-1',
    question_text: 'What is 2 + 2?',
    question_type: 'single_choice',
    points: 1,
    correct_answer: null,
    user_answer: 'o-2',
    options: [
      { id: 'o-1', option_text: '3', is_correct: false },
      { id: 'o-2', option_text: '4', is_correct: true },
      { id: 'o-3', option_text: '5', is_correct: false },
    ],
    ...overrides,
  };
}

export function createMockQuizResults(overrides?: Partial<QuizResults>): QuizResults {
  return {
    attempt: createMockQuizAttempt({ submitted_at: '2026-02-12T10:10:00Z', score: 80, passed: true }),
    grade: createMockQuizGradeResult(),
    questions: [createMockQuizQuestionResult()],
    ...overrides,
  };
}

// Phase 5C: Exam Taking factories

export function createMockExamTakingData(overrides?: Partial<ExamTakingData>): ExamTakingData {
  return {
    id: 'exam-1',
    title: 'Test Exam',
    description: 'A test exam for learners',
    duration_minutes: 60,
    passing_score: 70,
    max_file_size: 52428800,
    allowed_file_types: ['application/pdf', 'application/zip'],
    exam_file_url: 'https://storage.supabase.co/signed-exam-file.pdf',
    ...overrides,
  };
}

export function createMockExamSubmission(overrides?: Partial<ExamSubmission>): ExamSubmission {
  return {
    id: 'sub-1',
    exam_id: 'exam-1',
    file_url: 'https://storage.supabase.co/signed-submission.pdf',
    submitted_at: '2026-02-13T10:30:00Z',
    deadline: '2026-02-13T11:30:00Z',
    score: null,
    feedback: null,
    graded_by: null,
    graded_at: null,
    ...overrides,
  };
}

// Phase 5D: Exam Grading factories

export function createMockGradingSubmission(overrides?: Partial<GradingSubmission>): GradingSubmission {
  return {
    id: 'sub-1',
    user_id: 'learner-1',
    tenant_id: 'tenant-1',
    exam_id: 'exam-1',
    course_id: 'course-1',
    file_url: 'https://storage.supabase.co/signed-submission.pdf',
    file_storage_path: 'course-1/learner-1/1707840600000-submission.pdf',
    submitted_at: '2026-02-13T10:30:00Z',
    deadline: '2026-02-13T11:30:00Z',
    score: null,
    feedback: null,
    graded_by: null,
    graded_at: null,
    learner_email: 'learner@test.com',
    learner_name: 'Test Learner',
    course_title: 'Test Course',
    exam_title: 'Final Exam',
    passing_score: 70,
    ...overrides,
  };
}

export function createMockExamGradingService(options?: {
  submissions?: GradingSubmission[];
  courses?: GradingCourseSummary[];
  loading?: boolean;
  error?: string;
}) {
  const submissions = signal<GradingSubmission[]>(options?.submissions ?? []);
  const courses = signal<GradingCourseSummary[]>(options?.courses ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    submissions: submissions.asReadonly(),
    courses: courses.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadGradingData: vi.fn().mockResolvedValue(undefined),
    gradeSubmission: vi.fn().mockResolvedValue(undefined),
    resetSubmission: vi.fn().mockResolvedValue(undefined),
    _setSubmissions: submissions.set.bind(submissions),
    _setCourses: courses.set.bind(courses),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockExamGradingService = ReturnType<typeof createMockExamGradingService>;

// ---------------------------------------------------------------------------
// Comment mocks
// ---------------------------------------------------------------------------

import { Comment, CommentReply, BadgeType } from '../core/models/comment.model';

export function createMockCommentReply(overrides?: Partial<CommentReply>): CommentReply {
  return {
    id: 'reply-1',
    comment_id: 'comment-1',
    user_id: 'user-2',
    tenant_id: 'tenant-1',
    body: 'This is a reply',
    badge_type: null,
    created_at: '2026-02-01T12:00:00Z',
    updated_at: '2026-02-01T12:00:00Z',
    author: { full_name: 'Reply Author', email: 'reply@example.com' },
    ...overrides,
  };
}

export function createMockComment(overrides?: Partial<Comment>): Comment {
  return {
    id: 'comment-1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    module_id: 'module-1',
    body: 'This is a comment',
    badge_type: null,
    created_at: '2026-02-01T10:00:00Z',
    updated_at: '2026-02-01T10:00:00Z',
    author: { full_name: 'Test User', email: 'test@example.com' },
    replies: [],
    ...overrides,
  };
}

export function createMockCommentService(options?: {
  comments?: Comment[];
  loading?: boolean;
  error?: string;
}) {
  const comments = signal<Comment[]>(options?.comments ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    comments: comments.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadComments: vi.fn().mockResolvedValue(undefined),
    addComment: vi.fn().mockResolvedValue(undefined),
    updateComment: vi.fn().mockResolvedValue(undefined),
    deleteComment: vi.fn().mockResolvedValue(undefined),
    addReply: vi.fn().mockResolvedValue(undefined),
    updateReply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    _setComments: comments.set.bind(comments),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockCommentService = ReturnType<typeof createMockCommentService>;
