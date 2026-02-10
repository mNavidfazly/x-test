import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { LectureFormComponent } from './lecture-form.component';
import { createMockLectureFormData } from '../../../__mocks__/course.mock';

describe('LectureFormComponent', () => {
  it('should render title and description fields', async () => {
    await render(LectureFormComponent, {
      componentInputs: { initialData: createMockLectureFormData() },
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
  });

  it('should pre-populate fields from initialData', async () => {
    await render(LectureFormComponent, {
      componentInputs: {
        initialData: createMockLectureFormData({ title: 'Existing Lecture', description: 'Some desc' }),
      },
    });

    const titleInput = screen.getByLabelText('Title') as HTMLInputElement;
    const descInput = screen.getByLabelText('Description') as HTMLTextAreaElement;
    expect(titleInput.value).toBe('Existing Lecture');
    expect(descInput.value).toBe('Some desc');
  });

  it('should show "Add Lecture" button in create mode', async () => {
    await render(LectureFormComponent, {
      componentInputs: { initialData: createMockLectureFormData() },
    });

    expect(screen.getByText('Add Lecture')).toBeTruthy();
  });

  it('should show "Save" button in edit mode', async () => {
    await render(LectureFormComponent, {
      componentInputs: {
        initialData: createMockLectureFormData(),
        isEditMode: true,
      },
    });

    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('should show "Edit Lecture" heading in edit mode', async () => {
    await render(LectureFormComponent, {
      componentInputs: {
        initialData: createMockLectureFormData(),
        isEditMode: true,
      },
    });

    expect(screen.getByText('Edit Lecture')).toBeTruthy();
  });

  it('should disable save button when title is empty', async () => {
    await render(LectureFormComponent, {
      componentInputs: {
        initialData: createMockLectureFormData({ title: '' }),
      },
    });

    const saveButton = screen.getByText('Add Lecture') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should emit save with form data on save click', async () => {
    const { fixture } = await render(LectureFormComponent, {
      componentInputs: {
        initialData: createMockLectureFormData({ title: 'My Lecture', description: 'Desc' }),
      },
    });

    let emittedData: unknown = null;
    fixture.componentInstance.save.subscribe((data: unknown) => {
      emittedData = data;
    });

    fireEvent.click(screen.getByText('Add Lecture'));

    expect(emittedData).toEqual({ title: 'My Lecture', description: 'Desc' });
  });

  it('should emit cancel on cancel click', async () => {
    const { fixture } = await render(LectureFormComponent, {
      componentInputs: { initialData: createMockLectureFormData() },
    });

    let cancelled = false;
    fixture.componentInstance.cancel.subscribe(() => {
      cancelled = true;
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(cancelled).toBe(true);
  });
});
