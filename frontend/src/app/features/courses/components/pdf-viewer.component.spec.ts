import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { PdfViewerComponent } from './pdf-viewer.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockModulePdf } from '../../../__mocks__/course.mock';

describe('PdfViewerComponent', () => {
  it('should render iframe and download link', async () => {
    const pdf = createMockModulePdf();
    await render(PdfViewerComponent, {
      componentInputs: { pdf },
      componentImports: [MockLucideIconComponent],
    });

    const iframe = document.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe).toBeTruthy();
    expect(iframe.title).toBe('PDF Viewer');

    expect(screen.getByText('Download PDF')).toBeTruthy();
  });

  it('should show page count when available', async () => {
    const pdf = createMockModulePdf({ page_count: 24 });
    await render(PdfViewerComponent, {
      componentInputs: { pdf },
      componentImports: [MockLucideIconComponent],
    });

    expect(screen.getByText('24 pages')).toBeTruthy();
  });

  it('should hide page count when null', async () => {
    const pdf = createMockModulePdf({ page_count: null });
    await render(PdfViewerComponent, {
      componentInputs: { pdf },
      componentImports: [MockLucideIconComponent],
    });

    expect(screen.queryByText(/pages/)).toBeNull();
  });
});
