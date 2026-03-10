import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { DeferBlockState } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { ModuleViewerPageComponent } from './module-viewer-page.component';
import { CourseService } from '../../../core/services/course.service';
import { BunnyUploadService } from '../../../core/services/bunny-upload.service';
import { createMockCourseService, createMockCourseDetail, createMockModuleViewerData, createMockModuleVideo, createMockModulePdf, createMockModuleMarkdown, createMockExternalQuizContent, createMockModuleAudio, createMockModuleDownload, createMockCommentService, createMockExpertQuestionService, createMockIssueService, MockCourseService } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { RouterLink } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { VideoViewerComponent } from '../components/video-viewer.component';
import { MockPdfViewerComponent } from '../../../__mocks__/pdf-viewer.mock';
import { MarkdownViewerComponent } from '../components/markdown-viewer.component';
import { ModuleFilesListComponent } from '../components/module-files-list.component';
import { ExternalQuizViewerComponent } from '../components/external-quiz-viewer.component';
import { QuizTakerComponent } from '../components/quiz-taker.component';
import { ExamTakerComponent } from '../components/exam-taker.component';
import { MockAudioViewerComponent } from '../../../__mocks__/audio-viewer.mock';
import { DownloadViewerComponent } from '../components/download-viewer.component';
import { CommentSectionComponent } from '../components/comment-section.component';
import { AskExpertComponent } from '../components/ask-expert.component';
import { ReportIssueComponent } from '../components/report-issue.component';
import { ModuleNotesComponent } from '../components/module-notes.component';
import { KnowledgeCheckSectionComponent } from '../components/knowledge-check-section.component';
import { KnowledgeCheckService } from '../../../core/services/knowledge-check.service';
import { createMockKnowledgeCheckService } from '../../../__mocks__/knowledge-check.mock';
import { CommentService } from '../../../core/services/comment.service';
import { ExpertQuestionService } from '../../../core/services/expert-question.service';
import { IssueService } from '../../../core/services/issue.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';

function createMockBunnyUploadService() {
  return {
    uploading: signal(false),
    progress: signal(0),
    error: signal(''),
    uploadedVideoId: signal<string | null>(null),
    uploadedLibraryId: signal(0),
    initAndUpload: vi.fn(),
    pollStatus: vi.fn().mockReturnValue(EMPTY),
    abort: vi.fn(),
    reset: vi.fn(),
  };
}

