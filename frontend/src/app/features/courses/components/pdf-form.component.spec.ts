import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { PdfFormComponent } from './pdf-form.component';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';
import { createMockModuleFormData, createMockPdfFormData } from '../../../__mocks__/course.mock';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { FileUploadComponent } from '../../../shared/components/file-upload.component';
import { FormsModule } from '@angular/forms';
import { ModuleSavePayload } from '../../../core/models/course.model';

const defaultImports = [MockLucideIconComponent, FileUploadComponent, FormsModule];

describe('PdfFormComponent', () => {
  it('should render title, description, file upload, and page count fields', async () => {
    await render(PdfFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'pdf' }),
        initialPdfData: createMockPdfFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByText('PDF File')).toBeTruthy();
    expect(screen.getByLabelText('Page count')).toBeTruthy();
  });

  it('should pre-populate fields in edit mode', async () => {
    await render(PdfFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Existing PDF', description: 'PDF desc', module_type: 'pdf' }),
        initialPdfData: createMockPdfFormData({
          file_url: 'https://storage/existing.pdf',
          file_name: 'existing.pdf',
          page_count: 42,
        }),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Existing PDF');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('PDF desc');
    expect((screen.getByLabelText('Page count') as HTMLInputElement).value).toBe('42');
    // FileUpload should show the current filename
    expect(screen.getByText('existing.pdf')).toBeTruthy();
  });

  it('should show "Create Module" button text in create mode', async () => {
    await render(PdfFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'pdf' }),
        initialPdfData: createMockPdfFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    expect(screen.getByText('Create Module')).toBeTruthy();
  });

  it('should show "Save Changes" button text in edit mode', async () => {
    await render(PdfFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'pdf' }),
        initialPdfData: createMockPdfFormData(),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should disable save when title is empty', async () => {
    await render(PdfFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: '', module_type: 'pdf' }),
        initialPdfData: createMockPdfFormData(),
        courseId: 'course-1',
      },
      providers: [
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should disable save when no file selected and no existing file_url', async () => {
    await render(PdfFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'pdf' }),
        initialPdfData: createMockPdfFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should emit save payload with PDF content data when existing file_url', async () => {
    const { fixture } = await render(PdfFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'My PDF', description: 'A doc', module_type: 'pdf', lecture_id: 'l1' }),
        initialPdfData: createMockPdfFormData({
          file_url: 'https://storage/doc.pdf',
          file_name: 'doc.pdf',
          page_count: 10,
        }),
        isEditMode: true,
        courseId: 'course-1',
      },
      providers: [
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((p: ModuleSavePayload) => { emittedPayload = p; });

    fireEvent.click(screen.getByText('Save Changes'));
    await new Promise(r => setTimeout(r));

    expect(emittedPayload).not.toBeNull();
    expect(emittedPayload!.module.title).toBe('My PDF');
    expect(emittedPayload!.module.module_type).toBe('pdf');
    expect(emittedPayload!.content.type).toBe('pdf');
    if (emittedPayload!.content.type === 'pdf') {
      expect(emittedPayload!.content.data.file_url).toBe('https://storage/doc.pdf');
      expect(emittedPayload!.content.data.file_name).toBe('doc.pdf');
      expect(emittedPayload!.content.data.page_count).toBe(10);
    }
  });

  it('should upload file to Supabase Storage on save', async () => {
    const supabase = createMockSupabaseService();

    const { fixture } = await render(PdfFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Upload Test', module_type: 'pdf', lecture_id: 'l1' }),
        initialPdfData: createMockPdfFormData({ file_url: '', file_name: '' }),
        courseId: 'course-1',
      },
      providers: [
        { provide: SupabaseService, useValue: supabase },
      ],
    });

    // Simulate file selection via the FileUploadComponent
    const pdfFile = new File(['pdf-content'], 'upload.pdf', { type: 'application/pdf' });
    const fileInput = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(fileInput, 'files', { value: [pdfFile] });
    fireEvent.change(fileInput);
    fixture.detectChanges();

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((p: ModuleSavePayload) => { emittedPayload = p; });

    fireEvent.click(screen.getByText('Create Module'));
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(supabase.client.storage.from).toHaveBeenCalledWith('course-files');
    expect(emittedPayload).not.toBeNull();
    expect(emittedPayload!.content.type).toBe('pdf');
  });
});
