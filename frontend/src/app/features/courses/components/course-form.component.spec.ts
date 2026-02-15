import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { CourseFormComponent, CourseFormSaveEvent } from './course-form.component';
import { createMockCourseFormData } from '../../../__mocks__/course.mock';
import { FormsModule } from '@angular/forms';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { CustomSelectComponent } from '../../../shared/components/custom-select.component';

describe('CourseFormComponent', () => {
  it('should render all form fields', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData(),
      },
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByText('Thumbnail')).toBeTruthy();
    expect(screen.getByLabelText('Enrollment Type')).toBeTruthy();
    expect(screen.getByLabelText('Staleness Threshold (days)')).toBeTruthy();
  });

  it('should pre-populate fields from initialData', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData({
          title: 'X-LNG Advanced',
          description: 'Advanced course',
        }),
      },
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('X-LNG Advanced');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Advanced course');
  });

  it('should show Create Course button in create mode', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData(),
        isEditMode: false,
      },
    });

    expect(screen.getByText('Create Course')).toBeTruthy();
  });

  it('should show Save Changes button in edit mode', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData(),
        isEditMode: true,
      },
    });

    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should show password field only for password_protected enrollment', async () => {
    const { fixture } = await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData({ enrollment_type: 'open' }),
      },
    });

    expect(screen.queryByLabelText('Enrollment Password')).toBeNull();

    // Change enrollment type to password_protected via custom select
    const combobox = screen.getByRole('combobox', { name: 'Enrollment Type' });
    fireEvent.click(combobox);
    fixture.detectChanges();
    fireEvent.click(screen.getByText('Password protected'));
    fixture.detectChanges();

    expect(screen.getByLabelText('Enrollment Password')).toBeTruthy();
  });

  it('should show password hint in edit mode', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData({ enrollment_type: 'password_protected' }),
        isEditMode: true,
      },
    });

    expect(screen.getByText('Leave blank to keep the current password.')).toBeTruthy();
  });

  it('should disable save button when title is empty', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData({ title: '' }),
      },
    });

    const saveButton = screen.getByText('Create Course') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should emit save with form data and null thumbnailFile on save click', async () => {
    const { fixture } = await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData({ title: 'My Course' }),
      },
    });

    let emittedEvent: CourseFormSaveEvent | null = null;
    fixture.componentInstance.save.subscribe((event: CourseFormSaveEvent) => {
      emittedEvent = event;
    });

    fireEvent.click(screen.getByText('Create Course'));

    expect(emittedEvent).not.toBeNull();
    expect(emittedEvent!.data.title).toBe('My Course');
    expect(emittedEvent!.thumbnailFile).toBeNull();
  });

  it('should emit cancel on cancel click', async () => {
    const { fixture } = await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData(),
      },
    });

    let cancelled = false;
    fixture.componentInstance.cancel.subscribe(() => {
      cancelled = true;
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(cancelled).toBe(true);
  });

  it('should show Upload and URL mode tabs', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData(),
      },
    });

    expect(screen.getByText('Upload')).toBeTruthy();
    expect(screen.getByText('URL')).toBeTruthy();
  });

  it('should show URL input when URL mode is selected', async () => {
    const { fixture } = await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData(),
      },
    });

    // Click URL tab
    fireEvent.click(screen.getByText('URL'));
    fixture.detectChanges();

    expect(screen.getByPlaceholderText(/https:\/\/example/)).toBeTruthy();
  });

  it('should default to URL mode when initialData has an external URL', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData({ thumbnail_url: 'https://example.com/img.jpg' }),
      },
    });

    // URL input should be visible by default
    expect(screen.getByPlaceholderText(/https:\/\/example/)).toBeTruthy();
  });

  it('should show thumbnail preview when currentThumbnailSignedUrl is set', async () => {
    await render(CourseFormComponent, {
      componentImports: [MockLucideIconComponent, FileUploadComponent, FormsModule, CustomSelectComponent],
      componentInputs: {
        initialData: createMockCourseFormData(),
        currentThumbnailSignedUrl: 'https://signed.url/thumb.jpg',
      },
    });

    const img = screen.getByAltText('Thumbnail preview') as HTMLImageElement;
    expect(img.src).toBe('https://signed.url/thumb.jpg');
  });
});
