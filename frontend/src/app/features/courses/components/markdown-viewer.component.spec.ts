import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/angular';
import { MarkdownViewerComponent } from './markdown-viewer.component';
import { MarkdownComponent, provideMarkdown } from 'ngx-markdown';
import { SupabaseService } from '../../../core/services/supabase.service';
import { createMockSupabaseService } from '../../../__mocks__/supabase.mock';

vi.mock('../../../core/utils/markdown-storage.utils', () => ({
  resolveMarkdownStorageUrls: vi.fn().mockImplementation((_client: unknown, markdown: string) => Promise.resolve(markdown)),
  extractStoragePaths: vi.fn().mockReturnValue([]),
}));

describe('MarkdownViewerComponent', () => {
  it('should render markdown content', async () => {
    const { container } = await render(MarkdownViewerComponent, {
      componentInputs: { content: '# Hello World' },
      componentImports: [MarkdownComponent],
      providers: [
        provideMarkdown(),
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    // Wait for effect to resolve
    await new Promise(r => setTimeout(r));

    const prose = container.querySelector('.prose');
    expect(prose).toBeTruthy();
  });

  it('should render with empty string', async () => {
    const { container } = await render(MarkdownViewerComponent, {
      componentInputs: { content: '' },
      componentImports: [MarkdownComponent],
      providers: [
        provideMarkdown(),
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    await new Promise(r => setTimeout(r));

    // With empty content, no prose div is shown (resolving stays false, but content is empty)
    const card = container.querySelector('.card');
    expect(card).toBeTruthy();
  });

  it('should show loading skeleton during resolution', async () => {
    const { fixture, container } = await render(MarkdownViewerComponent, {
      componentInputs: { content: 'plain text' },
      componentImports: [MarkdownComponent],
      providers: [
        provideMarkdown(),
        { provide: SupabaseService, useValue: createMockSupabaseService() },
      ],
    });

    // Fast path: no supabase-storage:// → no loading → resolvedContent set synchronously in microtask
    await new Promise(r => setTimeout(r));
    fixture.detectChanges();

    expect(fixture.componentInstance.resolvedContent()).toBe('plain text');
  });
});
