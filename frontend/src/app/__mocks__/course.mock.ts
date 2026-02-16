import { signal } from '@angular/core';
import { vi } from 'vitest';
import {
  CourseWithProgress, CourseDetail, CourseLecturer, ModuleViewerData,
  ModuleVideo, ModulePdf, ModuleMarkdownContent, ModuleFile,
  ModuleAudio, ModuleDownload, AudioFormData, DownloadFormData,
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
    saveModuleNotes: vi.fn().mockResolvedValue(undefined),
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
      module: { id: 'mod-1', title: 'Test Module', description: null, module_type: 'video', sort_order: 0, lecture_id: 'lecture-1', course_id: 'course-1', estimated_duration_minutes: 15 },
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
    uploadThumbnail: vi.fn().mockResolvedValue('course-1/thumbnail-123.jpg'),
    deleteThumbnailIfStoragePath: vi.fn().mockResolvedValue(undefined),
    getCourseThumbnailSignedUrl: vi.fn().mockResolvedValue('https://test.supabase.co/storage/v1/object/sign/course-files/course-1/thumbnail-123.jpg?token=abc'),
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
    totalDurationMinutes: 150,
    lecturers: [],
    nextModuleId: null,
    nextModuleTitle: null,
    nextModuleType: null,
    nextLectureTitle: null,
    ...overrides,
  };
}

export function createMockCourseLecturer(overrides?: Partial<CourseLecturer>): CourseLecturer {
  return {
    user_id: 'lecturer-1',
    full_name: 'Jane Doe',
    email: 'jane.doe@calypso-commodities.com',
    avatar_url: null,
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
          { id: 'mod-1', title: 'Module 1', description: null, module_type: 'video', sort_order: 0, estimated_duration_minutes: 30 },
          { id: 'mod-2', title: 'Module 2', description: null, module_type: 'pdf', sort_order: 1, estimated_duration_minutes: 15 },
        ],
      },
      {
        id: 'lecture-2',
        title: 'Lecture 2',
        description: 'Second lecture',
        sort_order: 1,
        modules: [
          { id: 'mod-3', title: 'Module 3', description: null, module_type: 'quiz', sort_order: 0, estimated_duration_minutes: 20 },
        ],
      },
    ],
    progressMap: {
      'mod-1': { status: 'completed', completed_at: '2026-01-15T10:00:00Z', notes: null },
      'mod-2': { status: 'in_progress', completed_at: null, notes: null },
    },
    lecturers: [],
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

export function createMockModuleAudio(overrides?: Partial<ModuleAudio>): ModuleAudio {
  return {
    file_url: 'https://storage.supabase.co/test-audio.mp3',
    file_name: 'test-audio.mp3',
    file_size: 5242880,
    duration_seconds: 300,
    mime_type: 'audio/mpeg',
    ...overrides,
  };
}

export function createMockAudioFormData(overrides?: Partial<AudioFormData>): AudioFormData {
  return {
    file_url: 'course-1/1707840600000-test-audio.mp3',
    file_name: 'test-audio.mp3',
    file_size: 5242880,
    duration_seconds: 300,
    mime_type: 'audio/mpeg',
    ...overrides,
  };
}

export function createMockModuleDownload(overrides?: Partial<ModuleDownload>): ModuleDownload {
  return {
    file_url: 'https://storage.supabase.co/test-resources.zip',
    file_name: 'resources.zip',
    file_size: 52428800,
    ...overrides,
  };
}