describe('ModuleViewerPageComponent', () => {
  let mockCourseService: MockCourseService;
  // BehaviorSubject emits synchronously, matching real ActivatedRoute.paramMap behavior.
  // This lets us simulate in-app navigation (param changes) without full page reloads.
  let paramMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  beforeEach(() => {
    mockCourseService = createMockCourseService();
    paramMap$ = new BehaviorSubject(
      convertToParamMap({ courseId: 'course-1', moduleId: 'mod-1' }),
    );
  });

  const renderPage = async (options?: {
    viewer?: ReturnType<typeof createMockModuleViewerData> | null;
    isEnrolled?: boolean;
  }) => {
    if (options?.viewer !== undefined) {
      mockCourseService._setModuleViewer(options.viewer);
    }
    // canMarkComplete now checks courseDetail().isEnrolled — set default enrolled=true
    if (options?.isEnrolled !== undefined || options?.viewer !== undefined) {
      mockCourseService._setCourseDetail(createMockCourseDetail({ isEnrolled: options?.isEnrolled ?? true }));
    }
    return render(ModuleViewerPageComponent, {
      componentImports: [MockLucideIconComponent, RouterLink, VideoViewerComponent, MockPdfViewerComponent, MarkdownViewerComponent, ExternalQuizViewerComponent, ModuleFilesListComponent, QuizTakerComponent, ExamTakerComponent, MockAudioViewerComponent, DownloadViewerComponent, CommentSectionComponent, AskExpertComponent, ReportIssueComponent, ModuleNotesComponent, KnowledgeCheckSectionComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: mockCourseService },
        { provide: BunnyUploadService, useValue: createMockBunnyUploadService() },
        { provide: CommentService, useValue: createMockCommentService() },
        { provide: ExpertQuestionService, useValue: createMockExpertQuestionService() },
        { provide: IssueService, useValue: createMockIssueService() },
        { provide: AuthService, useValue: createMockAuthService() },
        { provide: SupabaseService, useValue: createMockSupabaseService() },
        { provide: KnowledgeCheckService, useValue: createMockKnowledgeCheckService() },
        // Provide paramMap as an observable — the component uses toSignal(route.paramMap)
        // to reactively respond to route param changes (e.g. Next/Previous navigation).
        { provide: ActivatedRoute, useValue: { paramMap: paramMap$ } },
        provideMarkdown(),
      ],
    });
  };

  it('should show loading skeleton', async () => {
    mockCourseService._setLoading(true);
    const { container } = await renderPage();
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('should show error message', async () => {
    mockCourseService._setError('Something went wrong');
    await renderPage();
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('should render video viewer for video module', async () => {
    const viewer = createMockModuleViewerData({
      content: { type: 'video', data: createMockModuleVideo() },
    });
    await renderPage({ viewer });

    expect(screen.getByText('Test Module')).toBeTruthy();
    // VideoViewerComponent shows loading/processing state (no <video> element — uses iframe embed)
    expect(screen.getByText('Duration: 6:00')).toBeTruthy();
  });

  it('should render pdf viewer for pdf module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'PDF Module', description: null, module_type: 'pdf', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'pdf', data: createMockModulePdf() },
    });
    await renderPage({ viewer });

    expect(screen.getByText('PDF Module')).toBeTruthy();
    expect(screen.getByTestId('mock-pdf-viewer')).toBeTruthy();
  });

  it('should render markdown viewer for markdown module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'MD Module', description: null, module_type: 'markdown', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'markdown', data: createMockModuleMarkdown() },
    });
    await renderPage({ viewer });

    expect(screen.getByText('MD Module')).toBeTruthy();
    expect(document.querySelector('.prose')).toBeTruthy();
  });

  it('should render external quiz viewer for external_quiz module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'External Quiz Module', description: null, module_type: 'external_quiz', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'external_quiz', data: createMockExternalQuizContent() },
    });
    await renderPage({ viewer });

    expect(screen.getByText('External Quiz Module')).toBeTruthy();
    expect(screen.getByText('Take External Quiz')).toBeTruthy();
  });

  it('should show mark complete button for external_quiz module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'EQ', description: null, module_type: 'external_quiz', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'external_quiz', data: createMockExternalQuizContent() },
    });
    await renderPage({ viewer });

    // Top + bottom action bars both show the button
    expect(screen.getAllByText('Mark as complete').length).toBe(2);
  });

  it('should render quiz taker for quiz module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Quiz Module', description: null, module_type: 'quiz', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'quiz', data: null },
    });
    await renderPage({ viewer });

    expect(screen.getByText('Quiz Module')).toBeTruthy();
    expect(document.querySelector('app-quiz-taker')).toBeTruthy();
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('should show navigation buttons', async () => {
    const viewer = createMockModuleViewerData({
      navigation: {
        prev: { id: 'mod-0', title: 'Prev', module_type: 'video', lectureTitle: 'L1' },
        next: { id: 'mod-2', title: 'Next', module_type: 'pdf', lectureTitle: 'L1' },
        current: 2,
        total: 3,
      },
    });
    await renderPage({ viewer });

    // Top + bottom bars both show Previous/Next
    expect(screen.getAllByText('Previous').length).toBe(2);
    expect(screen.getAllByText('Next').length).toBe(2);
    expect(screen.getByText('2 of 3 modules')).toBeTruthy();
  });

  // canMarkComplete() only returns true for video/pdf/markdown — quiz and exam
  // modules use their own completion mechanisms (grading, submissions).
  it('should show mark complete button for video/pdf/markdown', async () => {
    const viewer = createMockModuleViewerData(); // video type, no progress
    await renderPage({ viewer });

    // Top + bottom action bars both show the button
    expect(screen.getAllByText('Mark as complete').length).toBe(2);
  });

  it('should show completed state when already done', async () => {
    const viewer = createMockModuleViewerData({
      progress: { status: 'completed', completed_at: '2026-02-01T00:00:00Z', notes: null },
    });
    await renderPage({ viewer });

    // Top + bottom bars both show completed badge
    expect(screen.getAllByText('Completed').length).toBe(2);
    expect(screen.queryByText('Mark as complete')).toBeNull();
  });

  it('should hide mark complete for quiz modules', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Quiz', description: null, module_type: 'quiz', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'quiz', data: null },
    });
    await renderPage({ viewer });

    expect(screen.queryByText('Mark as complete')).toBeNull();
  });

  // The component uses toSignal(route.paramMap) + effect() so that loadModuleViewer
  // fires on initial render. This replaced the old ngOnInit approach.
  it('should call loadModuleViewer on init', async () => {
    await renderPage();

    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledWith('course-1', 'mod-1');
  });

  // BUG FIX TEST: Previously the component used snapshot.paramMap.get() in ngOnInit,
  // which is a ONE-TIME read. When Angular reuses the component for same-route
  // navigation (clicking Next/Previous), ngOnInit doesn't fire again and the
  // viewer shows stale content. The fix uses toSignal(route.paramMap) + effect()
  // to reactively re-load when the route params change.
  it('should reload module viewer when route params change (client-side navigation)', async () => {
    const { fixture } = await renderPage();

    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledWith('course-1', 'mod-1');
    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledTimes(1);

    // Simulate clicking "Next" — Angular changes the URL params but reuses the component
    paramMap$.next(convertToParamMap({ courseId: 'course-1', moduleId: 'mod-2' }));

    // Flush the effect (zoneless change detection needs a microtask tick)
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledWith('course-1', 'mod-2');
    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledTimes(2);
  });

  it('should NOT reload module viewer on quiz completion (preserves results view)', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Quiz', description: null, module_type: 'quiz', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'quiz', data: null },
    });
    const { fixture } = await renderPage({ viewer });

    // Initial load from effect
    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledTimes(1);

    // onQuizCompleted is now a no-op — reloading destroys the quiz-taker
    fixture.componentInstance.onQuizCompleted();

    // Should NOT reload (would destroy quiz results)
    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledTimes(1);
  });

  // --- Enrollment gating tests ---

  it('should hide mark complete when not enrolled', async () => {
    const viewer = createMockModuleViewerData(); // video type
    await renderPage({ viewer, isEnrolled: false });

    expect(screen.queryByText('Mark as complete')).toBeNull();
  });

  it('should show mark complete when enrolled + eligible type', async () => {
    const viewer = createMockModuleViewerData(); // video type, no progress
    await renderPage({ viewer, isEnrolled: true });

    expect(screen.getAllByText('Mark as complete').length).toBe(2);
  });

  // --- Exam integration tests ---

  it('should render exam taker for exam module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Exam Module', description: null, module_type: 'exam', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'exam', data: { title: 'Test Exam', description: null, duration_minutes: 60, passing_score: 70, max_file_size: 52428800, allowed_file_types: ['application/pdf'], exam_file_url: null } },
    });
    await renderPage({ viewer });

    expect(screen.getByText('Exam Module')).toBeTruthy();
    expect(document.querySelector('app-exam-taker')).toBeTruthy();
    expect(screen.queryByText('Coming soon')).toBeNull();
  });

  it('should hide mark complete for exam modules', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Exam', description: null, module_type: 'exam', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'exam', data: { title: 'Test Exam', description: null, duration_minutes: 60, passing_score: 70, max_file_size: 52428800, allowed_file_types: ['application/pdf'], exam_file_url: null } },
    });
    await renderPage({ viewer });

    expect(screen.queryByText('Mark as complete')).toBeNull();
  });

  // --- Ask Expert integration ---

  it('should render ask expert component when module is loaded', async () => {
    const viewer = createMockModuleViewerData();
    const { fixture } = await renderPage({ viewer });

    const deferBlocks = await fixture.getDeferBlocks();
    for (const block of deferBlocks) {
      await block.render(DeferBlockState.Complete);
    }

    expect(document.querySelector('app-ask-expert')).toBeTruthy();
  });

  // --- Comment section integration ---

  it('should render comment section when module is loaded', async () => {
    const viewer = createMockModuleViewerData();
    const { fixture } = await renderPage({ viewer });

    const deferBlocks = await fixture.getDeferBlocks();
    for (const block of deferBlocks) {
      await block.render(DeferBlockState.Complete);
    }

    expect(document.querySelector('app-comment-section')).toBeTruthy();
  });

  // --- Report issue integration ---

  it('should render report issue component when module is loaded', async () => {
    const viewer = createMockModuleViewerData();
    const { fixture } = await renderPage({ viewer });

    const deferBlocks = await fixture.getDeferBlocks();
    for (const block of deferBlocks) {
      await block.render(DeferBlockState.Complete);
    }

    expect(document.querySelector('app-report-issue')).toBeTruthy();
  });

  it('should NOT reload module viewer on exam completion', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Exam', description: null, module_type: 'exam', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'exam', data: { title: 'Test Exam', description: null, duration_minutes: 60, passing_score: 70, max_file_size: 52428800, allowed_file_types: ['application/pdf'], exam_file_url: null } },
    });
    const { fixture } = await renderPage({ viewer });

    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledTimes(1);

    fixture.componentInstance.onExamCompleted();

    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledTimes(1);
  });

  // --- Audio viewer integration ---

  it('should render audio viewer for audio module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Audio Lesson', description: null, module_type: 'audio', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'audio', data: createMockModuleAudio() },
    });
    await renderPage({ viewer });

    expect(screen.getByText('Audio Lesson')).toBeTruthy();
    expect(document.querySelector('app-audio-viewer')).toBeTruthy();
  });

  it('should show mark complete for audio module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Audio', description: null, module_type: 'audio', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'audio', data: createMockModuleAudio() },
    });
    await renderPage({ viewer });

    expect(screen.getAllByText('Mark as complete').length).toBe(2);
  });

  // --- Download viewer integration ---

  it('should render download viewer for download module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Resources Pack', description: 'Download files', module_type: 'download', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'download', data: createMockModuleDownload() },
    });
    await renderPage({ viewer });

    expect(screen.getByText('Resources Pack')).toBeTruthy();
    expect(document.querySelector('app-download-viewer')).toBeTruthy();
  });

  it('should show mark complete for download module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Download', description: null, module_type: 'download', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'download', data: createMockModuleDownload() },
    });
    await renderPage({ viewer });

    expect(screen.getAllByText('Mark as complete').length).toBe(2);
  });

  // --- Module Notes integration ---

  it('should show notes panel when enrolled', async () => {
    const viewer = createMockModuleViewerData();
    await renderPage({ viewer, isEnrolled: true });

    expect(screen.getByText('My Notes')).toBeTruthy();
  });

  it('should hide notes panel when not enrolled', async () => {
    const viewer = createMockModuleViewerData();
    await renderPage({ viewer, isEnrolled: false });

    expect(screen.queryByText('My Notes')).toBeNull();
  });

  it('should pass initial notes to notes component', async () => {
    const viewer = createMockModuleViewerData({
      progress: { status: 'in_progress', completed_at: null, notes: 'Test note content' },
    });
    await renderPage({ viewer, isEnrolled: true });

    expect(screen.getByText('My Notes')).toBeTruthy();
    // The "Has notes" badge should appear since there are notes and panel starts collapsed
    expect(screen.getByText('Has notes')).toBeTruthy();
  });
});
