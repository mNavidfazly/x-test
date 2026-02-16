import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { TiptapEditorComponent } from './tiptap-editor.component';

describe('TiptapEditorComponent', () => {
  it('should create the component', async () => {
    const { fixture } = await render(TiptapEditorComponent, {
      componentInputs: { content: '# Hello' },
    });
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should create an Editor instance', async () => {
    const { fixture } = await render(TiptapEditorComponent, {
      componentInputs: { content: '' },
    });
    await new Promise(r => setTimeout(r));
    expect(fixture.componentInstance.editor).toBeTruthy();
  });

  it('should render toolbar buttons', async () => {
    const { fixture } = await render(TiptapEditorComponent, {
      componentInputs: { content: '' },
    });
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByTitle('Bold')).toBeTruthy();
    expect(screen.getByTitle('Italic')).toBeTruthy();
    expect(screen.getByTitle('Heading 2')).toBeTruthy();
    expect(screen.getByTitle('Code Block')).toBeTruthy();
    expect(screen.getByTitle('Undo')).toBeTruthy();
    expect(screen.getByTitle('Redo')).toBeTruthy();
  });

  it('should destroy editor on component destroy', async () => {
    const { fixture } = await render(TiptapEditorComponent, {
      componentInputs: { content: '' },
    });
    await new Promise(r => setTimeout(r));

    const editor = fixture.componentInstance.editor;
    expect(editor).toBeTruthy();

    fixture.destroy();
    expect(editor!.isDestroyed).toBe(true);
  });

  it('should accept placeholder input', async () => {
    const { fixture } = await render(TiptapEditorComponent, {
      componentInputs: { content: '', placeholder: 'Write here...' },
    });
    expect(fixture.componentInstance.placeholder()).toBe('Write here...');
  });

  it('should accept editable input', async () => {
    const { fixture } = await render(TiptapEditorComponent, {
      componentInputs: { content: '', editable: false },
    });
    await new Promise(r => setTimeout(r));
    expect(fixture.componentInstance.editor?.isEditable).toBe(false);
  });

  it('should not show image button when no uploadHandler', async () => {
    await render(TiptapEditorComponent, {
      componentInputs: { content: '' },
    });
    await new Promise(r => setTimeout(r));

    expect(screen.queryByTitle('Insert Image')).toBeNull();
  });

  it('should show image button when uploadHandler is provided', async () => {
    const handler = async (_file: File) => 'supabase-storage://path';
    const { fixture } = await render(TiptapEditorComponent, {
      componentInputs: { content: '', uploadHandler: handler },
    });
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(screen.getByTitle('Insert Image')).toBeTruthy();
  });
});