export function createMockDownloadFormData(overrides?: Partial<DownloadFormData>): DownloadFormData {
  return {
    file_url: 'course-1/1707840600000-resources.zip',
    file_name: 'resources.zip',
    file_size: 52428800,
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
      estimated_duration_minutes: 30,
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
    estimated_duration_minutes: 15,
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
        explanation: null,
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
        explanation: null,
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
    explanation: null,
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

// ---------------------------------------------------------------------------
// Expert Question mocks
// ---------------------------------------------------------------------------

import { ExpertQuestion, ExpertQuestionForBoard, BoardCourseSummary } from '../core/models/expert-question.model';

export function createMockExpertQuestion(overrides?: Partial<ExpertQuestion>): ExpertQuestion {
  return {
    id: 'eq-1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    course_id: 'course-1',
    module_id: 'mod-1',
    question_text: 'How does this concept apply in practice?',
    status: 'pending',
    response_text: null,
    responded_by: null,
    responded_at: null,
    created_at: '2026-02-10T10:00:00Z',
    course: { title: 'Test Course' },
    module: { title: 'Test Module' },
    responder: null,
    ...overrides,
  };
}

export function createMockExpertQuestionForBoard(overrides?: Partial<ExpertQuestionForBoard>): ExpertQuestionForBoard {
  return {
    id: 'eq-1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    course_id: 'course-1',
    module_id: 'mod-1',
    question_text: 'How does this concept apply in practice?',
    status: 'pending',
    response_text: null,
    responded_by: null,
    responded_at: null,
    created_at: '2026-02-10T10:00:00Z',
    course: { title: 'Test Course' },
    module: { title: 'Test Module' },
    asker: { full_name: 'Test Learner', email: 'learner@test.com' },
    ...overrides,
  };
}

export function createMockExpertQuestionService(options?: {
  questions?: ExpertQuestion[];
  loading?: boolean;
  error?: string;
  boardQuestions?: ExpertQuestionForBoard[];
  boardCourses?: BoardCourseSummary[];
  boardLoading?: boolean;
  boardError?: string;
}) {
  const questions = signal<ExpertQuestion[]>(options?.questions ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');
  const boardQuestions = signal<ExpertQuestionForBoard[]>(options?.boardQuestions ?? []);
  const boardCourses = signal<BoardCourseSummary[]>(options?.boardCourses ?? []);
  const boardLoading = signal(options?.boardLoading ?? false);
  const boardError = signal(options?.boardError ?? '');

  return {
    questions: questions.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadMyQuestions: vi.fn().mockResolvedValue(undefined),
    askQuestion: vi.fn().mockResolvedValue(undefined),
    boardQuestions: boardQuestions.asReadonly(),
    boardCourses: boardCourses.asReadonly(),
    boardLoading: boardLoading.asReadonly(),
    boardError: boardError.asReadonly(),
    loadBoardQuestions: vi.fn().mockResolvedValue(undefined),
    respondToQuestion: vi.fn().mockResolvedValue(undefined),
    closeQuestion: vi.fn().mockResolvedValue(undefined),
    _setQuestions: questions.set.bind(questions),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
    _setBoardQuestions: boardQuestions.set.bind(boardQuestions),
    _setBoardCourses: boardCourses.set.bind(boardCourses),
    _setBoardLoading: boardLoading.set.bind(boardLoading),
    _setBoardError: boardError.set.bind(boardError),
  };
}

export type MockExpertQuestionService = ReturnType<typeof createMockExpertQuestionService>;

// ---------------------------------------------------------------------------
// Issue mocks
// ---------------------------------------------------------------------------
import { Issue, IssueForBoard, BoardIssueSummary } from '../core/models/issue.model';

export function createMockIssue(overrides?: Partial<Issue>): Issue {
  return {
    id: 'issue-1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    course_id: 'course-1',
    module_id: 'mod-1',
    description: 'There is a typo in the formula on slide 3.',
    issue_type: 'content_error',
    status: 'open',
    resolved_at: null,
    resolved_by: null,
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
    course: { title: 'Test Course' },
    module: { title: 'Test Module' },
    ...overrides,
  };
}

export function createMockIssueForBoard(overrides?: Partial<IssueForBoard>): IssueForBoard {
  return {
    id: 'issue-1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    course_id: 'course-1',
    module_id: 'mod-1',
    description: 'There is a typo in the formula on slide 3.',
    issue_type: 'content_error',
    status: 'open',
    internal_notes: null,
    resolved_at: null,
    resolved_by: null,
    created_at: '2026-02-10T10:00:00Z',
    updated_at: '2026-02-10T10:00:00Z',
    course: { title: 'Test Course' },
    module: { title: 'Test Module' },
    reporter: { full_name: 'Test Learner', email: 'learner@test.com' },
    ...overrides,
  };
}

export function createMockIssueService(options?: {
  issues?: Issue[];
  loading?: boolean;
  error?: string;
  boardIssues?: IssueForBoard[];
  boardCourses?: BoardIssueSummary[];
  boardLoading?: boolean;
  boardError?: string;
}) {
  const issues = signal<Issue[]>(options?.issues ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  const boardIssues = signal<IssueForBoard[]>(options?.boardIssues ?? []);
  const boardCourses = signal<BoardIssueSummary[]>(options?.boardCourses ?? []);
  const boardLoading = signal(options?.boardLoading ?? false);
  const boardError = signal(options?.boardError ?? '');

  return {
    // Learner signals + methods
    issues: issues.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadMyIssues: vi.fn().mockResolvedValue(undefined),
    reportIssue: vi.fn().mockResolvedValue(undefined),
    _setIssues: issues.set.bind(issues),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
    // Board signals + methods
    boardIssues: boardIssues.asReadonly(),
    boardCourses: boardCourses.asReadonly(),
    boardLoading: boardLoading.asReadonly(),
    boardError: boardError.asReadonly(),
    loadBoardIssues: vi.fn().mockResolvedValue(undefined),
    updateIssue: vi.fn().mockResolvedValue(undefined),
    _setBoardIssues: boardIssues.set.bind(boardIssues),
    _setBoardCourses: boardCourses.set.bind(boardCourses),
    _setBoardLoading: boardLoading.set.bind(boardLoading),
    _setBoardError: boardError.set.bind(boardError),
  };
}

export type MockIssueService = ReturnType<typeof createMockIssueService>;

// ---------------------------------------------------------------------------
// Notification mocks
// ---------------------------------------------------------------------------

import { AppNotification } from '../core/models/notification.model';

export function createMockNotification(overrides?: Partial<AppNotification>): AppNotification {
  return {
    id: 'notif-1',
    user_id: 'user-1',
    tenant_id: 'tenant-1',
    type: 'course_assigned',
    title: 'New course assigned',
    body: 'You have been assigned to Test Course',
    data: { course_id: 'course-1' },
    read_at: null,
    created_at: '2026-02-10T10:00:00Z',
    ...overrides,
  };
}

export function createMockNotificationService(options?: {
  notifications?: AppNotification[];
  loading?: boolean;
  error?: string;
  unreadCount?: number;
  latestToast?: AppNotification | null;
}) {
  const notifications = signal<AppNotification[]>(options?.notifications ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');
  const unreadCount = signal(options?.unreadCount ?? 0);
  const latestToast = signal<AppNotification | null>(options?.latestToast ?? null);

  return {
    notifications: notifications.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    unreadCount: unreadCount.asReadonly(),
    latestToast: latestToast.asReadonly(),
    loadNotifications: vi.fn().mockResolvedValue(undefined),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
    dismissToast: vi.fn(),
    _setNotifications: notifications.set.bind(notifications),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
    _setUnreadCount: unreadCount.set.bind(unreadCount),
    _setLatestToast: latestToast.set.bind(latestToast),
  };
}

export type MockNotificationService = ReturnType<typeof createMockNotificationService>;

// ---------------------------------------------------------------------------
// Tenant Management mocks
// ---------------------------------------------------------------------------

import {
  TenantForBoard, TenantCourseAssignment, CsmAssignment,
  AvailableCourse, AvailableCsm,
} from '../core/models/tenant-management.model';

export function createMockTenantForBoard(overrides?: Partial<TenantForBoard>): TenantForBoard {
  return {
    id: 'tenant-1',
    name: 'Test Tenant',
    domain: 'test.com',
    is_master: false,
    settings: { auth_methods: ['email_password'] },
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    courseCount: 3,
    csmCount: 1,
    ...overrides,
  };
}

export function createMockTenantCourseAssignment(overrides?: Partial<TenantCourseAssignment>): TenantCourseAssignment {
  return {
    id: 'tc-1',
    course_id: 'course-1',
    course_title: 'Test Course',
    ...overrides,
  };
}

export function createMockCsmAssignment(overrides?: Partial<CsmAssignment>): CsmAssignment {
  return {
    id: 'csa-1',
    user_id: 'user-1',
    email: 'csm@calypso.com',
    full_name: 'CSM User',
    assigned_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockTenantManagementService(options?: {
  tenants?: TenantForBoard[];
  loading?: boolean;
  error?: string;
}) {
  const tenants = signal<TenantForBoard[]>(options?.tenants ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    tenants: tenants.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadTenants: vi.fn().mockResolvedValue(undefined),
    createTenant: vi.fn().mockResolvedValue(undefined),
    updateTenant: vi.fn().mockResolvedValue(undefined),
    deleteTenant: vi.fn().mockResolvedValue(undefined),
    loadTenantCourses: vi.fn().mockResolvedValue([]),
    loadAvailableCourses: vi.fn().mockResolvedValue([]),
    assignCourseToTenant: vi.fn().mockResolvedValue(undefined),
    removeCourseFromTenant: vi.fn().mockResolvedValue(undefined),
    loadCsmAssignments: vi.fn().mockResolvedValue([]),
    loadAvailableCsms: vi.fn().mockResolvedValue([]),
    assignCsm: vi.fn().mockResolvedValue(undefined),
    removeCsm: vi.fn().mockResolvedValue(undefined),
    loadAvailableTenantsList: vi.fn().mockResolvedValue([]),
    _setTenants: tenants.set.bind(tenants),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockTenantManagementService = ReturnType<typeof createMockTenantManagementService>;

// ---------------------------------------------------------------------------
// User Management mocks
// ---------------------------------------------------------------------------

import { UserForBoard } from '../core/models/user-management.model';
import { UserManagementService } from '../core/services/user-management.service';

export function createMockUserForBoard(overrides?: Partial<UserForBoard>): UserForBoard {
  return {
    id: 'user-1',
    email: 'alice@test.com',
    full_name: 'Alice Test',
    avatar_url: null,
    is_tenant_admin: false,
    is_platform_admin: false,
    tenant_id: 'tenant-1',
    tenant_name: 'Test Tenant',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-02-01T00:00:00Z',
    ...overrides,
  };
}

export function createMockUserManagementService(options?: {
  users?: UserForBoard[];
  loading?: boolean;
  error?: string;
}) {
  const users = signal<UserForBoard[]>(options?.users ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    users: users.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadUsers: vi.fn().mockResolvedValue(undefined),
    inviteUser: vi.fn().mockResolvedValue(undefined),
    updateUserRoles: vi.fn().mockResolvedValue(undefined),
    updateUserProfile: vi.fn().mockResolvedValue(undefined),
    _setUsers: users.set.bind(users),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockUserManagementService = ReturnType<typeof createMockUserManagementService>;

// ---------------------------------------------------------------------------
// Access Request mocks
// ---------------------------------------------------------------------------

import { AccessRequestForBoard } from '../core/models/access-request.model';
import { AccessRequestService } from '../core/services/access-request.service';

export function createMockAccessRequestForBoard(overrides?: Partial<AccessRequestForBoard>): AccessRequestForBoard {
  return {
    id: 'req-1',
    email: 'requester@client.com',
    full_name: 'Test Requester',
    domain: 'client.com',
    tenant_id: 'tenant-1',
    tenant_name: 'Client Corp',
    status: 'pending',
    reviewed_by: null,
    reviewer_name: null,
    reviewed_at: null,
    review_notes: null,
    created_at: '2026-02-01T10:00:00Z',
    ...overrides,
  };
}

export function createMockAccessRequestService(options?: {
  requests?: AccessRequestForBoard[];
  loading?: boolean;
  error?: string;
}) {
  const requests = signal<AccessRequestForBoard[]>(options?.requests ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    requests: requests.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadRequests: vi.fn().mockResolvedValue(undefined),
    reviewRequest: vi.fn().mockResolvedValue(undefined),
    approveAndInvite: vi.fn().mockResolvedValue(undefined),
    _setRequests: requests.set.bind(requests),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockAccessRequestService = ReturnType<typeof createMockAccessRequestService>;

// --- Lecturer Assignment Mocks ---

import { LecturerAssignment } from '../core/models/lecturer-assignment.model';

export function createMockLecturerAssignment(
  overrides?: Partial<LecturerAssignment>,
): LecturerAssignment {
  return {
    id: 'assignment-1',
    user_id: 'lecturer-1',
    email: 'lecturer@master.com',
    full_name: 'Test Lecturer',
    course_id: 'course-1',
    course_title: 'Test Course',
    can_edit: false,
    can_grade: true,
    assigned_at: '2026-02-01T10:00:00Z',
    assigned_by_name: 'Platform Admin',
    ...overrides,
  };
}

export function createMockLecturerAssignmentService(options?: {
  assignments?: LecturerAssignment[];
  loading?: boolean;
  error?: string;
}) {
  const assignments = signal<LecturerAssignment[]>(options?.assignments ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    assignments: assignments.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadAssignments: vi.fn().mockResolvedValue(undefined),
    addAssignment: vi.fn().mockResolvedValue(undefined),
    removeAssignment: vi.fn().mockResolvedValue(undefined),
    updatePermissions: vi.fn().mockResolvedValue(undefined),
    loadAvailableLecturers: vi.fn().mockResolvedValue([]),
    loadAvailableCourses: vi.fn().mockResolvedValue([]),
    _setAssignments: assignments.set.bind(assignments),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockLecturerAssignmentService = ReturnType<typeof createMockLecturerAssignmentService>;

// --- Staleness ---

import { StaleCourse, StaleModule } from '../core/services/staleness.service';

export function createMockStaleModule(overrides?: Partial<StaleModule>): StaleModule {
  return {
    id: 'module-1',
    title: 'Test Module',
    moduleType: 'video',
    updatedAt: '2025-06-15T10:00:00Z',
    daysSinceUpdate: 244,
    isStale: true,
    daysOverdue: 64,
    postponedUntil: null,
    isPostponed: false,
    ...overrides,
  };
}

export function createMockStaleCourse(overrides?: Partial<StaleCourse>): StaleCourse {
  const modules = overrides?.modules ?? [createMockStaleModule()];
  return {
    id: 'course-1',
    title: 'Test Course',
    thresholdDays: 180,
    modules,
    staleModuleCount: modules.filter(m => m.isStale).length,
    freshModuleCount: modules.filter(m => !m.isStale && !m.isPostponed).length,
    totalModuleCount: modules.length,
    hasStaleModules: modules.some(m => m.isStale),
    postponedModuleCount: modules.filter(m => m.isPostponed).length,
    ...overrides,
  };
}

export function createMockStalenessService(options?: {
  courses?: StaleCourse[];
  loading?: boolean;
  error?: string;
}) {
  const courses = signal<StaleCourse[]>(options?.courses ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    courses: courses.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadStalenessData: vi.fn().mockResolvedValue(undefined),
    postponeModule: vi.fn().mockResolvedValue(undefined),
    postponeAllStaleModules: vi.fn().mockResolvedValue(undefined),
    _setCourses: courses.set.bind(courses),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockStalenessService = ReturnType<typeof createMockStalenessService>;

// ---------------------------------------------------------------------------
// Notes mocks
// ---------------------------------------------------------------------------

import { NoteWithContext } from '../core/services/notes.service';

export function createMockNoteWithContext(overrides?: Partial<NoteWithContext>): NoteWithContext {
  return {
    module_id: 'mod-1',
    course_id: 'course-1',
    notes: 'My study notes for this module',
    updated_at: '2026-02-16T10:00:00Z',
    module_title: 'Test Module',
    course_title: 'Test Course',
    lecture_title: 'Lecture 1',
    ...overrides,
  };
}

export function createMockNotesService(options?: {
  notes?: NoteWithContext[];
  loading?: boolean;
  error?: string;
}) {
  const notes = signal<NoteWithContext[]>(options?.notes ?? []);
  const loading = signal(options?.loading ?? false);
  const error = signal(options?.error ?? '');

  return {
    notes: notes.asReadonly(),
    loading: loading.asReadonly(),
    error: error.asReadonly(),
    loadMyNotes: vi.fn().mockResolvedValue(undefined),
    deleteNote: vi.fn().mockResolvedValue(undefined),
    _setNotes: notes.set.bind(notes),
    _setLoading: loading.set.bind(loading),
    _setError: error.set.bind(error),
  };
}

export type MockNotesService = ReturnType<typeof createMockNotesService>;
