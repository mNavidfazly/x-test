import { describe, it, expect, vi } from 'vitest';
import { Component } from '@angular/core';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ModuleFormPageComponent } from './module-form-page.component';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { SupabaseService } from '../../../core/services/supabase.service';
import { VideoFormComponent } from '../components/video-form.component';
import { PdfFormComponent } from '../components/pdf-form.component';
import { ExamFormComponent } from '../components/exam-form.component';
import { MarkdownFormComponent } from '../components/markdown-form.component';
import { ModuleFilesEditorComponent } from '../components/module-files-editor.component';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { createMockCourseService } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';

@Component({ selector: 'app-dummy', template: '', standalone: true })
class DummyComponent {}

function mockActivatedRoute(
  params: Record<string, string | null>,
  queryParams: Record<string, string | null> = {},
) {
  return {
    snapshot: {
      paramMap: { get: (key: string) => params[key] ?? null },
      queryParamMap: { get: (key: string) => queryParams[key] ?? null },
    },
  };
}

const defaultImports = [MockLucideIconComponent, VideoFormComponent, PdfFormComponent, ExamFormComponent, MarkdownFormComponent, ModuleFilesEditorComponent, FileUploadComponent, FormsModule, RouterLink];

/** Helper: render in create mode (no moduleId, with courseId + lectureId) */
async function renderCreateMode(overrides?: {
  courseService?: ReturnType<typeof createMockCourseService>;
  authService?: ReturnType<typeof createMockAuthService>;
  lectureId?: string;
  courseId?: string;
}) {
  const courseService = overrides?.courseService ?? createMockCourseService();
  const authService =
    overrides?.authService ??
    createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } });
  const courseId = overrides?.courseId ?? 'course-1';
  const lectureId = overrides?.lectureId ?? 'lecture-1';

  const result = await render(ModuleFormPageComponent, {
    componentImports: defaultImports,
    providers: [
      provideRouter([]),
      { provide: CourseService, useValue: courseService },
      { provide: AuthService, useValue: authService },
      { provide: SupabaseService, useValue: createMockSupabaseService() },
      {
        provide: ActivatedRoute,
        useValue: mockActivatedRoute(
          { courseId, moduleId: null },
          { lectureId },
        ),
      },
    ],
  });

  // Flush async ngOnInit
  await new Promise((r) => setTimeout(r));
  result.fixture.detectChanges();

  return { ...result, courseService, authService };
}

/** Helper: render in edit mode (with moduleId) */
async function renderEditMode(overrides?: {
  courseService?: ReturnType<typeof createMockCourseService>;
  authService?: ReturnType<typeof createMockAuthService>;
  courseId?: string;
  moduleId?: string;
}) {
  const courseService = overrides?.courseService ?? createMockCourseService();
  const authService =
    overrides?.authService ??
    createMockAuthService({ isAuthenticated: true, claims: { is_platform_admin: true } });
  const courseId = overrides?.courseId ?? 'course-1';
  const moduleId = overrides?.moduleId ?? 'mod-1';

  const result = await render(ModuleFormPageComponent, {
    componentImports: defaultImports,
    providers: [
      provideRouter([]),
      { provide: CourseService, useValue: courseService },
      { provide: AuthService, useValue: authService },
      { provide: SupabaseService, useValue: createMockSupabaseService() },
      {
        provide: ActivatedRoute,
        useValue: mockActivatedRoute({ courseId, moduleId }),
      },
    ],
  });

  // Flush async ngOnInit (loadForEdit)
  await new Promise((r) => setTimeout(r));
  result.fixture.detectChanges();

  return { ...result, courseService, authService };
}

