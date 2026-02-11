import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { ExamFormComponent } from './exam-form.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';
import { createMockModuleFormData, createMockExamFormData } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { FormsModule } from '@angular/forms';
import { ModuleSavePayload } from '../../../core/models/course.model';

const defaultImports = [MockLucideIconComponent, FileUploadComponent, FormsModule];

function defaultProviders() {
  return [{ provide: SupabaseService, useValue: createMockSupabaseService() }];
}

describe('ExamFormComponent', () => {
  it('should render all sections (basics, settings, constraints, exam file)', async () => {
    await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'exam' }),
        initialExamData: createMockExamFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByText('Exam Settings')).toBeTruthy();
    expect(screen.getByLabelText('Duration (minutes)')).toBeTruthy();
    expect(screen.getByLabelText('Passing score (%)')).toBeTruthy();
    expect(screen.getByText('Submission Requirements')).toBeTruthy();
    expect(screen.getByLabelText('Max file size (MB)')).toBeTruthy();
    expect(screen.getByText('Exam File')).toBeTruthy();
  });

  it('should pre-populate fields in edit mode', async () => {
    await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Final Exam', description: 'End of course', module_type: 'exam' }),
        initialExamData: createMockExamFormData({
          duration_minutes: 90,
          passing_score: 75,
          max_file_size: 104857600,
        }),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Final Exam');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('End of course');
    expect((screen.getByLabelText('Duration (minutes)') as HTMLInputElement).value).toBe('90');
    expect((screen.getByLabelText('Passing score (%)') as HTMLInputElement).value).toBe('75');
    expect((screen.getByLabelText('Max file size (MB)') as HTMLInputElement).value).toBe('100');
  });

  it('should show "Create Module" button text in create mode', async () => {
    await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'exam' }),
        initialExamData: createMockExamFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(screen.getByText('Create Module')).toBeTruthy();
  });

  it('should show "Save Changes" button text in edit mode', async () => {
    await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'exam' }),
        initialExamData: createMockExamFormData(),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should disable save when title is empty', async () => {
    await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: '', module_type: 'exam' }),
        initialExamData: createMockExamFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should disable save when duration_minutes is 0', async () => {
    await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'exam' }),
        initialExamData: createMockExamFormData({ duration_minutes: 0 }),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should have default values for max_file_size and allowed_file_types', async () => {
    const { fixture } = await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'exam' }),
        initialExamData: createMockExamFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    expect(fixture.componentInstance.examForm.max_file_size).toBe(52428800);
    expect(fixture.componentInstance.examForm.allowed_file_types).toEqual(['application/pdf', 'application/zip']);
  });

  it('should emit save payload with exam content data', async () => {
    const { fixture } = await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'My Exam', description: 'An exam', module_type: 'exam', lecture_id: 'l1' }),
        initialExamData: createMockExamFormData({
          duration_minutes: 60,
          passing_score: 70,
          max_file_size: 52428800,
        }),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((p: ModuleSavePayload) => { emittedPayload = p; });

    fireEvent.click(screen.getByText('Create Module'));
    await new Promise(r => setTimeout(r));

    expect(emittedPayload).not.toBeNull();
    expect(emittedPayload!.module.title).toBe('My Exam');
    expect(emittedPayload!.module.module_type).toBe('exam');
    expect(emittedPayload!.content.type).toBe('exam');
    if (emittedPayload!.content.type === 'exam') {
      expect(emittedPayload!.content.data.title).toBe('My Exam');
      expect(emittedPayload!.content.data.duration_minutes).toBe(60);
      expect(emittedPayload!.content.data.passing_score).toBe(70);
    }
  });

  it('should work without exam file (optional)', async () => {
    const { fixture } = await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'No File Exam', module_type: 'exam', lecture_id: 'l1' }),
        initialExamData: createMockExamFormData({ exam_file_url: null }),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((p: ModuleSavePayload) => { emittedPayload = p; });

    fireEvent.click(screen.getByText('Create Module'));
    await new Promise(r => setTimeout(r));

    expect(emittedPayload).not.toBeNull();
    if (emittedPayload!.content.type === 'exam') {
      expect(emittedPayload!.content.data.exam_file_url).toBeNull();
    }
  });

  it('should emit cancel on cancel click', async () => {
    const { fixture } = await render(ExamFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'exam' }),
        initialExamData: createMockExamFormData(),
        courseId: 'course-1',
      },
      providers: defaultProviders(),
    });

    let cancelled = false;
    fixture.componentInstance.cancel.subscribe(() => { cancelled = true; });

    fireEvent.click(screen.getByText('Cancel'));

    expect(cancelled).toBe(true);
  });
});
