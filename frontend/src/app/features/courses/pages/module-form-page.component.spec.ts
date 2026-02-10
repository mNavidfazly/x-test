import { describe, it, expect, vi } from 'vitest';
import { Component } from '@angular/core';
import { render, screen, fireEvent } from '@testing-library/angular';
import { provideRouter, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ModuleFormPageComponent } from './module-form-page.component';
import { CourseService } from '../../../core/services/course.service';
import { AuthService } from '../../../core/services/auth.service';
import { VideoFormComponent } from '../components/video-form.component';
import { createMockCourseService } from '../../../__mocks__/course.mock';
import { createMockAuthService } from '../../../__mocks__/auth.mock';
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

const defaultImports = [MockLucideIconComponent, VideoFormComponent, FormsModule, RouterLink];

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

  it('should show generic form for non-video type (pdf)', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('PDF'));
    fixture.detectChanges();

    // Generic form has Title/Description fields + a Create Module button
    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('should show "settings coming soon" note for non-video types', async () => {
    const { fixture } = await renderCreateMode();

    fireEvent.click(screen.getByText('Rich Text'));
    fixture.detectChanges();

    expect(
      screen.getByText(/Additional settings for this module type will be available in a future update/),
    ).toBeTruthy();
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

  it('should save generic module (pdf) with title and description', async () => {
    const { fixture, courseService } = await renderCreateMode();

    // Select PDF type
    fireEvent.click(screen.getByText('PDF'));
    fixture.detectChanges();

    // Fill in generic form
    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    fireEvent.input(titleInput, { target: { value: 'PDF Handbook' } });

    const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
    fireEvent.input(descInput, { target: { value: 'Course handbook' } });
    fixture.detectChanges();

    // Click Create Module button
    fireEvent.click(screen.getByText('Create Module'));
    await new Promise((r) => setTimeout(r));

    expect(courseService.createModule).toHaveBeenCalledWith(
      'course-1',
      expect.objectContaining({
        module: expect.objectContaining({
          title: 'PDF Handbook',
          description: 'Course handbook',
          module_type: 'pdf',
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
});
