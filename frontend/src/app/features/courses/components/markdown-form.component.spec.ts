import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/angular';
import { MarkdownFormComponent } from './markdown-form.component';
import { MockTiptapEditorComponent } from '../../../__mocks__/tiptap.mock';
import { createMockModuleFormData, createMockMarkdownFormData } from '../../../__mocks__/course.mock';
import { FormsModule } from '@angular/forms';
import { ModuleSavePayload } from '../../../core/models/course.model';

const defaultImports = [MockTiptapEditorComponent, FormsModule];

describe('MarkdownFormComponent', () => {
  it('should render title, description, and editor', async () => {
    await render(MarkdownFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'markdown' }),
        initialMarkdownData: createMockMarkdownFormData(),
      },
    });

    expect(screen.getByLabelText('Title')).toBeTruthy();
    expect(screen.getByLabelText('Description')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByTestId('mock-tiptap-editor')).toBeTruthy();
  });

  it('should pre-populate fields in edit mode', async () => {
    await render(MarkdownFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Existing MD', description: 'Some desc', module_type: 'markdown' }),
        initialMarkdownData: createMockMarkdownFormData({ content: '# Existing Content' }),
        isEditMode: true,
      },
    });

    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Existing MD');
    expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Some desc');
    expect((screen.getByTestId('mock-tiptap-editor') as HTMLTextAreaElement).value).toBe('# Existing Content');
  });

  it('should show "Create Module" button text in create mode', async () => {
    await render(MarkdownFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'markdown' }),
        initialMarkdownData: createMockMarkdownFormData(),
      },
    });
    expect(screen.getByText('Create Module')).toBeTruthy();
  });

  it('should show "Save Changes" button text in edit mode', async () => {
    await render(MarkdownFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'markdown' }),
        initialMarkdownData: createMockMarkdownFormData(),
        isEditMode: true,
      },
    });
    expect(screen.getByText('Save Changes')).toBeTruthy();
  });

  it('should disable save when title is empty', async () => {
    await render(MarkdownFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: '', module_type: 'markdown' }),
        initialMarkdownData: createMockMarkdownFormData(),
      },
    });
    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('should allow save with empty markdown content', async () => {
    await render(MarkdownFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'Module Title', module_type: 'markdown' }),
        initialMarkdownData: createMockMarkdownFormData({ content: '' }),
      },
    });
    const saveButton = screen.getByText('Create Module') as HTMLButtonElement;
    expect(saveButton.disabled).toBe(false);
  });

  it('should emit save payload with markdown content', async () => {
    const { fixture } = await render(MarkdownFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ title: 'My Article', description: 'An article', module_type: 'markdown', lecture_id: 'l1' }),
        initialMarkdownData: createMockMarkdownFormData({ content: '# Hello World' }),
      },
    });

    let emittedPayload: ModuleSavePayload | null = null;
    fixture.componentInstance.save.subscribe((p: ModuleSavePayload) => { emittedPayload = p; });

    fireEvent.click(screen.getByText('Create Module'));
    await new Promise(r => setTimeout(r));

    expect(emittedPayload).not.toBeNull();
    expect(emittedPayload!.module.title).toBe('My Article');
    expect(emittedPayload!.module.module_type).toBe('markdown');
    expect(emittedPayload!.content.type).toBe('markdown');
    if (emittedPayload!.content.type === 'markdown') {
      expect(emittedPayload!.content.data.content).toBe('# Hello World');
    }
  });

  it('should emit cancel on cancel click', async () => {
    const { fixture } = await render(MarkdownFormComponent, {
      componentImports: defaultImports,
      componentInputs: {
        initialModuleData: createMockModuleFormData({ module_type: 'markdown' }),
        initialMarkdownData: createMockMarkdownFormData(),
      },
    });

    let cancelled = false;
    fixture.componentInstance.cancel.subscribe(() => { cancelled = true; });

    fireEvent.click(screen.getByText('Cancel'));
    expect(cancelled).toBe(true);
  });
});
