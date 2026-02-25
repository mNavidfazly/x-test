import { describe, it, expect } from 'vitest';
import { Component, input } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import { PdfViewerComponent } from './pdf-viewer.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockModulePdf } from '../../../__mocks__/course.mock';

@Component({
  selector: 'ngx-extended-pdf-viewer',
  standalone: true,
  template: '<div data-testid="mock-pdf-viewer"></div>',
})
class MockNgxExtendedPdfViewerComponent {
  readonly src = input<string>();
  readonly height = input<string>();
  readonly showToolbar = input<boolean>();
  readonly showSidebarButton = input<boolean>();
  readonly showFindButton = input<boolean>();
  readonly showPagingButtons = input<boolean>();
  readonly showZoomButtons = input<boolean>();
  readonly showPresentationModeButton = input<boolean>();
  readonly showDownloadButton = input<boolean>();
  readonly showPrintButton = input<boolean>();
  readonly showOpenFileButton = input<boolean>();
  readonly showSecondaryToolbarButton = input<boolean>();
  readonly showTextEditor = input<boolean>();
  readonly showDrawEditor = input<boolean>();
  readonly showHighlightEditor = input<boolean>();
  readonly showStampEditor = input<boolean>();
  readonly textLayer = input<boolean>();
}

describe('PdfViewerComponent', () => {
  it('should render pdf viewer and download link', async () => {
    const pdf = createMockModulePdf();
    await render(PdfViewerComponent, {
      componentInputs: { pdf },
      componentImports: [MockLucideIconComponent, MockNgxExtendedPdfViewerComponent],
    });

    expect(screen.getByTestId('mock-pdf-viewer')).toBeTruthy();
    expect(screen.getByText('Download PDF')).toBeTruthy();
  });

  it('should show page count when available', async () => {
    const pdf = createMockModulePdf({ page_count: 24 });
    await render(PdfViewerComponent, {
      componentInputs: { pdf },
      componentImports: [MockLucideIconComponent, MockNgxExtendedPdfViewerComponent],
    });

    expect(screen.getByText('24 pages')).toBeTruthy();
  });

  it('should hide page count when null', async () => {
    const pdf = createMockModulePdf({ page_count: null });
    await render(PdfViewerComponent, {
      componentInputs: { pdf },
      componentImports: [MockLucideIconComponent, MockNgxExtendedPdfViewerComponent],
    });

    expect(screen.queryByText(/pages/)).toBeNull();
  });
});