describe('ModuleFormPageComponent', () => {
  // --- Heading ---

  it('should show "New Module" heading in create mode', async () => {
    await renderCreateMode();

    expect(screen.getByText('New Module')).toBeTruthy();
  });

  it('should show "Edit Module" heading in edit mode', async () => {
    await renderEditMode();

    expect(screen.getByText('Edit Module')).toBeTruthy();
  });

  // --- Type selector ---

  it('should show type selector grid in create mode before type chosen', async () => {
    await renderCreateMode();

    expect(screen.getByText('Choose a module type:')).toBeTruthy();
  });

  it('should hide type selector in edit mode', async () => {
    await renderEditMode();

    expect(screen.queryByText('Choose a module type:')).toBeNull();
  });

  it('should show all 5 type options', async () => {
    await renderCreateMode();

    expect(screen.getByText('Video')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
    expect(screen.getByText('Rich Text')).toBeTruthy();
    expect(screen.getByText('Quiz')).toBeTruthy();
    expect(screen.getByText('Exam')).toBeTruthy();
  });

  // --- Type selection ---

  it('should show video form when video type selected', async () => {
    await renderCreateMode();

    fireEvent.click(screen.getByText('Video'));

    // VideoFormComponent renders a "Video URL" label
    expect(screen.getByLabelText('Video URL')).toBeTruthy();
  });

  it('should show generic form for quiz type', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('Quiz'));
    fixture.detectChanges();

    // Generic form has Title/Description fields + a Create Module button
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('should show "Quiz Builder coming in Phase 3D" note for quiz type', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('Quiz'));
    fixture.detectChanges();

    expect(screen.getByText(/Quiz Builder coming in Phase 3D/)).toBeTruthy();
  });

  // --- Permission redirect ---

  it('should redirect if user lacks canEdit permission', async () => {
    const authService = createMockAuthService({ isAuthenticated: true });
    // Regular learner — no platform admin, no lecturer_can_edit_course_ids

    const courseService = createMockCourseService();

    const result = await render(ModuleFormPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([{ path: '**', component: DummyComponent }]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: authService },
        { provide: SupabaseService, useValue: createMockSupabaseService() },
        {
          provide: ActivatedRoute,
          useValue: mockActivatedRoute(
            { courseId: 'course-1', moduleId: null },
            { lectureId: 'lecture-1' },
          ),
        },
      ],
    });

    await new Promise((r) => setTimeout(r));
    result.fixture.detectChanges();

    // Verify the router navigated to the course detail page
    const router = result.fixture.debugElement.injector.get(Router);
    expect(router.url).toBe('/courses/course-1');
  });

  // --- Load module for edit ---

  it('should call loadModuleForEdit in edit mode', async () => {
    const { courseService } = await renderEditMode({ moduleId: 'mod-42' });

    expect(courseService.loadModuleForEdit).toHaveBeenCalledWith('mod-42');
  });

  // --- Create mode save ---

  it('should call createModule on save in create mode', async () => {
    const { fixture, courseService } = await renderCreateMode();

    // Select video type
    fireEvent.click(screen.getByText('Video'));
    fixture.detectChanges();

    // Fill in the video form fields
    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    fireEvent.input(titleInput, { target: { value: 'My Video Module' } });

    const videoUrlInput = screen.getByLabelText('Video URL') as HTMLInputElement;
    fireEvent.input(videoUrlInput, { target: { value: 'https://cdn.bunny.net/video.mp4' } });
    fixture.detectChanges();

    // Click Create Module button
    fireEvent.click(screen.getByText('Create Module'));
    await new Promise((r) => setTimeout(r));

    expect(courseService.createModule).toHaveBeenCalledWith(
      'course-1',
      expect.objectContaining({
        module: expect.objectContaining({
          title: 'My Video Module',
          module_type: 'video',
          lecture_id: 'lecture-1',
        }),
        content: expect.objectContaining({ type: 'video' }),
      }),
    );
  });

  // --- Edit mode save ---

  it('should call updateModule on save in edit mode', async () => {
    const { fixture, courseService } = await renderEditMode({ moduleId: 'mod-1' });

    // In edit mode with video type, VideoFormComponent is shown with pre-filled data.
    // The mock loadModuleForEdit returns video_url: 'https://cdn.bunny.net/test.mp4'
    // Click Save Changes
    fireEvent.click(screen.getByText('Save Changes'));
    await new Promise((r) => setTimeout(r));

    expect(courseService.updateModule).toHaveBeenCalledWith(
      'mod-1',
      expect.objectContaining({
        module: expect.objectContaining({
          title: 'Test Module',
          module_type: 'video',
        }),
        content: expect.objectContaining({ type: 'video' }),
      }),
    );
  });

  // --- Navigation on success ---

  it('should navigate to course detail on successful save', async () => {
    const { fixture } = await renderEditMode({ courseId: 'course-99', moduleId: 'mod-1' });

    const router = fixture.debugElement.injector.get(Router);
    const navigateSpy = vi.spyOn(router, 'navigate');

    fireEvent.click(screen.getByText('Save Changes'));
    await new Promise((r) => setTimeout(r));

    expect(navigateSpy).toHaveBeenCalledWith(['/courses', 'course-99']);
  });

  // --- Save failure ---

  it('should show error message on save failure', async () => {
    const courseService = createMockCourseService();
    courseService.updateModule.mockRejectedValueOnce(new Error('Network error'));

    const { fixture } = await renderEditMode({ courseService, moduleId: 'mod-1' });

    fireEvent.click(screen.getByText('Save Changes'));
    await new Promise((r) => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByText('Network error')).toBeTruthy();
  });

  // --- Missing lecture ID ---

  it('should show "Missing lecture ID" error when lectureId missing in create mode', async () => {
    const courseService = createMockCourseService();
    const authService = createMockAuthService({
      isAuthenticated: true,
      claims: { is_platform_admin: true },
    });

    const result = await render(ModuleFormPageComponent, {
      componentImports: defaultImports,
      providers: [
        provideRouter([]),
        { provide: CourseService, useValue: courseService },
        { provide: AuthService, useValue: authService },
        { provide: SupabaseService, useValue: createMockSupabaseService() },
        {
          provide: ActivatedRoute,
          useValue: mockActivatedRoute(
            { courseId: 'course-1', moduleId: null },
            {}, // No lectureId
          ),
        },
      ],
    });

    await new Promise((r) => setTimeout(r));
    result.fixture.detectChanges();

    expect(screen.getByText('Missing lecture ID')).toBeTruthy();
  });

  // --- Generic form save ---

  it('should save generic module (quiz) with title and description', async () => {
    const { fixture, courseService } = await renderCreateMode();

    // Select Quiz type (still uses generic form)
    fireEvent.click(screen.getByText('Quiz'));
    fixture.detectChanges();

    // Fill in generic form
    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    fireEvent.input(titleInput, { target: { value: 'Quiz Module' } });

    const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
    fireEvent.input(descInput, { target: { value: 'A quiz' } });
    fixture.detectChanges();

    // Click Create Module button
    fireEvent.click(screen.getByText('Create Module'));
    await new Promise((r) => setTimeout(r));

    expect(courseService.createModule).toHaveBeenCalledWith(
      'course-1',
      expect.objectContaining({
        module: expect.objectContaining({
          title: 'Quiz Module',
          description: 'A quiz',
          module_type: 'quiz',
          lecture_id: 'lecture-1',
        }),
      }),
    );
  });

  // --- Back to course link ---

  it('should show "Back to course" link', async () => {
    await renderCreateMode();

    expect(screen.getByText('Back to course')).toBeTruthy();
  });

  // --- PDF form ---

  it('should show PDF form when PDF type selected', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('PDF'));
    fixture.detectChanges();

    // PdfFormComponent renders "PDF File" label and page count
    expect(screen.getByText('PDF File')).toBeTruthy();
    expect(screen.getByLabelText('Page count')).toBeTruthy();
  });

  it('should load PDF data in edit mode', async () => {
    const courseService = createMockCourseService();
    courseService.loadModuleForEdit.mockResolvedValueOnce({
      module: { id: 'mod-pdf', title: 'PDF Module', description: 'A PDF', module_type: 'pdf', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'pdf', data: { file_url: 'https://storage/doc.pdf', file_name: 'doc.pdf', page_count: 15 } },
    });

    const { fixture } = await renderEditMode({ courseService, moduleId: 'mod-pdf' });

    expect(courseService.loadModuleForEdit).toHaveBeenCalledWith('mod-pdf');
    // PDF form should be visible with pre-populated data
    expect(screen.getByText('PDF File')).toBeTruthy();
    expect(screen.getByText('doc.pdf')).toBeTruthy();
  });

  // --- Exam form ---

  it('should show Exam form when Exam type selected', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('Exam'));
    fixture.detectChanges();

    // ExamFormComponent renders exam-specific sections
    expect(screen.getByText('Exam Settings')).toBeTruthy();
    expect(screen.getByLabelText('Duration (minutes)')).toBeTruthy();
    expect(screen.getByLabelText('Passing score (%)')).toBeTruthy();
    expect(screen.getByText('Submission Requirements')).toBeTruthy();
  });

  it('should load Exam data in edit mode', async () => {
    const courseService = createMockCourseService();
    courseService.loadModuleForEdit.mockResolvedValueOnce({
      module: { id: 'mod-exam', title: 'Final Exam', description: 'End exam', module_type: 'exam', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: {
        type: 'exam',
        data: {
          title: 'Final Exam',
          description: 'End exam',
          duration_minutes: 90,
          passing_score: 75,
          max_file_size: 52428800,
          allowed_file_types: ['application/pdf'],
          exam_file_url: null,
        },
      },
    });

    await renderEditMode({ courseService, moduleId: 'mod-exam' });

    expect(courseService.loadModuleForEdit).toHaveBeenCalledWith('mod-exam');
    // Exam form should be visible
    expect(screen.getByText('Exam Settings')).toBeTruthy();
    expect((screen.getByLabelText('Duration (minutes)') as HTMLInputElement).value).toBe('90');
    expect((screen.getByLabelText('Passing score (%)') as HTMLInputElement).value).toBe('75');
  });

  // --- No "coming soon" for PDF and Exam ---

  it('should not show "coming soon" note for PDF type', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('PDF'));
    fixture.detectChanges();

    expect(screen.queryByText(/Quiz Builder coming in Phase 3D/)).toBeNull();
  });

  it('should not show "coming soon" note for Exam type', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('Exam'));
    fixture.detectChanges();

    expect(screen.queryByText(/Quiz Builder coming in Phase 3D/)).toBeNull();
  });

  // --- Markdown form ---

  it('should show markdown form when Rich Text type selected', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('Rich Text'));
    fixture.detectChanges();

    // MarkdownFormComponent renders Title, Description, Content label, and Create Module button
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('should not show generic form for Rich Text type', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('Rich Text'));
    fixture.detectChanges();

    expect(screen.queryByText(/Quiz Builder coming in Phase 3D/)).toBeNull();
  });

  it('should load markdown data in edit mode', async () => {
    const courseService = createMockCourseService();
    courseService.loadModuleForEdit.mockResolvedValueOnce({
      module: { id: 'mod-md', title: 'Markdown Module', description: 'Some notes', module_type: 'markdown', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'markdown', data: { content: '# Hello World' } },
    });

    const { fixture } = await renderEditMode({ courseService, moduleId: 'mod-md' });

    expect(courseService.loadModuleForEdit).toHaveBeenCalledWith('mod-md');
    // Markdown form should be visible with pre-populated title
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Markdown Module');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Some notes');
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should call createModule with markdown content on save', async () => {
    const { fixture, courseService } = await renderCreateMode();

    // Select Rich Text type
    fireEvent.click(screen.getByText('Rich Text'));
    fixture.detectChanges();

    // Fill in the title
    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    fireEvent.input(titleInput, { target: { value: 'My Article' } });
    fixture.detectChanges();

    // Click Create Module button
    fireEvent.click(screen.getByText('Create Module'));
    await new Promise((r) => setTimeout(r));

    expect(courseService.createModule).toHaveBeenCalledWith(
      'course-1',
      expect.objectContaining({
        module: expect.objectContaining({
          title: 'My Article',
          module_type: 'markdown',
          lecture_id: 'lecture-1',
        }),
        content: expect.objectContaining({ type: 'markdown' }),
      }),
    );
  });

  // --- Module files editor ---

  it('should show module files editor in edit mode', async () => {
    await renderEditMode();

    // ModuleFilesEditorComponent renders "Attached Files" heading
    expect(screen.getByText('Attached Files')).toBeTruthy();
  });

  it('should not show module files editor in create mode', async () => {
    await renderCreateMode();

    expect(screen.queryByText('Attached Files')).toBeNull();
  });

  it('should show module files editor for all types in edit mode', async () => {
    const courseService = createMockCourseService();
    courseService.loadModuleForEdit.mockResolvedValueOnce({
      module: { id: 'mod-md', title: 'MD Module', description: null, module_type: 'markdown', sort_order: 0, lecture_id: 'l1', course_id: 'c1' },
      content: { type: 'markdown', data: { content: '# Some markdown text' } },
    });

    await renderEditMode({ courseService, moduleId: 'mod-md' });

    // Both the markdown form and the files editor should be visible
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByText('Attached Files')).toBeTruthy();
  });
});
