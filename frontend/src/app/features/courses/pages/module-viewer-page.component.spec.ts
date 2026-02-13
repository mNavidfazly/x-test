import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { BehaviorSubject, EMPTY } from 'rxjs';
import { ModuleViewerPageComponent } from './module-viewer-page.component';
import { CourseService } from '../../../core/services/course.service';
import { BunnyUploadService } from '../../../core/services/bunny-upload.service';
import { createMockCourseService, createMockCourseDetail, createMockModuleViewerData, createMockModuleVideo, createMockModulePdf, createMockModuleMarkdown, createMockExternalQuizContent, MockCourseService } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { RouterLink } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { VideoViewerComponent } from '../components/video-viewer.component';
import { PdfViewerComponent } from '../components/pdf-viewer.component';
import { MarkdownViewerComponent } from '../components/markdown-viewer.component';
import { ModuleFilesListComponent } from '../components/module-files-list.component';
import { ExternalQuizViewerComponent } from '../components/external-quiz-viewer.component';
import { QuizTakerComponent } from '../components/quiz-taker.component';
import { ExamTakerComponent } from '../components/exam-taker.component';

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
      componentImports: [MockLucideIconComponent, RouterLink, VideoViewerComponent, PdfViewerComponent, MarkdownViewerComponent, ExternalQuizViewerComponent, ModuleFilesListComponent, QuizTakerComponent, ExamTakerComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: mockCourseService },
        { provide: BunnyUploadService, useValue: createMockBunnyUploadService() },
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
    expect(document.querySelector('iframe')).toBeTruthy();
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

    expect(screen.getByText('Mark as complete')).toBeTruthy();
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

    expect(screen.getByText('Previous')).toBeTruthy();
    expect(screen.getByText('Next')).toBeTruthy();
    expect(screen.getByText('2 of 3 modules')).toBeTruthy();
  });

  // canMarkComplete() only returns true for video/pdf/markdown — quiz and exam
  // modules use their own completion mechanisms (grading, submissions).
  it('should show mark complete button for video/pdf/markdown', async () => {
    const viewer = createMockModuleViewerData(); // video type, no progress
    await renderPage({ viewer });

    expect(screen.getByText('Mark as complete')).toBeTruthy();
  });

  it('should show completed state when already done', async () => {
    const viewer = createMockModuleViewerData({
      progress: { status: 'completed', completed_at: '2026-02-01T00:00:00Z' },
    });
    await renderPage({ viewer });

    expect(screen.getByText('Completed')).toBeTruthy();
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

    expect(screen.getByText('Mark as complete')).toBeTruthy();
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
});
