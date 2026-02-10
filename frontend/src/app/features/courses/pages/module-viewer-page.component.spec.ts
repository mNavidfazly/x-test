import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ModuleViewerPageComponent } from './module-viewer-page.component';
import { CourseService } from '../../../core/services/course.service';
import { createMockCourseService, createMockModuleViewerData, createMockModuleVideo, createMockModulePdf, createMockModuleMarkdown, MockCourseService } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { RouterLink } from '@angular/router';
import { provideMarkdown } from 'ngx-markdown';
import { VideoViewerComponent } from '../components/video-viewer.component';
import { PdfViewerComponent } from '../components/pdf-viewer.component';
import { MarkdownViewerComponent } from '../components/markdown-viewer.component';
import { ModuleFilesListComponent } from '../components/module-files-list.component';

describe('ModuleViewerPageComponent', () => {
  let mockCourseService: MockCourseService;

  const mockRoute = {
    snapshot: {
      paramMap: {
        get: (key: string) => {
          if (key === 'courseId') return 'course-1';
          if (key === 'moduleId') return 'mod-1';
          return null;
        },
      },
    },
  };

  beforeEach(() => {
    mockCourseService = createMockCourseService();
  });

  const renderPage = async (options?: { viewer?: ReturnType<typeof createMockModuleViewerData> | null }) => {
    if (options?.viewer !== undefined) {
      mockCourseService._setModuleViewer(options.viewer);
    }
    return render(ModuleViewerPageComponent, {
      componentImports: [MockLucideIconComponent, RouterLink, VideoViewerComponent, PdfViewerComponent, MarkdownViewerComponent, ModuleFilesListComponent],
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: mockCourseService },
        { provide: ActivatedRoute, useValue: mockRoute },
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
    expect(document.querySelector('video')).toBeTruthy();
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

  it('should show coming soon for quiz module', async () => {
    const viewer = createMockModuleViewerData({
      module: { id: 'mod-1', title: 'Quiz Module', description: null, module_type: 'quiz', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'quiz', data: null },
    });
    await renderPage({ viewer });

    expect(screen.getByText('Coming soon')).toBeTruthy();
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

  it('should call loadModuleViewer on init', async () => {
    await renderPage();

    expect(mockCourseService.loadModuleViewer).toHaveBeenCalledWith('course-1', 'mod-1');
  });
});
