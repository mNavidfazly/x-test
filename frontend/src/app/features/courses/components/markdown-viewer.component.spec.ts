import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/angular';
import { MarkdownViewerComponent } from './markdown-viewer.component';
import { MarkdownComponent, provideMarkdown } from 'ngx-markdown';

describe('MarkdownViewerComponent', () => {
  it('should render markdown content', async () => {
    const { container } = await render(MarkdownViewerComponent, {
      componentInputs: { content: '# Hello World' },
      componentImports: [MarkdownComponent],
      providers: [provideMarkdown()],
    });

    const prose = container.querySelector('.prose');
    expect(prose).toBeTruthy();
  });

  it('should render with empty string', async () => {
    const { container } = await render(MarkdownViewerComponent, {
      componentInputs: { content: '' },
      componentImports: [MarkdownComponent],
      providers: [provideMarkdown()],
    });

    const prose = container.querySelector('.prose');
    expect(prose).toBeTruthy();
  });
});
