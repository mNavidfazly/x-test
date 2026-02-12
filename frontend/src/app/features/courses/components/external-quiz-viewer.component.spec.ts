import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/angular';
import { ExternalQuizViewerComponent } from './external-quiz-viewer.component';
import { MockLucideIconComponent } from '../../../__mocks__/lucide.mock';
import { createMockExternalQuizContent } from '../../../__mocks__/course.mock';

async function renderViewer(overrides?: Parameters<typeof createMockExternalQuizContent>[0]) {
  return render(ExternalQuizViewerComponent, {
    componentImports: [MockLucideIconComponent],
    componentInputs: {
      content: createMockExternalQuizContent(overrides),
    },
  });
}

describe('ExternalQuizViewerComponent', () => {
  it('should render "External Quiz" heading', async () => {
    await renderViewer();

    expect(screen.getByText('External Quiz')).toBeTruthy();
  });

  it('should render quiz ID', async () => {
    await renderViewer({ external_quiz_id: 'MY-QUIZ-42' });

    expect(screen.getByText(/MY-QUIZ-42/)).toBeTruthy();
  });

  it('should render "Take External Quiz" button with correct href', async () => {
    await renderViewer({ external_quiz_url: 'https://quiz.example.com/test-123' });

    const link = screen.getByText('Take External Quiz') as HTMLAnchorElement;
    expect(link.tagName).toBe('A');
    expect(link.href).toBe('https://quiz.example.com/test-123');
  });

  it('should open quiz in new tab', async () => {
    await renderViewer();

    const link = screen.getByText('Take External Quiz') as HTMLAnchorElement;
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('should show passing score when present', async () => {
    await renderViewer({ passing_score: 85 });

    expect(screen.getByText(/85%/)).toBeTruthy();
    expect(screen.getByText(/Passing score/)).toBeTruthy();
  });

  it('should hide passing score when null', async () => {
    await renderViewer({ passing_score: null });

    expect(screen.queryByText(/Passing score/)).toBeNull();
  });
});
