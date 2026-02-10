import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { CourseFormComponent } from './course-form.component';
import { createMockCourseFormData } from '../../../__mocks__/course.mock';

describe('CourseFormComponent', () => {
  it('should render all form fields', async () => {
    await render(CourseFormComponent, {
      componentInputs: {
        initialData: createMockCourseFormData(),
      },
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByLabelText('Thumbnail URL')).toBeTruthy();
    expect(screen.getByLabelText('Enrollment Type')).toBeTruthy();
    expect(screen.getByLabelText('Staleness Threshold (days)')).toBeTruthy();
  });

  it('should pre-populate fields from initialData', async () => {
    await render(CourseFormComponent, {
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
      componentInputs: {
        initialData: createMockCourseFormData(),
        isEditMode: false,
      },
    });

    expect(screen.getByText('Create Course')).toBeTruthy();
  });

  it('should show Save Changes button in edit mode', async () => {
    await render(CourseFormComponent, {
      componentInputs: {
        initialData: createMockCourseFormData(),
        isEditMode: true,
      },
    });

    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should show password field only for password_protected enrollment', async () => {
    const { fixture } = await render(CourseFormComponent, {
      componentInputs: {
        initialData: createMockCourseFormData({ enrollment_type: 'open' }),
      },
    });

    expect(screen.queryByLabelText('Enrollment Password')).toBeNull();

    // Change enrollment type to password_protected
    const select = screen.getByLabelText('Enrollment Type') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'password_protected' } });
    fixture.detectChanges();

    expect(screen.getByLabelText('Enrollment Password')).toBeTruthy();
  });

  it('should show password hint in edit mode', async () => {
    await render(CourseFormComponent, {
      componentInputs: {
        initialData: createMockCourseFormData({ enrollment_type: 'password_protected' }),
        isEditMode: true,
      },
    });

    expect(screen.getByText('Leave blank to keep the current password.')).toBeTruthy();
  });

  it('should disable save button when title is empty', async () => {
    await render(CourseFormComponent, {
      componentInputs: {
        initialData: createMockCourseFormData({ title: '' }),
      },
    });

    const saveButton = screen.getByText('Create Course') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should emit save with form data on save click', async () => {
    const { fixture } = await render(CourseFormComponent, {
      componentInputs: {
        initialData: createMockCourseFormData({ title: 'My Course' }),
      },
    });

    let emittedData: unknown = null;
    fixture.componentInstance.save.subscribe((data: unknown) => {
      emittedData = data;
    });

    fireEvent.click(screen.getByText('Create Course'));

    expect(emittedData).not.toBeNull();
    expect((emittedData as { title: string }).title).toBe('My Course');
  });

  it('should emit cancel on cancel click', async () => {
    const { fixture } = await render(CourseFormComponent, {
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
});
